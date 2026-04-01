import { firestore } from './firebase';
import type { Zone } from '../types';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const getZonesCollection = (userId: string) => 
    firestore.collection('users').doc(userId).collection('irrigationZones');

export const addIrrigationZone = async (userId: string, zoneData: Omit<Zone, 'id'>): Promise<void> => {
    try {
        await getZonesCollection(userId).add({
            ...zoneData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        console.error("Error adding irrigation zone:", error);
        throw new Error("Failed to add zone to the database.");
    }
};

export const onIrrigationZonesSnapshot = (
    userId: string, 
    callback: (zones: Zone[]) => void,
    onError: (error: Error) => void
): (() => void) => {
    const query = getZonesCollection(userId).orderBy('createdAt', 'asc');

    return query.onSnapshot(
        (querySnapshot) => {
            const zones = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            } as Zone));
            callback(zones);
        },
        (error) => {
            console.error("Error fetching real-time zones:", error);
            onError(new Error("Failed to fetch irrigation zones."));
        }
    );
};

export const updateIrrigationZone = async (userId: string, zoneId: string, dataToUpdate: Partial<Omit<Zone, 'id'>>): Promise<void> => {
    try {
        await getZonesCollection(userId).doc(zoneId).update(dataToUpdate);
    } catch (error) {
        console.error("Error updating zone:", error);
        throw new Error("Failed to update zone.");
    }
};

export const deleteIrrigationZone = async (userId: string, zoneId: string): Promise<void> => {
    try {
        await getZonesCollection(userId).doc(zoneId).delete();
    } catch (error) {
        console.error("Error deleting zone:", error);
        throw new Error("Failed to delete the zone.");
    }
};
