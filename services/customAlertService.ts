import { firestore } from './firebase';
import type { CustomAlert } from '../types';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

export const createCustomAlert = async (userId: string, alertData: Omit<CustomAlert, 'id' | 'uid' | 'status' | 'createdAt'>): Promise<void> => {
    try {
        const alertsCollection = firestore.collection('users').doc(userId).collection('customAlerts');
        await alertsCollection.add({
            ...alertData,
            uid: userId,
            status: 'active',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        console.error("Error creating custom alert:", error);
        throw new Error("Failed to save custom alert.");
    }
};

export const onCustomAlertsSnapshot = (userId: string, callback: (alerts: CustomAlert[]) => void): (() => void) => {
    const alertsCollection = firestore.collection('users').doc(userId).collection('customAlerts');
    const query = alertsCollection.orderBy('createdAt', 'desc');

    return query.onSnapshot(
        (querySnapshot) => {
            const alerts = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
            } as CustomAlert));
            callback(alerts);
        },
        (error) => {
            console.error("Error fetching custom alerts:", error);
        }
    );
};

export const deleteCustomAlert = async (userId: string, alertId: string): Promise<void> => {
    try {
        const alertDocRef = firestore.collection('users').doc(userId).collection('customAlerts').doc(alertId);
        await alertDocRef.delete();
    } catch (error) {
        console.error("Error deleting custom alert:", error);
        throw new Error("Failed to delete the custom alert.");
    }
};
