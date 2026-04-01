import { firestore } from './firebase';
import type { FarmerChatMessage, ChatMetadata } from '../types';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

export const generateChatId = (uid1: string, uid2: string): string => {
    return [uid1, uid2].sort().join('_');
};

const ensureChatDocument = async (chatId: string, uid1: string, uid2: string): Promise<void> => {
    const chatRef = firestore.collection('chats').doc(chatId);
    const doc = await chatRef.get();
    
    if (!doc.exists) {
        // If the chat document doesn't exist, create it from scratch.
        await chatRef.set({
            participants: [uid1, uid2],
            lastMessage: {},
            participantInfo: {
                [uid1]: { isTyping: false, lastRead: null },
                [uid2]: { isTyping: false, lastRead: null },
            }
        });
    } else {
        // Handle legacy documents that might not have the participants array
        const data = doc.data();
        if (!data || !data.participants) {
            await chatRef.update({
                participants: [uid1, uid2]
            });
        }
    }
};

export const sendMessage = async (chatId: string, message: { senderUid: string, senderEmail: string, text: string }, recipientUid: string): Promise<void> => {
    try {
        await ensureChatDocument(chatId, message.senderUid, recipientUid);
        const chatRef = firestore.collection('chats').doc(chatId);
        const messagesCollection = chatRef.collection('messages');

        const timestamp = firebase.firestore.FieldValue.serverTimestamp();
        
        await messagesCollection.add({
            ...message,
            timestamp,
        });

        // Update the last message and ensure participants array is present on the parent chat document to trigger notifications.
        // This is a key step for the real-time notification system to detect new messages.
        await chatRef.set({
            participants: [message.senderUid, recipientUid], // Ensure this field exists for the query
            lastMessage: {
                text: message.text,
                senderUid: message.senderUid,
                senderEmail: message.senderEmail,
                timestamp,
            }
        }, { merge: true });

    } catch (error) {
        console.error("Error sending message:", error);
        throw new Error("Failed to send message.");
    }
};

export const updateMessage = async (
    chatId: string, 
    messageId: string, 
    userId: string, 
    updates: { text?: string; edited?: boolean; deleted?: boolean }
): Promise<void> => {
    const messageRef = firestore.collection('chats').doc(chatId).collection('messages').doc(messageId);
    const chatRef = firestore.collection('chats').doc(chatId);

    try {
        await firestore.runTransaction(async (transaction) => {
            // --- 1. ALL READS FIRST ---
            const messageDoc = await transaction.get(messageRef);
            const chatDoc = await transaction.get(chatRef);

            // --- 2. VALIDATIONS AND LOGIC ---
            if (!messageDoc.exists) {
                throw new Error("Message not found.");
            }
            if (!chatDoc.exists) {
                // This is unlikely if a message exists, but good practice to check.
                throw new Error("Chat not found.");
            }

            const messageData = messageDoc.data();
            if (messageData?.senderUid !== userId) {
                throw new Error("You can only modify your own messages.");
            }

            const chatData = chatDoc.data();
            const lastMessageTimestamp = chatData?.lastMessage?.timestamp;
            const messageTimestamp = messageData?.timestamp;
            
            let isLastMessage = false;
            if (lastMessageTimestamp && messageTimestamp && lastMessageTimestamp.isEqual(messageTimestamp)) {
                isLastMessage = true;
            }
            
            // --- 3. ALL WRITES LAST ---
            const finalUpdates: Record<string, unknown> = { ...updates, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
            transaction.update(messageRef, finalUpdates);

            if (isLastMessage) {
                let newLastMessageText: string | undefined;

                if (updates.deleted) {
                    newLastMessageText = 'This message was deleted';
                } else if (updates.text) {
                    newLastMessageText = updates.text;
                }

                if (newLastMessageText !== undefined) {
                    transaction.update(chatRef, { 
                        'lastMessage.text': newLastMessageText
                    });
                }
            }
        });
    } catch (error) {
        console.error("Error updating message:", error);
        throw error;
    }
};


export const getMessages = (chatId: string, callback: (messages: FarmerChatMessage[]) => void): () => void => {
    const messagesCollection = firestore.collection('chats').doc(chatId).collection('messages');
    const q = messagesCollection.orderBy('timestamp', 'asc');

    return q.onSnapshot(
        (querySnapshot) => {
            const messages = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    senderUid: data.senderUid,
                    senderEmail: data.senderEmail,
                    text: data.text,
                    timestamp: data.timestamp?.toDate() || new Date(),
                    edited: data.edited,
                    deleted: data.deleted,
                    updatedAt: data.updatedAt?.toDate(),
                };
            });
            callback(messages);
        },
        (error) => {
            console.error("Error fetching messages in real-time:", error);
        }
    );
};

export const onChatMetadataChange = (chatId: string, callback: (metadata: ChatMetadata | null) => void): () => void => {
    const chatRef = firestore.collection('chats').doc(chatId);
    return chatRef.onSnapshot(
        (doc) => {
            if (doc.exists) {
                const data = doc.data() as Record<string, unknown> | undefined;
                if (!data) {
                    callback(null);
                    return;
                }
                // Convert Firestore Timestamps to JS Dates
                const participantInfo = data.participantInfo as Record<string, { isTyping?: boolean; lastRead?: { toDate: () => Date } | null }> | undefined;
                if (participantInfo) {
                    for (const uid in participantInfo) {
                        if (participantInfo[uid].lastRead && typeof (participantInfo[uid].lastRead as { toDate: () => Date })?.toDate === 'function') {
                            (participantInfo[uid] as Record<string, unknown>).lastRead = (participantInfo[uid].lastRead as { toDate: () => Date }).toDate();
                        }
                    }
                }
                callback(data as unknown as ChatMetadata);
            } else {
                callback(null);
            }
        },
        (error) => {
            console.error("Error getting chat metadata:", error);
        }
    );
};

export const updateTypingStatus = (chatId: string, userId: string, isTyping: boolean): void => {
    const chatRef = firestore.collection('chats').doc(chatId);
    chatRef.set({
        participantInfo: {
            [userId]: { isTyping }
        }
    }, { merge: true }).catch(error => console.error("Error updating typing status:", error));
};

export const markMessagesAsRead = (chatId: string, userId: string): void => {
    const chatRef = firestore.collection('chats').doc(chatId);
    chatRef.set({
        participantInfo: {
            [userId]: { lastRead: firebase.firestore.FieldValue.serverTimestamp() }
        }
    }, { merge: true }).catch(error => console.error("Error marking messages as read:", error));
};
