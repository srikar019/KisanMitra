import { firestore } from './firebase';
import { FarmerProfile, SystemStats } from '../types';

export const getAllUsers = async (): Promise<FarmerProfile[]> => {
    try {
        const snapshot = await firestore.collection('users').get();
        return snapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data()
        } as FarmerProfile));
    } catch (error) {
        console.error("Error fetching all users:", error);
        throw new Error("Failed to retrieve user list.");
    }
};

export const getSystemStats = async (): Promise<SystemStats> => {
    try {
        const usersSnap = await firestore.collection('users').get();
        const marketplaceSnap = await firestore.collection('products').get();
        const agriSwapSnap = await firestore.collection('barterListings').where('status', '==', 'active').get();

        let totalFarmers = 0;
        let totalCustomers = 0;
        usersSnap.forEach(doc => {
            if (doc.data().role === 'farmer') totalFarmers++;
            else if (doc.data().role === 'customer') totalCustomers++;
        });

        return {
            totalFarmers,
            totalCustomers,
            marketplaceListings: marketplaceSnap.size,
            agriSwapListings: agriSwapSnap.size,
        };
    } catch (error) {
        console.error("Error fetching system stats:", error);
        throw new Error("Failed to retrieve system statistics.");
    }
};

export const deleteUserAccount = async (uid: string): Promise<void> => {
    try {
        // This deletes the user's profile document from Firestore.
        // Note: This does not delete the user from Firebase Authentication.
        // For a full production app, a Cloud Function would be needed to handle that.
        await firestore.collection('users').doc(uid).delete();
    } catch (error) {
        console.error(`Error deleting user account for UID ${uid}:`, error);
        throw new Error("Failed to delete user account.");
    }
};
