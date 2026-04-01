import { firestore } from './firebase';
import type { ConnectionRequest, FarmerProfile } from '../types';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

export const sendConnectionRequest = async (sender: FarmerProfile, recipient: FarmerProfile): Promise<void> => {
    // Prevent sending request to self
    if (sender.uid === recipient.uid) return;

    // Check if a request already exists between these two users
    const existingReqQuery = firestore.collection('connections')
        .where('participantUids', 'array-contains-any', [sender.uid, recipient.uid]);
    
    const querySnapshot = await existingReqQuery.get();
    
    // This is a simplified check. A more robust check would verify both participants are in the same doc.
    const requestExists = querySnapshot.docs.some(doc => {
        const data = doc.data();
        const participants = data.participantUids as string[];
        return participants.includes(sender.uid) && participants.includes(recipient.uid);
    });

    if (requestExists) {
        throw new Error("A connection or request already exists with this user.");
    }
    
    const requestRef = firestore.collection('connections').doc();
    await requestRef.set({
        senderUid: sender.uid,
        senderEmail: sender.email,
        recipientUid: recipient.uid,
        recipientEmail: recipient.email,
        participantUids: [sender.uid, recipient.uid],
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
};

export const updateConnectionRequestStatus = async (requestId: string, status: 'accepted' | 'rejected'): Promise<void> => {
    const requestRef = firestore.collection('connections').doc(requestId);
    await requestRef.update({ status });
};

export const removeConnection = async (uid1: string, uid2: string): Promise<void> => {
    try {
        const q = firestore.collection('connections')
            .where('participantUids', 'array-contains', uid1);
        
        const snapshot = await q.get();
        const connectionDoc = snapshot.docs.find(doc => {
            const participants = doc.data().participantUids as string[];
            return participants.includes(uid2);
        });

        if (connectionDoc) {
            await connectionDoc.ref.delete();
        }
    } catch (error) {
        console.error("Error removing connection:", error);
        throw new Error("Failed to remove connection.");
    }
};


export const onPendingRequestsSnapshot = (userId: string, callback: (requests: ConnectionRequest[]) => void): () => void => {
    const q = firestore.collection('connections')
        .where('recipientUid', '==', userId)
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc');

    return q.onSnapshot(snapshot => {
        const requests = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
            } as ConnectionRequest;
        });
        callback(requests);
    });
};


export const onConnectionsSnapshot = (userId: string, callback: (connections: FarmerProfile[]) => void): () => void => {
    const q = firestore.collection('connections')
        .where('participantUids', 'array-contains', userId)
        .where('status', '==', 'accepted');

    return q.onSnapshot(snapshot => {
        const connections: FarmerProfile[] = snapshot.docs.map(doc => {
            const data = doc.data();
            // Return the profile of the *other* person in the connection
            const otherUid = data.senderUid === userId ? data.recipientUid : data.senderUid;
            const otherEmail = data.senderUid === userId ? data.recipientEmail : data.senderEmail;
            return { uid: otherUid, email: otherEmail, role: 'farmer' };
        });
        callback(connections);
    });
};
