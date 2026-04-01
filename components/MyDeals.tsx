import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { onDealsForCustomerSnapshot, onRetailOrdersForCustomerSnapshot } from '../services/marketplaceService';
import { NegotiationChat, RetailOrder } from '../types';
import Card from './common/Card';
import Icon from './common/Icon';
import Spinner from './common/Spinner';
import Button from './common/Button';

interface OrderHistoryProps {
    onCancelOrder: (deal: any) => void;
}

const OrderHistory: React.FC<OrderHistoryProps> = ({ onCancelOrder }) => {
    const { currentUser } = useAuth();
    const [negotiationDeals, setNegotiationDeals] = useState<NegotiationChat[]>([]);
    const [retailOrders, setRetailOrders] = useState<RetailOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (currentUser?.email) {
            setLoading(true);
            let negoLoaded = false;
            let retailLoaded = false;

            const checkDone = () => {
                if (negoLoaded && retailLoaded) {
                    setLoading(false);
                }
            };

            const unsubscribeNegotiations = onDealsForCustomerSnapshot(
                currentUser.email,
                (fetchedDeals) => {
                    setNegotiationDeals(fetchedDeals);
                    negoLoaded = true;
                    checkDone();
                },
                (err) => {
                    setError(err.message);
                    negoLoaded = true;
                    checkDone();
                }
            );

             const unsubscribeRetail = onRetailOrdersForCustomerSnapshot(
                currentUser.email,
                (fetchedOrders) => {
                    setRetailOrders(fetchedOrders);
                    retailLoaded = true;
                    checkDone();
                },
                (err) => {
                    setError(err.message);
                    retailLoaded = true;
                    checkDone();
                }
            );

            return () => {
                unsubscribeNegotiations();
                unsubscribeRetail();
            };
        } else {
            setLoading(false);
        }
    }, [currentUser]);

    const allDeals = useMemo(() => {
        const negoFormatted = negotiationDeals.map(deal => ({
            id: deal.id,
            type: 'negotiation' as const,
            date: deal.updatedAt,
            productName: deal.listingInfo?.cropName || deal.dealSummary?.crop || 'N/A',
            farmerName: deal.listingInfo?.farmerName || 'N/A',
            quantity: deal.dealSummary?.quantity || 0,
            unit: deal.dealSummary?.unit || '',
            totalPrice: deal.dealSummary?.finalPrice ? deal.dealSummary.finalPrice * (deal.dealSummary.quantity || 1) : 0,
            priceDisplay: `${deal.dealSummary?.finalPrice?.toFixed(2) || '0.00'} / ${deal.dealSummary?.unit}`,
            currency: deal.dealSummary?.currency || '',
            imageUrl: deal.listingInfo?.imageUrl,
            status: deal.status,
        }));

        const retailFormatted = retailOrders.map(order => ({
            id: order.id,
            type: 'retail' as const,
            date: order.createdAt,
            productName: order.productName,
            farmerName: 'Direct Purchase', // Farmer name is not stored on retail order, can be added
            quantity: order.quantityBought,
            unit: order.unit,
            totalPrice: order.totalPrice,
            priceDisplay: `${order.pricePerUnit.toFixed(2)} / ${order.unit}`,
            currency: order.currency,
            imageUrl: `https://ui-avatars.com/api/?name=${order.productName.charAt(0)}&background=random&color=fff`, // Placeholder
            status: order.status,
            listingId: order.listingId,
            farmerUid: order.farmerUid,
        }));
        
        return [...negoFormatted, ...retailFormatted].sort((a,b) => b.date.getTime() - a.date.getTime());

    }, [negotiationDeals, retailOrders]);

    return (
        <Card>
            <div className="flex items-center mb-6">
                <Icon name="receipt" className="h-8 w-8 text-green-500 mr-3" />
                <h2 className="text-2xl font-bold text-gray-700">Order History</h2>
            </div>
            <p className="text-gray-600 mb-6">A complete record of all your successful deals and direct purchases.</p>

            {loading ? (
                <div className="flex justify-center items-center h-48">
                    <Spinner />
                </div>
            ) : error ? (
                <p className="text-red-500 text-center">{error}</p>
            ) : allDeals.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-lg border">
                    <Icon name="receipt" className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700">No Past Orders</h3>
                    <p className="text-gray-500 mt-2">Your purchase history will appear here.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {allDeals.map(deal => (
                        <div key={deal.id} className="bg-white p-4 rounded-lg border flex flex-col sm:flex-row gap-4 items-center">
                             <img 
                                src={deal.imageUrl || `https://ui-avatars.com/api/?name=${deal.productName.charAt(0)}&background=random&color=fff`} 
                                alt={deal.productName} 
                                className="w-full sm:w-24 h-24 object-cover rounded-md bg-gray-200" 
                            />
                            <div className="flex-grow">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-lg font-bold text-gray-800">{deal.productName}</h3>
                                     <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${deal.type === 'negotiation' ? 'bg-cyan-100 text-cyan-800' : 'bg-green-100 text-green-800'}`}>
                                        {deal.type === 'negotiation' ? 'Negotiated Deal' : 'Retail Purchase'}
                                    </span>
                                </div>
                                 {deal.status && (
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full mt-1 inline-block capitalize ${
                                        deal.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                        deal.status === 'new' ? 'bg-blue-100 text-blue-800' :
                                        ['active', 'awaiting-authorization'].includes(deal.status) ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                        {deal.status.replace('-', ' ')}
                                    </span>
                                )}
                                <p className="text-sm text-gray-500 mt-1">
                                    {deal.type === 'negotiation' ? `From: ${deal.farmerName}` : `Order Date: ${deal.date.toLocaleDateString()}`}
                                </p>
                                <p className="text-sm text-gray-500">
                                    {deal.quantity} {deal.unit} @ {deal.priceDisplay}
                                </p>
                            </div>
                            <div className="text-right flex-shrink-0 self-center sm:self-end">
                                <p className="text-xl font-extrabold text-green-600">
                                    {deal.totalPrice.toFixed(2)}
                                    <span className="text-base font-normal text-green-700"> {deal.currency}</span>
                                </p>
                                <p className="text-sm text-gray-500">Total Price</p>
                                {deal.type === 'retail' && deal.status === 'new' && (
                                    <Button
                                        variant="secondary"
                                        className="!text-xs !py-1 !px-3 !text-red-600 mt-2"
                                        onClick={() => onCancelOrder(deal)}
                                    >
                                        Cancel Order
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
};

export default OrderHistory;
