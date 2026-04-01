import { firestore } from './firebase';
import type { DealRequest, ProductListing, NegotiationTerms, NegotiationChat, NegotiationChatMessage, NegotiationResponse, DealNotification, CSATier, CSASubscription, FarmerProfile, RetailOrder, DynamicSubscriptionPreferences, WeeklyProduceItem, WeeklyAvailability, CuratedItem, FarmerChatMessage } from '../types';
import { getOpeningOffer, getNextNegotiationStep } from './geminiService';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

/** Shape of an inquiry message from Firestore */
interface InquiryMessage {
  id: string;
  senderUid: string;
  text: string;
  timestamp: Date;
}

/** Shape of an inquiry chat metadata from Firestore */
interface InquiryChat {
  id: string;
  listingId: string;
  farmerUid: string;
  customerUid: string;
  customerEmail: string;
  customerName: string;
  listingInfo: {
    cropName: string;
    farmerName: string;
    farmerPhoneNumber: string;
    imageUrl: string;
    price: number;
    currency: string;
    unit: string;
  };
  lastMessage: string;
  updatedAt: firebase.firestore.Timestamp | null;
  createdAt: firebase.firestore.Timestamp | null;
}

export const sendDealRequest = async (listing: ProductListing, customerEmail: string): Promise<void> => {
    const dealRef = firestore.collection('deals').doc();
    const { farmerUid, id, ...productData } = listing;
    await dealRef.set({
        farmerUid: listing.farmerUid,
        customerEmail,
        product: productData,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
};

// --- Customer Inquiry Chat Services (Human to Human) ---

export const startInquiryChat = async (listing: ProductListing, customer: FarmerProfile): Promise<string> => {
    const chatId = `inquiry_${listing.id}_${customer.uid}`;
    const chatRef = firestore.collection('inquiryChats').doc(chatId);
    const chatDoc = await chatRef.get();

    if (!chatDoc.exists) {
        await chatRef.set({
            listingId: listing.id,
            farmerUid: listing.farmerUid,
            customerUid: customer.uid,
            customerEmail: customer.email,
            customerName: customer.name || customer.email.split('@')[0],
            listingInfo: {
                cropName: listing.cropName,
                farmerName: listing.farmerName,
                farmerPhoneNumber: listing.farmerPhoneNumber || '',
                imageUrl: listing.imageUrl,
                price: listing.price,
                currency: listing.currency,
                unit: listing.unit
            },
            lastMessage: "New inquiry started",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    }
    return chatId;
};

export const sendInquiryMessage = async (chatId: string, senderUid: string, text: string): Promise<void> => {
    const chatRef = firestore.collection('inquiryChats').doc(chatId);
    const messageRef = chatRef.collection('messages').doc();
    
    const timestamp = firebase.firestore.FieldValue.serverTimestamp();
    
    await messageRef.set({
        senderUid,
        text,
        timestamp
    });

    await chatRef.update({
        lastMessage: text,
        updatedAt: timestamp
    });
};

export const onInquiryMessagesSnapshot = (chatId: string, callback: (messages: InquiryMessage[]) => void): () => void => {
    return firestore.collection('inquiryChats').doc(chatId).collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            const messages: InquiryMessage[] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    senderUid: data.senderUid || '',
                    text: data.text || '',
                    timestamp: data.timestamp?.toDate() || new Date(),
                } as InquiryMessage;
            });
            callback(messages);
        });
};

export const onCustomerInquiriesSnapshot = (email: string, callback: (chats: InquiryChat[]) => void): () => void => {
    return firestore.collection('inquiryChats')
        .where('customerEmail', '==', email)
        .onSnapshot(snapshot => {
            const chats: InquiryChat[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InquiryChat));
            chats.sort((a, b) => (b.updatedAt?.toDate().getTime() || 0) - (a.updatedAt?.toDate().getTime() || 0));
            callback(chats);
        });
};

