import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { onRetailOrdersForFarmerSnapshot, onNegotiatedDealsForFarmerSnapshot, updateRetailOrderStatus } from '../services/marketplaceService';
import { RetailOrder, NegotiationChat } from '../types';
import Card from './common/Card';
import Icon from './common/Icon';
import Button from './common/Button';
import Spinner from './common/Spinner';

const FarmerDeals: React.FC = () => {
    const { currentUser } = useAuth();
    const [retailDeals, setRetailDeals] = useState<RetailOrder[]>([]);
    const [negotiatedDeals, setNegotiatedDeals] = useState<NegotiationChat[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    type DealTab = 'new' | 'history';
    const [activeTab, setActiveTab] = useState<DealTab>('new');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        if (currentUser) {
            setLoading(true);
            const unsubRetail = onRetailOrdersForFarmerSnapshot(currentUser.uid, (orders) => { setRetailDeals(orders); setLoading(false); }, (err) => { setError(err.message); setLoading(false); });
            const unsubNego = onNegotiatedDealsForFarmerSnapshot(currentUser.uid, (deals) => { setNegotiatedDeals(deals); setLoading(false); }, (err) => { setError(err.message); setLoading(false); });

            return () => {
                unsubRetail();
                unsubNego();
            };
        }
    }, [currentUser]);

    const { newOrders, orderHistory } = useMemo(() => {
        const newOrders = retailDeals.filter(d => d.status === 'new' || d.status === 'processing');
        const historyRetail = retailDeals.filter(d => d.status === 'shipped' || d.status === 'cancelled');
        const historyNego = negotiatedDeals;

        const combinedHistory = [
            ...historyRetail.map(d => ({ ...d, type: 'Retail' as const })),
            ...historyNego.map(d => ({ ...d, type: 'Negotiated' as const })),
        ].sort((a, b) => {
            const dateA = a.type === 'Retail' ? a.createdAt : a.updatedAt;
            const dateB = b.type === 'Retail' ? b.createdAt : b.updatedAt;
            return dateB.getTime() - dateA.getTime();
        });

        return { newOrders, orderHistory: combinedHistory };
    }, [retailDeals, negotiatedDeals]);

    const handleUpdateStatus = async (orderId: string, newStatus: 'processing' | 'shipped') => {
        setActionLoading(orderId);
        try {
            await updateRetailOrderStatus(orderId, newStatus);
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(null);
        }
    };
    
    const StatusBadge: React.FC<{ status: RetailOrder['status'] }> = ({ status }) => {
        const styles = {
            new: 'bg-blue-100 text-blue-800',
            processing: 'bg-yellow-100 text-yellow-800',
            shipped: 'bg-green-100 text-green-800',
            cancelled: 'bg-red-100 text-red-800',
        };
        return <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${styles[status]}`}>{status}</span>;
    };


    const renderNewOrders = () => {
        if (newOrders.length === 0) return <p className="text-center text-gray-500 py-8">No new orders.</p>;
        return (
            <div className="space-y-4">
                {newOrders.map(order => (
                    <div key={order.id} className="p-4 bg-white border rounded-lg">
                        <div className="flex flex-col sm:flex-row justify-between gap-4">
                           <div>
                                <p className="font-semibold">{order.productName}</p>
                                <p className="text-sm text-gray-500">To: {order.customerName} ({order.customerLocation})</p>
                                <p className="text-xs text-gray-400">Order placed: {order.createdAt.toLocaleDateString()}</p>
                           </div>
                           <div className="text-right">
                                <p className="font-bold text-lg">{order.totalPrice.toFixed(2)} {order.currency}</p>
                                <p className="text-sm text-gray-500">{order.quantityBought} {order.unit}</p>
                           </div>
                           <div className="flex flex-col items-end gap-2">
                                <StatusBadge status={order.status} />
                                {order.status === 'new' && <Button className="!py-1 !px-3 !text-xs" onClick={() => handleUpdateStatus(order.id, 'processing')} disabled={actionLoading === order.id}>{actionLoading === order.id ? <Spinner/> : 'Mark as Processing'}</Button>}
                                {order.status === 'processing' && <Button className="!py-1 !px-3 !text-xs" onClick={() => handleUpdateStatus(order.id, 'shipped')} disabled={actionLoading === order.id}>{actionLoading === order.id ? <Spinner/> : 'Mark as Shipped'}</Button>}
                           </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderOrderHistory = () => {
        if (orderHistory.length === 0) return <p className="text-center text-gray-500 py-8">No past orders or deals.</p>;
        return (
             <div className="space-y-4">
                {orderHistory.map(item => {
                    const isRetail = item.type === 'Retail';
                    const order = isRetail ? (item as RetailOrder & { type: 'Retail' }) : null;
                    const deal = !isRetail ? (item as NegotiationChat & { type: 'Negotiated' }) : null;
                    const date = order?.createdAt || deal?.updatedAt;
                    const customerName = isRetail ? order?.customerName : deal?.customerName;
                    const customerLocation = isRetail ? order?.customerLocation : deal?.customerLocation;

                    return (
                        <div key={item.id} className={`p-4 border rounded-lg ${order?.status === 'cancelled' ? 'bg-red-50' : 'bg-white'}`}>
                            <div className="flex flex-col sm:flex-row justify-between gap-4">
                                <div>
                                    <p className="font-semibold">{order?.productName || deal?.dealSummary?.crop}</p>
                                    <p className="text-sm text-gray-500">To: {customerName} {customerLocation ? `(${customerLocation})` : ''}</p>
                                    <p className="text-xs text-gray-400">Date: {date?.toLocaleDateString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-lg">{ (order?.totalPrice || (deal?.dealSummary?.finalPrice || 0) * (deal?.dealSummary?.quantity || 0)).toFixed(2) } {order?.currency || deal?.dealSummary?.currency}</p>
                                    <p className="text-sm text-gray-500">{order?.quantityBought || deal?.dealSummary?.quantity} {order?.unit || deal?.dealSummary?.unit}</p>
                                </div>
                                <div className="text-right">
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${isRetail ? 'bg-green-100 text-green-800' : 'bg-cyan-100 text-cyan-800'}`}>{isRetail ? 'Retail Sale' : 'Negotiated Deal'}</span>
                                    {order?.status && <div className="mt-2"><StatusBadge status={order.status} /></div>}
                                </div>
                            </div>
                        </div>
                    )
                })}
             </div>
        );
    };

    return (
        <Card className="!max-w-4xl">
            <div className="flex items-center mb-4">
                <Icon name="tag" className="h-8 w-8 text-green-600 mr-3" />
                <h2 className="text-2xl font-bold text-gray-700">My Deals</h2>
            </div>
            <p className="text-gray-600 mb-6">Manage retail orders and AI-negotiated deals. Communication with customers is handled directly through WhatsApp.</p>

            <div className="flex border-b mb-4">
                <button onClick={() => setActiveTab('new')} className={`px-4 py-2 text-sm font-semibold ${activeTab === 'new' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500'}`}>New Orders</button>
                <button onClick={() => setActiveTab('history')} className={`px-4 py-2 text-sm font-semibold ${activeTab === 'history' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500'}`}>Order History</button>
            </div>

            {loading ? (
                <div className="flex justify-center p-8"><Spinner /></div>
            ) : error ? (
                <p className="text-red-500 text-center">{error}</p>
            ) : (
                <div>
                    {activeTab === 'new' && renderNewOrders()}
                    {activeTab === 'history' && renderOrderHistory()}
                </div>
            )}
        </Card>
    );
};

export default FarmerDeals;
