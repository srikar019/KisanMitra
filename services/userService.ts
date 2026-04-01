import { firestore } from './firebase';
import { ActiveView, type FarmerProfile } from '../types';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { updateFarmerInfoOnListings } from './marketplaceService';

/**
 * Ensures a user profile document exists in Firestore and has a role.
 * - If the document doesn't exist, it's created with the user's email and role.
 * - If the document exists but lacks a role, the role is added.
 * - If the document exists and has a role, it's left unchanged.
 * This is crucial for migrating old users and for new sign-ups.
 * @param user The user object from Firebase Auth.
 * @param role The role to assign if missing.
 */
export const ensureUserProfile = async (user: firebase.User, role: 'farmer' | 'customer' | 'admin'): Promise<void> => {
    if (!user) return;
    const userRef = firestore.collection('users').doc(user.uid);
    
    try {
        const doc = await userRef.get();

        if (!doc.exists) {
            // Profile doesn't exist, create it.
            await userRef.set({
                email: user.email,
                role,
                name: '',
                location: '',
                phoneNumber: '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                enabledFeatures: [ActiveView.Weather],
            });
        } else {
            // Profile exists, check if role is missing.
            const data = doc.data();
            const updates: Record<string, string | ActiveView[]> = {};
            if (data && !data.role) {
                updates.role = role;
            }
            if (data && !data.enabledFeatures) {
                updates.enabledFeatures = [ActiveView.Weather];
            }
            if (Object.keys(updates).length > 0) {
                await userRef.update(updates);
            }
        }
    } catch (error) {
        console.error("Error in ensureUserProfile:", error);
        // Re-throw the error to be caught by the calling function
        throw error;
    }
};

export const getUserProfile = async (userId: string): Promise<FarmerProfile | null> => {
    try {
        const userRef = firestore.collection('users').doc(userId);
        const doc = await userRef.get();
        if (doc.exists) {
            return { uid: doc.id, ...doc.data() } as FarmerProfile;
        }
        return null;
    } catch (error) {
        console.error("Error getting user profile:", error);
        throw error;
    }
};

export const updateUserProfile = async (userId: string, data: { name: string; location: string; phoneNumber?: string }): Promise<void> => {
    try {
        const userRef = firestore.collection('users').doc(userId);
        
        // 1. Update the main user profile document
        await userRef.update({
            name: data.name,
            location: data.location,
            phoneNumber: data.phoneNumber || '',
        });

        // 2. Propagate changes to all of the user's listings (denormalization)
        const listingUpdates = {
            farmerName: data.name,
            location: data.location,
            farmerPhoneNumber: data.phoneNumber || '',
        };
        await updateFarmerInfoOnListings(userId, listingUpdates);

    } catch (error) {
        console.error("Error updating user profile and listings:", error);
        throw new Error("Failed to update profile.");
    }
};

export const updateUserFeatures = async (userId: string, features: ActiveView[]): Promise<void> => {
    try {
        const userRef = firestore.collection('users').doc(userId);
        await userRef.update({
            enabledFeatures: features,
        });
    } catch (error) {
        console.error("Error updating user features:", error);
        throw new Error("Failed to update features.");
    }
};


/**
 * Fetches a list of all farmer profiles from the 'users' collection.
 * @returns A promise that resolves to an array of FarmerProfile objects.
 */
export const getAllFarmers = async (): Promise<FarmerProfile[]> => {
    try {
        const usersCollection = firestore.collection('users').where('role', '==', 'farmer');
        const snapshot = await usersCollection.get();
        const farmers = snapshot.docs
            .map(doc => {
                const data = doc.data();
                return {
                    uid: doc.id,
                    email: data.email,
                    role: 'farmer' as const,
                    name: data.name || '',
                    location: data.location || '',
                };
            });
        return farmers;
    } catch (error) {
        console.error("Error fetching farmers:", error);
        throw new Error("Failed to fetch farmer directory.");
    }
};

export const updateUserPreferences = async (userId: string, preferences: { smartAutomationEnabled?: boolean }): Promise<void> => {
    try {
        const userRef = firestore.collection('users').doc(userId);
        await userRef.update(preferences);
    } catch (error) {
        console.error("Error updating user preferences:", error);
        throw new Error("Failed to update user preferences.");
    }
};