export const onFarmerInquiriesSnapshot = (uid: string, callback: (chats: InquiryChat[]) => void): () => void => {
    return firestore.collection('inquiryChats')
        .where('farmerUid', '==', uid)
        .onSnapshot(snapshot => {
            const chats: InquiryChat[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InquiryChat));
            chats.sort((a, b) => (b.updatedAt?.toDate().getTime() || 0) - (a.updatedAt?.toDate().getTime() || 0));
            callback(chats);
        });
};

// --- Rest of existing service ---

export const onDealRequestsSnapshot = (userId: string, callback: (requests: DealRequest[]) => void): () => void => {
    const q = firestore.collection('deals')
        .where('farmerUid', '==', userId);

    return q.onSnapshot(snapshot => {
        const requests = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
            } as DealRequest;
        })
        .filter(deal => deal.status === 'pending')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        callback(requests);
    });
};

export const updateDealRequestStatus = async (dealId: string, status: 'read'): Promise<void> => {
    const dealRef = firestore.collection('deals').doc(dealId);
    await dealRef.update({ status });
};

export const addListing = async (listingData: Omit<ProductListing, 'id' | 'createdAt' | 'farmerUid' | 'farmerEmail' | 'imageUrl' | 'farmerName' | 'location' | 'farmerPhoneNumber'>, farmer: {uid: string, email: string, name: string, location: string, phoneNumber?: string}): Promise<void> => {
    const productRef = firestore.collection('products').doc();
    const imageUrl = '';
    
    const dataToSet: Omit<ProductListing, 'id' | 'createdAt'> = {
        ...listingData,
        farmerUid: farmer.uid,
        farmerEmail: farmer.email,
        farmerName: farmer.name,
        location: farmer.location,
        farmerPhoneNumber: farmer.phoneNumber || '',
        imageUrl,
        price: listingData.listingType === 'retail' ? listingData.price : (listingData.targetPrice || listingData.price),
    };

    await productRef.set({
        ...dataToSet,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
};

export const onProductsSnapshot = (callback: (listings: ProductListing[]) => void): () => void => {
    const q = firestore.collection('products').orderBy('createdAt', 'desc');

    return q.onSnapshot(snapshot => {
        const listings = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
            } as ProductListing;
        });
        callback(listings);
    }, (error) => {
        console.error("Error fetching real-time products:", error);
    });
};

export const updateListing = async (listingId: string, data: Partial<Omit<ProductListing, 'id' | 'farmerUid' | 'farmerEmail' | 'imageUrl' | 'createdAt'>>): Promise<void> => {
    try {
        const productRef = firestore.collection('products').doc(listingId);
        await productRef.update(data);
    } catch (error) {
        console.error("Error updating listing:", error);
        throw new Error("Failed to update the listing.");
    }
};

export const deleteNegotiableListing = async (listingId: string): Promise<void> => {
    try {
        const productRef = firestore.collection('products').doc(listingId);
        await productRef.delete();
    } catch (error) {
        console.error("Error deleting listing:", error);
        throw new Error("Failed to delete the listing.");
    }
};

