import { firestore } from './firebase';
import type { FarmMachinery, MachineryRentalRequest } from '../types';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

// --- Machinery Listings ---

export const addMachineryListing = async (data: Omit<FarmMachinery, 'id' | 'createdAt'>): Promise<void> => {
    try {
        await firestore.collection('machineryListings').add({
            ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        console.error("Error adding machinery listing:", error);
        throw new Error("Failed to add machinery listing.");
    }
};

export const onMachineryListingsSnapshot = (callback: (listings: FarmMachinery[]) => void): () => void => {
    return firestore.collection('machineryListings').orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            const listings = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
            } as FarmMachinery));
            callback(listings);
        }, error => {
            console.error("Error fetching machinery listings:", error);
        });
};

export const updateMachineryListing = async (id: string, data: Partial<Omit<FarmMachinery, 'id'>>): Promise<void> => {
    try {
        await firestore.collection('machineryListings').doc(id).update(data);
    } catch (error) {
        console.error("Error updating machinery listing:", error);
        throw new Error("Failed to update machinery listing.");
    }
};

export const deleteMachineryListing = async (id: string): Promise<void> => {
    try {
        await firestore.collection('machineryListings').doc(id).delete();
    } catch (error) {
        console.error("Error deleting machinery listing:", error);
        throw new Error("Failed to delete machinery listing.");
    }
};


// --- Rental Requests ---

export const createRentalRequest = async (data: Omit<MachineryRentalRequest, 'id' | 'createdAt'>): Promise<void> => {
    try {
        await firestore.collection('machineryRentals').add({
            ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        console.error("Error creating rental request:", error);
        throw new Error("Failed to create rental request.");
    }
};

export const onRentalRequestsSnapshot = (
    userId: string, 
    type: 'owner' | 'renter', 
    callback: (requests: MachineryRentalRequest[]) => void
): () => void => {
    const field = type === 'owner' ? 'ownerUid' : 'renterUid';
    return firestore.collection('machineryRentals')
        .where(field, '==', userId)
        .onSnapshot(snapshot => {
            const requests = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
            } as MachineryRentalRequest));
            // Sort client-side to show newest first.
            requests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            callback(requests);
        });
};

export const updateRentalRequestStatus = async (
    requestId: string, 
    status: MachineryRentalRequest['status'],
    machineryIdToUpdate?: string
): Promise<void> => {
    return firestore.runTransaction(async (transaction) => {
        const requestRef = firestore.collection('machineryRentals').doc(requestId);
        transaction.update(requestRef, { status });

        if (status === 'accepted' && machineryIdToUpdate) {
            const machineryRef = firestore.collection('machineryListings').doc(machineryIdToUpdate);
            transaction.update(machineryRef, { status: 'rented_out' });
        }
        
        if ((status === 'rejected' || status === 'cancelled' || status === 'completed') && machineryIdToUpdate) {
             const machineryRef = firestore.collection('machineryListings').doc(machineryIdToUpdate);
             transaction.update(machineryRef, { status: 'available' });
        }
    });
};
