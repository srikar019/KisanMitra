import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { onActiveNegotiationsForCustomerSnapshot } from '../services/marketplaceService';
import { NegotiationChat, ProductListing } from '../types';
import Card from './common/Card';
import Icon from './common/Icon';
import Spinner from './common/Spinner';

interface NegotiationListProps {
    onStartNegotiation: (listing: ProductListing, customerEmail: string) => void;
    allListings: ProductListing[];
}

const NegotiationList: React.FC<NegotiationListProps> = ({ onStartNegotiation, allListings }) => {
    const { currentUser } = useAuth();
    const { showToast } = useToast();
    const [negotiations, setNegotiations] = useState<NegotiationChat[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (currentUser?.email) {
            setLoading(true);
            const unsubscribe = onActiveNegotiationsForCustomerSnapshot(
                currentUser.email,
                (fetchedDeals) => {
                    setNegotiations(fetchedDeals);
                    setLoading(false);
                },
                (err) => {
                    setError(err.message);
                    setLoading(false);
                }
            );
            return () => unsubscribe();
        } else {
            setLoading(false);
        }
    }, [currentUser]);

    const handleOpenChat = (negotiation: NegotiationChat) => {
        const realListing = allListings.find(l => l.id === negotiation.listingId);
        if (realListing) {
            onStartNegotiation(realListing, negotiation.customerEmail);
        } else {
            showToast('This listing is no longer active on the marketplace.', 'warning');
        }
    };

    return (
        <Card>
             <div className="flex items-center mb-6">
                <Icon name="chat-bubble-left-right" className="h-8 w-8 text-cyan-500 mr-3" />
                <h2 className="text-2xl font-bold text-gray-700">Active Negotiations</h2>
            </div>
            <p className="text-gray-600 mb-6">Here are your ongoing conversations with farmer AI agents.</p>

            {loading ? (
                <div className="flex justify-center items-center h-48"><Spinner /></div>
            ) : error ? (
                <p className="text-red-500 text-center">{error}</p>
            ) : negotiations.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-lg border">
                    <Icon name="chat-bubble-left-right" className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700">No Active Negotiations</h3>
                    <p className="text-gray-500 mt-2">Start a negotiation from the marketplace to see it here.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {negotiations.map(nego => {
                        const cropName = nego.listingInfo?.cropName || 'Product';
                        return (
                            <div
                                key={nego.id}
                                className="bg-white p-4 rounded-lg border flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => handleOpenChat(nego)}
                            >
                                <img 
                                    src={nego.listingInfo?.imageUrl || `https://ui-avatars.com/api/?name=${cropName.charAt(0)}&background=random&color=fff`} 
                                    alt={cropName} 
                                    className="w-16 h-16 object-cover rounded-md flex-shrink-0 bg-gray-200" 
                                />
                                <div className="flex-grow">
                                    <h3 className="font-bold text-gray-800">{nego.listingInfo?.cropName || 'Unknown Product'}</h3>
                                    <p className="text-sm text-gray-500">with {nego.listingInfo?.farmerName || 'Unknown Farmer'}</p>
                                </div>
                                <div className="text-right">
                                    {nego.status === 'awaiting-authorization' ? (
                                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Awaiting Your OK</span>
                                    ) : (
                                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">In Progress</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
};

export default NegotiationList;
