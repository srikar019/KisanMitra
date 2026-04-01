import { firestore } from './firebase';
import type { Livestock } from '../types';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const getLivestockCollection = (userId: string) => 
    firestore.collection('users').doc(userId).collection('livestock');

export const addLivestock = async (userId: string, livestockData: Omit<Livestock, 'id' | 'farmerUid' | 'createdAt'>): Promise<void> => {
    try {
        await getLivestockCollection(userId).add({
            ...livestockData,
            farmerUid: userId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        console.error("Error adding livestock:", error);
        throw new Error("Failed to add animal to the database.");
    }
};

export const onLivestockSnapshot = (
    userId: string, 
    callback: (livestock: Livestock[]) => void,
    onError: (error: Error) => void
): (() => void) => {
    const query = getLivestockCollection(userId).orderBy('createdAt', 'desc');

    return query.onSnapshot(
        (querySnapshot) => {
            const livestockList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
            } as Livestock));
            callback(livestockList);
        },
        (error) => {
            console.error("Error fetching real-time livestock data:", error);
            onError(new Error("Failed to fetch animal records."));
        }
    );
};

export const updateLivestock = async (userId: string, livestockId: string, dataToUpdate: Partial<Omit<Livestock, 'id' | 'farmerUid' | 'createdAt'>>): Promise<void> => {
    try {
        await getLivestockCollection(userId).doc(livestockId).update(dataToUpdate);
    } catch (error) {
        console.error("Error updating livestock:", error);
        throw new Error("Failed to update animal record.");
    }
};

export const deleteLivestock = async (userId: string, livestockId: string): Promise<void> => {
    try {
        await getLivestockCollection(userId).doc(livestockId).delete();
    } catch (error) {
        console.error("Error deleting livestock:", error);
        throw new Error("Failed to delete the animal record.");
    }
};
