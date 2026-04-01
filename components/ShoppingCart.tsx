import React from 'react';
import { CartItem } from '../types';
import Card from './common/Card';
import Icon from './common/Icon';
import Button from './common/Button';
import Spinner from './common/Spinner';

interface ShoppingCartProps {
    cart: CartItem[];
    onUpdateQuantity: (listingId: string, newQuantity: number) => void;
    onRemove: (listingId: string) => void;
    onCheckout: () => void;
    checkoutLoading: boolean;
}

const ShoppingCart: React.FC<ShoppingCartProps> = ({ cart, onUpdateQuantity, onRemove, onCheckout, checkoutLoading }) => {
    
    const subtotal = cart.reduce((sum, item) => sum + (item.listing.price * item.quantity), 0);

    return (
        <Card>
            <div className="flex items-center mb-6">
                <Icon name="shopping-cart" className="h-8 w-8 text-green-600 mr-3" />
                <h2 className="text-2xl font-bold text-gray-700">My Cart</h2>
            </div>

            {cart.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-lg border">
                    <Icon name="shopping-cart" className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700">Your Cart is Empty</h3>
                    <p className="text-gray-500 mt-2">Add items from the marketplace to get started.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {cart.map(item => (
                        <div key={item.listing.id} className="flex items-center gap-4 p-4 border rounded-lg bg-white">
                            <img src={item.listing.imageUrl || undefined} alt={item.listing.cropName} className="w-20 h-20 object-cover rounded-md" />
                            <div className="flex-grow">
                                <h3 className="font-bold text-gray-800">{item.listing.cropName}</h3>
                                <p className="text-xs text-gray-500">from {item.listing.farmerName}</p>
                                <p className="text-sm font-semibold text-green-600">{item.listing.price.toFixed(2)} {item.listing.currency} / {item.listing.unit}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) => onUpdateQuantity(item.listing.id, parseInt(e.target.value) || 1)}
                                    min="1"
                                    max={item.listing.quantity}
                                    className="w-16 p-1 border rounded-md text-center"
                                />
                                <span className="text-sm text-gray-600">{item.listing.unit}</span>
                            </div>
                            <p className="font-bold w-24 text-right">{(item.listing.price * item.quantity).toFixed(2)} {item.listing.currency}</p>
                            <button onClick={() => onRemove(item.listing.id)} className="p-2 text-gray-500 hover:text-red-600 rounded-full hover:bg-gray-100">
                                <Icon name="trash" className="h-5 w-5" />
                            </button>
                        </div>
                    ))}

                    <div className="text-right pt-4 border-t">
                        <p className="text-lg">Subtotal: <span className="font-bold text-2xl text-gray-800">{subtotal.toFixed(2)}</span></p>
                        <Button onClick={onCheckout} disabled={checkoutLoading || cart.length === 0} className="mt-4">
                            {checkoutLoading ? <Spinner /> : 'Proceed to Checkout'}
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default ShoppingCart;