export const createRetailOrder = async (listing: ProductListing, quantity: number, customer: { email: string, name: string, location: string }): Promise<void> => {
    const productRef = firestore.collection('products').doc(listing.id);
    const orderRef = firestore.collection('retailOrders').doc();

    return firestore.runTransaction(async (transaction) => {
        const productDoc = await transaction.get(productRef);
        if (!productDoc.exists) {
            throw new Error("Product does not exist.");
        }

        const currentData = productDoc.data() as ProductListing;
        if (currentData.quantity < quantity) {
            throw new Error(`Not enough stock available. Only ${currentData.quantity} ${currentData.unit} left.`);
        }

        const newStock = currentData.quantity - quantity;
        transaction.update(productRef, { quantity: newStock });

        const orderData: Omit<RetailOrder, 'id' | 'createdAt'> = {
            farmerUid: listing.farmerUid,
            customerEmail: customer.email,
            customerName: customer.name,
            customerLocation: customer.location,
            listingId: listing.id,
            productName: listing.cropName,
            quantityBought: quantity,
            unit: listing.unit,
            pricePerUnit: listing.price,
            totalPrice: listing.price * quantity,
            currency: listing.currency,
            status: 'new'
        };

        transaction.set(orderRef, {
            ...orderData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    });
};

export const cancelRetailOrder = async (order: { id: string, listingId: string, quantityBought: number, farmerUid: string, productName: string }): Promise<void> => {
    const orderRef = firestore.collection('retailOrders').doc(order.id);
    const productRef = firestore.collection('products').doc(order.listingId);
    const notificationRef = firestore.collection('notifications').doc();

    return firestore.runTransaction(async (transaction) => {
        const orderDoc = await transaction.get(orderRef);
        const productDoc = await transaction.get(productRef);
        
        if (!orderDoc.exists) {
            throw new Error("Order not found.");
        }

        const orderData = orderDoc.data() as RetailOrder;
        if (orderData.status !== 'new') {
            throw new Error(`This order cannot be cancelled as its status is '${orderData.status}'.`);
        }

        transaction.update(orderRef, { status: 'cancelled' });

        if (productDoc.exists) {
            transaction.update(productRef, {
                quantity: firebase.firestore.FieldValue.increment(order.quantityBought)
            });
        }
        
        const message = `Order #${order.id.substring(0, 5)} for ${order.quantityBought} ${orderData.unit} of ${order.productName} has been cancelled by the customer. Stock has been updated.`;
        transaction.set(notificationRef, {
            farmerUid: order.farmerUid,
            message: message,
            listingId: order.listingId,
            status: 'unread',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    });
};

export const updateRetailOrderStatus = async (orderId: string, status: 'processing' | 'shipped'): Promise<void> => {
    try {
        const orderRef = firestore.collection('retailOrders').doc(orderId);
        await orderRef.update({ status });
    } catch (error) {
        console.error("Error updating retail order status:", error);
        throw new Error("Failed to update order status.");
    }
};


// --- Negotiation Chat Services ---

export const startNegotiationChat = async (listing: ProductListing, customer: FarmerProfile, language?: string): Promise<string> => {
    const chatId = `${listing.id}_${customer.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const chatRef = firestore.collection('negotiationChats').doc(chatId);
    const chatDoc = await chatRef.get();

    if (!chatDoc.exists) {
        await chatRef.set({
            listingId: listing.id,
            farmerUid: listing.farmerUid,
            customerEmail: customer.email,
            customerName: customer.name || customer.email.split('@')[0],
            customerLocation: customer.location || 'Unknown',
            listingInfo: {
                cropName: listing.cropName,
                farmerName: listing.farmerName,
                imageUrl: listing.imageUrl,
            },
            status: 'active',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

        const openingMessage = await getOpeningOffer({
            crop: listing.cropName,
            quantity: listing.quantity,
            unit: listing.unit,
            targetPrice: listing.targetPrice!,
            lowestPrices: listing.lowestPrices!,
            farmerName: listing.farmerName,
            location: listing.location,
            currency: listing.currency,
        }, language);

        await chatRef.collection('messages').add({
            role: 'user', 
            content: openingMessage,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });
    }
    return chatId;
};

export const onNegotiationChatSnapshot = (chatId: string, callback: (chat: NegotiationChat | null) => void): (() => void) => {
    return firestore.collection('negotiationChats').doc(chatId)
        .onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data() || {};
                callback({
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    updatedAt: data.updatedAt?.toDate() || new Date(),
                } as NegotiationChat);
            } else {
                callback(null);
            }
        });
};


export const onNegotiationMessagesSnapshot = (chatId: string, callback: (messages: NegotiationChatMessage[]) => void): () => void => {
    return firestore.collection('negotiationChats').doc(chatId).collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            const messages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date(),
            } as NegotiationChatMessage));
            callback(messages);
        });
};

export const postCustomerMessageAndGetResponse = async (chatId: string, listing: ProductListing, customerMessage: string, currentHistory: NegotiationChatMessage[], language?: string): Promise<void> => {
    const messagesRef = firestore.collection('negotiationChats').doc(chatId).collection('messages');

    await messagesRef.add({
        role: 'model', 
        content: customerMessage,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
    
    const apiHistory = currentHistory.map(m => ({ role: m.role, content: m.content }));
     apiHistory.push({ role: 'model', content: customerMessage });

    const listingData = {
        crop: listing.cropName,
        quantity: listing.quantity,
        unit: listing.unit,
        targetPrice: listing.targetPrice ?? 0,
        lowestPrices: listing.lowestPrices ?? [],
        farmerName: listing.farmerName,
        location: listing.location,
        currency: listing.currency,
    };

    const response = await getNextNegotiationStep(listingData, apiHistory, language);

    await messagesRef.add({
        role: 'user',
        content: response.suggestion,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });

    if (response.isDealClose && response.dealSummary) {
        const chatRef = firestore.collection('negotiationChats').doc(chatId);
        await chatRef.update({
            status: 'awaiting-authorization',
            proposedDeal: response.dealSummary,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    }
};

const finalizeDealAndNotifyFarmer = async (chatId: string, listing: ProductListing, dealSummary: NonNullable<NegotiationResponse['dealSummary']>) => {
    const chatRef = firestore.collection('negotiationChats').doc(chatId);
    await chatRef.update({
        status: 'deal-made',
        dealSummary: dealSummary,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    const notificationRef = firestore.collection('notifications').doc();
    const finalPrice = dealSummary.finalPrice ?? 0;
    const message = `Your AI agent closed a deal for ${dealSummary.quantity} ${dealSummary.unit} of ${dealSummary.crop} at ${finalPrice.toFixed(2)} ${dealSummary.currency}/${dealSummary.unit}.`;
    await notificationRef.set({
        farmerUid: listing.farmerUid,
        message: message,
        listingId: listing.id,
        status: 'unread',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    const productRef = firestore.collection('products').doc(listing.id);
    await productRef.delete();
};


export const customerAuthorizeDeal = async (chatId: string, listing: ProductListing): Promise<void> => {
    const chatRef = firestore.collection('negotiationChats').doc(chatId);
    const chatDoc = await chatRef.get();
    if (!chatDoc.exists) throw new Error("Chat not found.");
    const chatData = chatDoc.data() as NegotiationChat;

    if (chatData.status !== 'awaiting-authorization' || !chatData.proposedDeal) {
        throw new Error("No deal is currently proposed for authorization.");
    }

    const messagesRef = firestore.collection('negotiationChats').doc(chatId).collection('messages');
    await messagesRef.add({
        role: 'model', 
        content: 'I agree to these terms. The deal is authorized.',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });

    await finalizeDealAndNotifyFarmer(chatId, listing, chatData.proposedDeal);
};


export const onDealNotificationsSnapshot = (userId: string, callback: (notifications: DealNotification[]) => void): () => void => {
    const q = firestore.collection('notifications')
        .where('farmerUid', '==', userId)
        .where('status', '==', 'unread');

    return q.onSnapshot(snapshot => {
        const notifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
        } as DealNotification));
        notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        callback(notifications);
    });
};

export const updateDealNotificationStatus = async (notificationId: string, status: 'read'): Promise<void> => {
    await firestore.collection('notifications').doc(notificationId).update({ status });
};

export const onDealsForCustomerSnapshot = (
    customerEmail: string, 
    callback: (deals: NegotiationChat[]) => void,
    onError: (error: Error) => void
): (() => void) => {
    const q = firestore.collection('negotiationChats')
        .where('customerEmail', '==', customerEmail)
        .where('status', '==', 'deal-made');

    return q.onSnapshot(
        (querySnapshot) => {
            const deals = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    updatedAt: data.updatedAt?.toDate() || new Date(),
                } as NegotiationChat;
            });
            deals.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
            callback(deals);
        },
        (error) => {
            console.error("Error fetching customer deals:", error);
            onError(new Error("Failed to fetch your past deals."));
        }
    );
};

export const onActiveNegotiationsForCustomerSnapshot = (
    customerEmail: string,
    callback: (deals: NegotiationChat[]) => void,
    onError: (error: Error) => void
): (() => void) => {
    const q = firestore.collection('negotiationChats')
        .where('customerEmail', '==', customerEmail)
        .where('status', 'in', ['active', 'awaiting-authorization']);

    return q.onSnapshot(
        (querySnapshot) => {
            const deals = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    updatedAt: data.updatedAt?.toDate() || new Date(),
                } as NegotiationChat;
            });
            deals.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
            callback(deals);
        },
        (error) => {
            console.error("Error fetching customer negotiations:", error);
            onError(new Error("Failed to fetch your active negotiations."));
        }
    );
};

export const onRetailOrdersForCustomerSnapshot = (
    customerEmail: string,
    callback: (orders: RetailOrder[]) => void,
    onError: (error: Error) => void
): (() => void) => {
    const q = firestore.collection('retailOrders')
        .where('customerEmail', '==', customerEmail);

    return q.onSnapshot(
        (snapshot) => {
            const orders = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate() || new Date(),
                } as RetailOrder;
            });
            orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            callback(orders);
        },
        (error) => {
            console.error("Error fetching retail orders:", error);
            onError(new Error("Failed to fetch your retail orders."));
        }
    );
};

export const onRetailOrdersForFarmerSnapshot = (
    farmerUid: string,
    callback: (orders: RetailOrder[]) => void,
    onError: (error: Error) => void
): (() => void) => {
    const q = firestore.collection('retailOrders')
        .where('farmerUid', '==', farmerUid);

    return q.onSnapshot(
        (snapshot) => {
            const orders = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate() || new Date(),
                } as RetailOrder;
            });
            orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            callback(orders);
        },
        (error) => {
            console.error("Error fetching retail orders for farmer:", error);
            onError(new Error("Failed to fetch retail orders."));
        }
    );
};

export const onNegotiatedDealsForFarmerSnapshot = (
    farmerUid: string,
    callback: (deals: NegotiationChat[]) => void,
    onError: (error: Error) => void
): (() => void) => {
    const q = firestore.collection('negotiationChats')
        .where('farmerUid', '==', farmerUid)
        .where('status', '==', 'deal-made');

    return q.onSnapshot(
        (querySnapshot) => {
            const deals = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    updatedAt: data.updatedAt?.toDate() || new Date(),
                } as NegotiationChat;
            });
            deals.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
            callback(deals);
        },
        (error) => {
            console.error("Error fetching negotiated deals for farmer:", error);
            onError(new Error("Failed to fetch negotiated deals."));
        }
    );
};



// --- CSA Management Services ---

export const onCSATiersForFarmerSnapshot = (farmerUid: string, callback: (tiers: CSATier[]) => void): () => void => {
    const q = firestore.collection('csaTiers').where('farmerUid', '==', farmerUid);
    return q.onSnapshot(snapshot => {
        const tiers = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
            } as CSATier
        });
        tiers.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        callback(tiers);
    });
};

export const onAllCSATiersSnapshot = (callback: (tiers: CSATier[]) => void): () => void => {
    const q = firestore.collection('csaTiers').orderBy('createdAt', 'desc');
    return q.onSnapshot(snapshot => {
        const tiers = snapshot.docs.map(doc => {
             const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
            } as CSATier
        });
        callback(tiers);
    });
};

export const createOrUpdateCSATier = async (farmerUid: string, tierData: Omit<CSATier, 'id' | 'createdAt' | 'farmerUid'>, tierId?: string): Promise<void> => {
    const collectionRef = firestore.collection('csaTiers');
    const docRef = tierId ? collectionRef.doc(tierId) : collectionRef.doc();
    
    const cleanTierData = { ...tierData };
    if (cleanTierData.type === 'dynamic') {
        delete cleanTierData.items;
    } else {
        cleanTierData.items = cleanTierData.items || [];
    }
    
    const data = {
        ...cleanTierData,
        farmerUid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (tierId) {
        const { createdAt, ...updateData } = data;
        await docRef.update(updateData);
    } else {
        await docRef.set(data);
    }
};

export const deleteCSATier = async (tierId: string): Promise<void> => {
    await firestore.collection('csaTiers').doc(tierId).delete();
};

export const onCSASubscribersForFarmerSnapshot = (farmerUid: string, callback: (subscribers: CSASubscription[]) => void): () => void => {
    const q = firestore.collection('csaSubscriptions').where('farmerUid', '==', farmerUid);
    return q.onSnapshot(snapshot => {
        const subscribers = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                subscribedAt: data.subscribedAt?.toDate() || new Date(),
            } as CSASubscription
        });
        subscribers.sort((a, b) => b.subscribedAt.getTime() - a.subscribedAt.getTime());
        callback(subscribers);
    });
};

export const createCSASubscription = async (tier: CSATier, customer: FarmerProfile, preferences?: DynamicSubscriptionPreferences): Promise<void> => {
    const subRef = firestore.collection('csaSubscriptions').doc();
    const subscriptionData: Partial<CSASubscription> = {
        tierId: tier.id,
        farmerUid: tier.farmerUid,
        customerEmail: customer.email,
        customerName: customer.name || customer.email.split('@')[0],
        status: 'active',
        tierInfo: {
            name: tier.name,
            price: tier.price,
            currency: tier.currency,
            frequency: tier.frequency,
            farmerName: tier.farmerName,
            type: tier.type,
        }
    };

    if (tier.type === 'dynamic' && preferences) {
        subscriptionData.preferences = preferences;
    }

    await subRef.set({
        ...subscriptionData,
        subscribedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
};

export const cancelCSASubscription = async (subscriptionId: string): Promise<void> => {
    await firestore.collection('csaSubscriptions').doc(subscriptionId).delete();
};

export const onCSASubscriptionsForCustomerSnapshot = (customerEmail: string, callback: (subscriptions: CSASubscription[]) => void): () => void => {
    const q = firestore.collection('csaSubscriptions').where('customerEmail', '==', customerEmail);
    return q.onSnapshot(snapshot => {
        const subscriptions = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                subscribedAt: data.subscribedAt?.toDate() || new Date(),
            } as CSASubscription;
        });
        subscriptions.sort((a, b) => b.subscribedAt.getTime() - a.subscribedAt.getTime());
        callback(subscriptions);
    });
};

export const onWeeklyAvailabilitySnapshot = (farmerUid: string, callback: (availability: WeeklyAvailability) => void): () => void => {
    const docRef = firestore.collection('weeklyAvailability').doc(farmerUid);
    return docRef.onSnapshot(doc => {
        if (doc.exists) {
            callback({ id: doc.id, ...doc.data() } as WeeklyAvailability);
        } else {
            callback({ id: farmerUid, items: [] });
        }
    });
};

export const updateWeeklyAvailability = async (farmerUid: string, items: WeeklyProduceItem[]): Promise<void> => {
    const docRef = firestore.collection('weeklyAvailability').doc(farmerUid);
    const cleanItems = items.map(item => ({
        ...item,
        id: item.id || firestore.collection('weeklyAvailability').doc().id,
    }));
    await docRef.set({ id: farmerUid, items: cleanItems });
};

export const updateSubscriberCuratedItems = async (subscriptionId: string, weekId: string, items: CuratedItem[]): Promise<void> => {
    const subRef = firestore.collection('csaSubscriptions').doc(subscriptionId);
    await subRef.update({
        [`curatedItems.${weekId}`]: items
    });
};

export const updateSubscriptionPreferences = async (subscriptionId: string, preferences: DynamicSubscriptionPreferences): Promise<void> => {
    const subRef = firestore.collection('csaSubscriptions').doc(subscriptionId);
    await subRef.update({ preferences });
};

export const updateFarmerInfoOnListings = async (
    farmerUid: string,
    updates: { farmerName?: string; location?: string; farmerPhoneNumber?: string }
): Promise<void> => {
    const batch = firestore.batch();
    const cleanUpdates = JSON.parse(JSON.stringify(updates));

    if (Object.keys(cleanUpdates).length === 0) {
        return; 
    }

    const productsQuery = firestore.collection('products').where('farmerUid', '==', farmerUid);
    const productsSnapshot = await productsQuery.get();
    productsSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, cleanUpdates);
    });

    const barterQuery = firestore.collection('barterListings').where('farmerUid', '==', farmerUid);
    const barterSnapshot = await barterQuery.get();
    barterSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, cleanUpdates);
    });

    await batch.commit();
};
