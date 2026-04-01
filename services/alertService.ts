import { firestore } from './firebase';
import type { Alert, ActiveView } from '../types';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

/**
 * Creates or updates an alert for a user.
 * It uses a specific document ID to prevent duplicate alerts for the same event.
 * @param userId The UID of the user.
 * @param alertData The core alert data (type, severity, message).
 * @param relatedView The view the alert links to.
 * @param relatedEntityId A unique identifier for the alert's subject (e.g., location or crop name).
 */
export const createAlert = async (
    userId: string,
    alertData: Omit<Alert, 'id' | 'uid' | 'status' | 'createdAt' | 'relatedView' | 'relatedEntityId'>,
    relatedView: ActiveView,
    relatedEntityId: string
): Promise<void> => {
    try {
        // Sanitize entity ID to be Firestore-safe
        const docId = `${alertData.type}_${relatedEntityId.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const alertRef = firestore.collection('users').doc(userId).collection('alerts').doc(docId);

        await alertRef.set({
            ...alertData,
            uid: userId,
            status: 'unread',
            relatedView,
            relatedEntityId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }); // Use merge to avoid overwriting status if it's already 'read'

    } catch (error) {
        console.error("Error creating alert:", error);
        throw new Error("Failed to create alert.");
    }
};

/**
 * Sets up a real-time listener for a user's unread alerts.
 * @param userId The UID of the user.
 * @param callback The function to call with the updated alerts list.
 * @returns An unsubscribe function to detach the listener.
 */
export const onAlertsSnapshot = (
    userId: string,
    callback: (alerts: Alert[]) => void
): (() => void) => {
    const alertsCollection = firestore.collection('users').doc(userId).collection('alerts');
    const query = alertsCollection
        .where('status', '==', 'unread');

    return query.onSnapshot(
        (querySnapshot) => {
            const alerts = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
            } as Alert));
            // Sort alerts on the client to ensure the newest ones appear first.
            alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            callback(alerts);
        },
        (error) => {
            console.error("Error fetching real-time alerts:", error);
        }
    );
};

/**
 * Marks a specific alert as read.
 * @param userId The UID of the user.
 * @param alertId The ID of the alert to update.
 */
export const markAlertAsRead = async (userId: string, alertId: string): Promise<void> => {
    try {
        const alertRef = firestore.collection('users').doc(userId).collection('alerts').doc(alertId);
        await alertRef.update({ status: 'read' });
    } catch (error) {
        console.error("Error marking alert as read:", error);
        throw new Error("Failed to update alert status.");
    }
};
