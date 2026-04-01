import { firestore } from './firebase';
import type { AgriSwapListing, AgriSwapDealRequest, FarmerProfile, FinalizedAgriSwapDeal } from '../types';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

export const addAgriSwapListing = async (listingData: Omit<AgriSwapListing, 'id' | 'createdAt' | 'status'>): Promise<void> => {
    try {
        const listingRef = firestore.collection('barterListings').doc();
        await listingRef.set({
            ...listingData,
            status: 'active',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        console.error("Error adding barter listing:", error);
        throw new Error("Failed to add barter listing to the database.");
    }
};

export const onAgriSwapListingsSnapshot = (callback: (listings: AgriSwapListing[]) => void): () => void => {
    const q = firestore.collection('barterListings')
        .where('status', '==', 'active');

    return q.onSnapshot(snapshot => {
        const listings = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
            } as AgriSwapListing;
        });
        listings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        callback(listings);
    }, (error) => {
        console.error("Error fetching real-time barter listings:", error);
    });
};

export const updateAgriSwapListing = async (listingId: string, dataToUpdate: Partial<Omit<AgriSwapListing, 'id' | 'createdAt'>>): Promise<void> => {
    try {
        await firestore.collection('barterListings').doc(listingId).update(dataToUpdate);
    } catch (error) {
        console.error("Error updating barter listing:", error);
        throw new Error("Failed to update barter listing.");
    }
};

export const updateAgriSwapListingStatus = async (listingId: string, status: AgriSwapListing['status']): Promise<void> => {
    try {
        await firestore.collection('barterListings').doc(listingId).update({ status });
    } catch (error) {
        console.error("Error updating barter listing status:", error);
        throw new Error("Failed to update listing status.");
    }
};

export const deleteAgriSwapListing = async (listingId: string): Promise<void> => {
    try {
        await firestore.collection('barterListings').doc(listingId).delete();
    } catch (error) {
        console.error("Error deleting barter listing:", error);
        throw new Error("Failed to delete the barter listing.");
    }
};

// --- New Request/Approval Flow ---

export const sendAgriSwapDealRequest = async (listing: AgriSwapListing, requester: Omit<FarmerProfile, 'uid' | 'email'>, requesterUid: string, requesterEmail: string): Promise<void> => {
    const requestData: Omit<AgriSwapDealRequest, 'id' | 'createdAt'> = {
        listingId: listing.id,
        listerUid: listing.farmerUid,
        requesterUid,
        requesterEmail,
        requesterName: requester.name || requesterEmail.split('@')[0],
        requesterLocation: requester.location || 'Unknown',
        status: 'pending',
        listingOfferItemName: listing.offerItemName,
    };
    
    try {
        await firestore.collection('barterRequests').add({
            ...requestData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        console.error("Error sending barter deal request:", error);
        throw new Error("Failed to send the trade request.");
    }
};

export const respondToAgriSwapRequest = async (request: AgriSwapDealRequest, action: 'accepted' | 'rejected'): Promise<void> => {
    return firestore.runTransaction(async (transaction) => {
        const listingRef = firestore.collection('barterListings').doc(request.listingId);
        const requestRef = firestore.collection('barterRequests').doc(request.id);

        const listingDoc = await transaction.get(listingRef);
        if (!listingDoc.exists || listingDoc.data()?.status !== 'active') {
            throw new Error("This listing is no longer available for trade.");
        }

        const lister = listingDoc.data() as AgriSwapListing;

        if (action === 'accepted') {
            transaction.update(listingRef, { status: 'traded' });
            transaction.update(requestRef, { status: 'accepted' });

            // Create notification for the requester
            const notificationRef = firestore.collection('finalizedBarterDeals').doc();
            transaction.set(notificationRef, {
                recipientUid: request.requesterUid,
                message: `${lister.farmerName} from ${lister.location} accepted your trade request for ${lister.offerItemName}.`,
                listingId: request.listingId,
                status: 'unread',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
        } else { // rejected
            transaction.update(requestRef, { status: 'rejected' });
        }
    });
};


export const onSentAgriSwapRequestsSnapshot = (userId: string, callback: (requests: AgriSwapDealRequest[]) => void): () => void => {
    const q = firestore.collection('barterRequests')
        .where('requesterUid', '==', userId)
        .where('status', '==', 'pending');

    return q.onSnapshot(snapshot => {
        const requests = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data as Omit<AgriSwapDealRequest, 'id'>,
                createdAt: data.createdAt?.toDate() || new Date(),
            }
        });
        callback(requests);
    });
};

export const onPendingAgriSwapRequestsSnapshot = (userId: string, callback: (requests: AgriSwapDealRequest[]) => void): () => void => {
    const q = firestore.collection('barterRequests')
        .where('listerUid', '==', userId)
        .where('status', '==', 'pending');

    return q.onSnapshot(snapshot => {
        const requests = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data as Omit<AgriSwapDealRequest, 'id'>,
                createdAt: data.createdAt?.toDate() || new Date(),
            }
        });
        requests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        callback(requests);
    });
};

export const onFinalizedAgriSwapDealsSnapshot = (userId: string, callback: (deals: FinalizedAgriSwapDeal[]) => void): () => void => {
    const q = firestore.collection('finalizedBarterDeals')
        .where('recipientUid', '==', userId)
        .where('status', '==', 'unread');

    return q.onSnapshot(snapshot => {
        const deals = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data as Omit<FinalizedAgriSwapDeal, 'id'>,
                createdAt: data.createdAt?.toDate() || new Date(),
            }
        });
        deals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        callback(deals);
    });
};


export const updateFinalizedAgriSwapDealStatus = async (dealId: string, status: 'read'): Promise<void> => {
    try {
        await firestore.collection('finalizedBarterDeals').doc(dealId).update({ status });
    } catch (error) {
        console.error("Error updating finalized deal status:", error);
        throw new Error("Failed to update notification.");
    }
};
