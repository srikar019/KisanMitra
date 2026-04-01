import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ProductListing, CartItem } from '../types';
import Card from './common/Card';
import Icon from './common/Icon';
import ShoppingCart from './ShoppingCart';
import NegotiationList from './NegotiationList';
import OrderHistory from './MyDeals';
import { cancelRetailOrder } from '../services/marketplaceService';
import Modal from './common/Modal';
import Button from './common/Button';
import Spinner from './common/Spinner';

interface MyActivityProps {
    cart: CartItem[];
    onUpdateCartQuantity: (listingId: string, newQuantity: number) => void;
    onRemoveFromCart: (listingId: string) => void;
    onCheckout: () => void;
    checkoutLoading: boolean;
    onStartNegotiation: (listing: ProductListing, customerEmail: string) => void;
    allListings: ProductListing[];
}

type ActivityTab = 'cart' | 'negotiations' | 'history';

const MyActivity: React.FC<MyActivityProps> = (props) => {
    const [activeTab, setActiveTab] = useState<ActivityTab>('cart');
    const [orderToCancel, setOrderToCancel] = useState<any | null>(null);
    const [cancelLoading, setCancelLoading] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);

    const handleCancelOrder = async () => {
        if (!orderToCancel) return;
        setCancelLoading(true);
        setCancelError(null);
        try {
            await cancelRetailOrder({
                id: orderToCancel.id,
                listingId: orderToCancel.listingId,
                quantityBought: orderToCancel.quantity,
                farmerUid: orderToCancel.farmerUid,
                productName: orderToCancel.productName,
            });
            setOrderToCancel(null);
        } catch (err) {
            setCancelError(err instanceof Error ? err.message : "Failed to cancel order.");
        } finally {
            setCancelLoading(false);
        }
    };

    const tabs: { id: ActivityTab; name: string; icon: string }[] = [
        { id: 'cart', name: 'Cart', icon: 'shopping-cart' },
        { id: 'negotiations', name: 'Negotiations', icon: 'handshake' },
        { id: 'history', name: 'History', icon: 'receipt' },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'cart':
                return (
                    <ShoppingCart
                        cart={props.cart}
                        onUpdateQuantity={props.onUpdateCartQuantity}
                        onRemove={props.onRemoveFromCart}
                        onCheckout={props.onCheckout}
                        checkoutLoading={props.checkoutLoading}
                    />
                );
            case 'negotiations':
                return <NegotiationList onStartNegotiation={props.onStartNegotiation} allListings={props.allListings} />;
            case 'history':
                return <OrderHistory onCancelOrder={setOrderToCancel} />;
            default:
                return null;
        }
    };

    return (
        <div className="max-w-5xl mx-auto pb-20">
             <div className="mb-10 bg-white/80 backdrop-blur-md p-1.5 rounded-2xl shadow-sm border border-gray-100 flex justify-center w-fit mx-auto animate-fade-in-up">
                <div className="flex items-center gap-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl transition-all ${
                                activeTab === tab.id
                                    ? 'bg-[#2D6A4F] text-white shadow-lg'
                                    : 'text-gray-500 hover:text-gray-800 hover:bg-white'
                            }`}
                        >
                            <Icon name={tab.icon} className="h-4 w-4 shrink-0" />
                            {tab.name}
                        </button>
                    ))}
                </div>
            </div>
            
            <Modal isOpen={!!orderToCancel} onClose={() => setOrderToCancel(null)} title="Confirm Order Cancellation">
                <div>
                    <p className="text-gray-600 leading-relaxed">Are you sure you want to cancel your order for <strong>{orderToCancel?.quantity} {orderToCancel?.unit} of {orderToCancel?.productName}</strong>? This cannot be undone. The farmer will be notified and stock will be returned to the market.</p>
                    {cancelError && <p className="text-red-500 text-sm mt-4 bg-red-50 p-2 rounded border border-red-100">{cancelError}</p>}
                    <div className="flex justify-end gap-4 mt-8">
                        <Button variant="secondary" className="!rounded-xl" onClick={() => { setOrderToCancel(null); setCancelError(null); }}>Back</Button>
                        <Button className="!bg-red-600 !hover:bg-red-700 !rounded-xl !text-white focus:ring-red-500" onClick={handleCancelOrder} disabled={cancelLoading}>
                            {cancelLoading ? <Spinner/> : 'Confirm Cancellation'}
                        </Button>
                    </div>
                </div>
            </Modal>

            <div className="animate-fade-in-up [animation-delay:150ms]">
                {renderContent()}
            </div>
        </div>
    );
};

export default MyActivity;
