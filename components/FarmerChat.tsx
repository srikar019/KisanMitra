import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getMessages, sendMessage, generateChatId, onChatMetadataChange, updateTypingStatus, markMessagesAsRead, updateMessage } from '../services/chatService';
import { useAuth } from '../contexts/AuthContext';
import type { FarmerChatMessage, FarmerProfile, ChatMetadata } from '../types';
import Card from './common/Card';
import Icon from './common/Icon';
import Button from './common/Button';

interface FarmerChatProps {
    recipient: FarmerProfile;
    onBack: () => void;
}

const UndoToast: React.FC<{ onUndo: () => void; isVisible: boolean }> = ({ onUndo, isVisible }) => {
    if (!isVisible) return null;
    return (
        <div className="toast-enter absolute bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md p-4">
            <div className="bg-gray-800 text-white rounded-lg shadow-lg flex items-center justify-between p-3 relative overflow-hidden">
                <span>Message deleted</span>
                <button onClick={onUndo} className="font-semibold text-cyan-400 hover:text-cyan-300">Undo</button>
                <div className="absolute bottom-0 left-0 h-1 bg-cyan-500 toast-progress"></div>
            </div>
        </div>
    );
};


const FarmerChat: React.FC<FarmerChatProps> = ({ recipient, onBack }) => {
    const { currentUser } = useAuth();
    const [messages, setMessages] = useState<FarmerChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [chatMetadata, setChatMetadata] = useState<ChatMetadata | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Edit/Delete/Undo States
    const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
    const [pendingDelete, setPendingDelete] = useState<FarmerChatMessage | null>(null);
    const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    

    const chatId = currentUser ? generateChatId(currentUser.uid, recipient.uid) : null;
    const recipientStatus = chatMetadata?.participantInfo?.[recipient.uid];

    const commitDelete = useCallback(async (messageToDelete: FarmerChatMessage) => {
        if (!chatId || !currentUser) return;
        try {
            await updateMessage(chatId, messageToDelete.id, currentUser.uid, { deleted: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete message permanently.');
        } finally {
            // Use a functional update to safely access the latest state
            // and prevent clearing the wrong pending delete.
            setPendingDelete(currentPending => {
                if (currentPending?.id === messageToDelete.id) {
                    return null;
                }
                return currentPending;
            });
        }
    }, [chatId, currentUser]);

    useEffect(() => {
        if (!chatId || !currentUser) return;

        setLoading(true);
        setError(null);
        setMessages([]);

        const unsubscribeMessages = getMessages(chatId, (newMessages) => {
            setMessages(newMessages);
            setLoading(false);
            markMessagesAsRead(chatId, currentUser.uid);
        });

        const unsubscribeMetadata = onChatMetadataChange(chatId, (metadata) => {
            setChatMetadata(metadata);
        });
        
        return () => {
            unsubscribeMessages();
            unsubscribeMetadata();
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            // On unmount, clear any pending undo timer to prevent state updates.
            if (undoTimeoutRef.current) {
                clearTimeout(undoTimeoutRef.current);
            }
            if (chatId && currentUser) {
              updateTypingStatus(chatId, currentUser.uid, false);
            }
        };
    }, [chatId, currentUser]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, recipientStatus?.isTyping]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !currentUser || !chatId) return;
        
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        updateTypingStatus(chatId, currentUser.uid, false);

        try {
            await sendMessage(chatId, { senderUid: currentUser.uid, senderEmail: currentUser.email!, text: newMessage }, recipient.uid);
            setNewMessage('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send message.');
        }
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewMessage(e.target.value);
        if (!chatId || !currentUser) return;

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        updateTypingStatus(chatId, currentUser.uid, true);

        typingTimeoutRef.current = setTimeout(() => {
            updateTypingStatus(chatId, currentUser.uid, false);
        }, 2000);
    };

    const handleSaveEdit = async () => {
        if (!chatId || !currentUser || !editingMessage || !editingMessage.text.trim()) return;
    
        const originalText = messages.find(m => m.id === editingMessage.id)?.text;
        if (originalText === editingMessage.text.trim()) {
            setEditingMessage(null);
            return;
        }
    
        try {
            await updateMessage(chatId, editingMessage.id, currentUser.uid, {
                text: editingMessage.text.trim(),
                edited: true,
            });
            setEditingMessage(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to edit message.');
        }
    };

    const handleDelete = (message: FarmerChatMessage) => {
        if (undoTimeoutRef.current && pendingDelete) {
            clearTimeout(undoTimeoutRef.current);
            commitDelete(pendingDelete);
        }

        setPendingDelete(message);

        const timeoutId = setTimeout(() => {
            commitDelete(message);
            if (undoTimeoutRef.current === timeoutId) {
                undoTimeoutRef.current = null;
            }
        }, 7000); // 7 seconds to undo
        undoTimeoutRef.current = timeoutId;
    };

    const handleUndoDelete = () => {
        if (undoTimeoutRef.current) {
            clearTimeout(undoTimeoutRef.current);
            undoTimeoutRef.current = null;
        }
        setPendingDelete(null);
    };
    
    const getDisplayName = (email: string) => email.split('@')[0];

    const MessageStatus: React.FC<{ message: FarmerChatMessage }> = ({ message }) => {
        if (message.senderUid !== currentUser?.uid) return null;
        
        const isRead = recipientStatus?.lastRead && message.timestamp <= recipientStatus.lastRead;

        if (isRead) {
            return <Icon name="check-double" className="h-4 w-4 text-blue-300" />;
        }
        return <Icon name="check" className="h-4 w-4 text-blue-100/70" />;
    };

    return (
        <Card className="!max-w-7xl">
             <div className="flex items-center mb-6">
                <button onClick={onBack} className="p-2 mr-3 rounded-full hover:bg-gray-200" aria-label="Back to directory">
                    <Icon name="arrow-left" className="h-6 w-6 text-gray-600" />
                </button>
                <Icon name="user-circle" className="h-8 w-8 text-green-500 mr-3" />
                <div>
                    <h2 className="text-2xl font-bold text-gray-700">Chat with {getDisplayName(recipient.email)}</h2>
                    <p className="text-gray-600 text-sm">{recipient.email}</p>
                </div>
            </div>

            <div className="relative flex flex-col h-[70vh] border rounded-lg bg-white overflow-hidden">
                <div className="flex-1 p-4 overflow-y-auto bg-gray-100">
                    {loading && <div className="flex justify-center items-center h-full"><div className="w-8 h-8 border-2 border-green-500 border-dashed rounded-full animate-spin"></div></div>}
                    {!loading && messages.length === 0 && <div className="flex justify-center items-center h-full text-gray-500">Start the conversation!</div>}
                    
                    <div className="space-y-4">
                        {messages.map(msg => {
                            const isCurrentUser = msg.senderUid === currentUser?.uid;
                            const isEditing = editingMessage?.id === msg.id;
                            const isPendingDelete = pendingDelete?.id === msg.id;
                            const isDeleted = msg.deleted;

                             const messageContent = (
                                <div className={`p-3 rounded-2xl max-w-[70%] break-words transition-opacity duration-300 ${isCurrentUser ? 'bg-blue-500 text-white rounded-br-none' : 'bg-white border rounded-bl-none'} ${isPendingDelete ? 'opacity-50' : 'opacity-100'}`}>
                                    {isDeleted || isPendingDelete ? (
                                        <p className={`italic ${isCurrentUser ? 'text-blue-200/80' : 'text-gray-500'}`}>
                                            {isPendingDelete ? 'Message deleted.' : 'This message was deleted'}
                                        </p>
                                    ) : (
                                        <>
                                            <p className="whitespace-pre-wrap">{msg.text}</p>
                                            <div className="flex items-center justify-end gap-1.5 mt-1">
                                                {msg.edited && <p className={`text-xs ${isCurrentUser ? 'text-blue-200/70' : 'text-gray-400'}`}>(edited)</p>}
                                                <p className={`text-xs ${isCurrentUser ? 'text-blue-100/70' : 'text-gray-400'}`}>
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                <MessageStatus message={msg} />
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                            
                            if (isEditing) {
                                return (
                                     <div key={msg.id} className="flex items-end gap-2 justify-end">
                                         <div className="p-3 rounded-2xl bg-blue-600 text-white w-full max-w-[70%]">
                                            <textarea
                                                value={editingMessage.text}
                                                onChange={(e) => setEditingMessage({ ...editingMessage, text: e.target.value })}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                                                    if (e.key === 'Escape') { e.preventDefault(); setEditingMessage(null); }
                                                }}
                                                className="w-full bg-transparent text-white rounded-md p-0 focus:outline-none placeholder-blue-300 resize-none"
                                                rows={Math.max(2, editingMessage.text.split('\n').length)}
                                                autoFocus
                                            />
                                            <div className="flex justify-end items-center gap-3 mt-2 text-xs">
                                                 <p>enter to <button type="button" onClick={handleSaveEdit} className="font-bold hover:underline">save</button> • esc to <button type="button" onClick={() => setEditingMessage(null)} className="font-bold hover:underline">cancel</button></p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            }
                            
                            return (
                                <div key={msg.id} className={`group flex items-end gap-2 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                                    {isCurrentUser && !isDeleted && !isPendingDelete && (
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setEditingMessage({ id: msg.id, text: msg.text })} className="p-1.5 rounded-full hover:bg-black/10"><Icon name="pencil" className="h-4 w-4 text-blue-200" /></button>
                                            <button onClick={() => handleDelete(msg)} className="p-1.5 rounded-full hover:bg-black/10"><Icon name="trash" className="h-4 w-4 text-blue-200" /></button>
                                        </div>
                                    )}
                                    {messageContent}
                                </div>
                            );
                        })}
                    </div>

                    {recipientStatus?.isTyping && (
                        <div className="flex items-start gap-3 justify-start animate-fade-in">
                             <div className="p-3 rounded-2xl bg-white border rounded-bl-none">
                                <div className="flex items-center gap-1">
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0s]"></span>
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0.15s]"></span>
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0.3s]"></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                
                <UndoToast onUndo={handleUndoDelete} isVisible={!!pendingDelete} />
                
                <div className="p-4 bg-white border-t">
                    {error && <p className="text-red-500 text-center text-sm mb-2">{error}</p>}
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={handleInputChange}
                            placeholder={`Message ${getDisplayName(recipient.email)}`}
                            className="flex-1 p-2 border rounded-md focus:ring-green-500 focus:border-green-500"
                        />
                        <Button type="submit" disabled={!newMessage.trim()}>Send</Button>
                    </form>
                </div>
            </div>
        </Card>
    );
};

export default FarmerChat;
