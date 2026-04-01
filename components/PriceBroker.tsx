import React, { useState, useCallback, useEffect, useRef } from 'react';
import { onProductsSnapshot, createRetailOrder } from '../services/marketplaceService';
import type { ProductListing, CartItem, ParsedListItem, FarmerProfile } from '../types';
import Spinner from './common/Spinner';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import RecipeGenerator from './RecipeGenerator';
import MyActivity from './MyActivity';
import CustomerProfile from './CustomerProfile';
import CustomerCSA from './CustomerCSA';
import ShoppingListScanner from './ShoppingListScanner';
import Icon from './common/Icon';

interface CustomerPortalProps {
  onBack: () => void;
  onStartNegotiation: (listing: ProductListing, customer: FarmerProfile) => void;
}

type CustomerView = 'marketplace' | 'scanner' | 'recipes' | 'activity' | 'profile' | 'csa';

const CustomerHeader: React.FC<{
    activeView: CustomerView;
    setActiveView: (view: CustomerView) => void;
    onLogout: () => void;
    cartItemCount: number;
}> = ({ activeView, setActiveView, onLogout, cartItemCount }) => {
    const tabs: { id: CustomerView; name: string; icon?: string }[] = [
        { id: 'marketplace', name: 'Marketplace' },
        { id: 'scanner', name: 'AI Scanner', icon: 'document_scanner' },
        { id: 'recipes', name: 'AI Recipes', icon: 'auto_awesome' },
        { id: 'csa', name: 'Subscriptions' },
    ];

    return (
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-fc-medium-sage/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="KisanMitra Logo" className="h-10 w-10 object-contain rounded-full overflow-hidden" />
                        <h2 className="font-serif text-2xl font-black tracking-tight text-[#2D6A4F]">KisanMitra</h2>
                    </div>

                    <nav className="hidden lg:flex items-center gap-2 bg-white/90 rounded-full p-1.5 shadow-sm border border-gray-100/50">
                        {tabs.map((tab, idx) => (
                            <button
                                key={idx}
                                onClick={() => setActiveView(tab.id)}
                                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                                    activeView === tab.id 
                                    ? 'bg-[#2D6A4F] text-white shadow-md' 
                                    : 'text-[#2D6A4F] hover:bg-[#F2F8F4]'
                                }`}
                            >
                                {tab.icon && <span className="material-symbols-outlined text-xs">{tab.icon}</span>}
                                {tab.name}
                            </button>
                        ))}
                    </nav>

                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setActiveView('activity')}
                            className="relative p-2.5 text-[#2D6A4F] hover:bg-[#F2F8F4] rounded-full transition-all border border-transparent hover:border-[#2D6A4F]/20"
                        >
                            <i className="fa-solid fa-basket-shopping text-xl"></i>
                            {cartItemCount > 0 && (
                                <span className="absolute top-1.5 right-1.5 size-4 bg-[#7DA68D] text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white">
                                    {cartItemCount}
                                </span>
                            )}
                        </button>
                        <button 
                            onClick={() => setActiveView('profile')}
                            className="hidden sm:flex items-center gap-2 pl-3 pr-1 py-1 rounded-full border border-gray-200 hover:border-[#2D6A4F] transition-all bg-white"
                        >
                            <span className="text-sm font-bold text-gray-700">My Profile</span>
                            <div className="size-8 rounded-full bg-[#88B08B]/20 flex items-center justify-center text-[#2D6A4F]">
                                <span className="material-symbols-outlined text-xl">account_circle</span>
                            </div>
                        </button>
                        <button onClick={onLogout} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Logout">
                            <span className="material-symbols-outlined font-light text-2xl">logout</span>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};

export const CustomerPortal: React.FC<CustomerPortalProps> = ({ onBack, onStartNegotiation }) => {
  const { userProfile } = useAuth();
  const [activeView, setActiveView] = useState<CustomerView>('marketplace');
  const [allListings, setAllListings] = useState<ProductListing[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [scanResults, setScanResults] = useState<{ found: ParsedListItem[], missing: ParsedListItem[] } | null>(null);
  const [marketplaceSearch, setMarketplaceSearch] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onProductsSnapshot((listings) => {
        setAllListings(listings);
    });
    return () => unsubscribe();
  }, []);

  const handleUpdateCartQuantity = (listingId: string, delta: number) => {
    setCart(prev => {
        const existing = prev.find(i => i.listing.id === listingId);
        if (!existing && delta > 0) {
            const listing = allListings.find(l => l.id === listingId);
            if (listing) return [...prev, { listing, quantity: 1 }];
            return prev;
        }
        return prev.map(item => {
            if (item.listing.id === listingId) {
                return { ...item, quantity: Math.max(0, Math.min(item.listing.quantity, item.quantity + delta)) };
            }
            return item;
        }).filter(i => i.quantity > 0);
    });
  };

  const handleAddToCart = (listing: ProductListing) => {
      handleUpdateCartQuantity(listing.id, 1);
      setActiveView('activity'); // Quick jump to cart for UX
  };

  const { showToast } = useToast();

  const handleCheckout = async () => {
      if (!userProfile || cart.length === 0) return;
      setCheckoutLoading(true);
      try {
          // Process all cart items concurrently or sequentially. Doing sequentially to ensure atomicity logs properly.
          for (const item of cart) {
              await createRetailOrder(
                  item.listing, 
                  item.quantity, 
                  { email: userProfile.email, name: userProfile.name || '', location: userProfile.location || '' }
              );
          }
          setCart([]);
          showToast('Order placed successfully! 🎉', 'success');
          setActiveView('marketplace'); // Redirect back to marketplace or history
      } catch (error) {
          console.error("Checkout error:", error);
          showToast('Failed to place some parts of your order: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error', 6000);
      } finally {
          setCheckoutLoading(false);
      }
  };

  const handleItemsScanned = async (items: ParsedListItem[]) => {
      const found: ParsedListItem[] = [];
      const missing: ParsedListItem[] = [];

      items.forEach(item => {
          const match = allListings.find(l => 
              l.cropName.toLowerCase().includes(item.itemName.toLowerCase()) || 
              item.itemName.toLowerCase().includes(l.cropName.toLowerCase())
          );
          if (match) found.push(item);
          else missing.push(item);
      });

      setScanResults({ found, missing });
      return { foundCount: found.length, notFoundCount: missing.length };
  };

  const renderScanner = () => (
    <div className="animate-fade-in-up max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-4">
            <div>
                <h1 className="font-serif text-4xl md:text-[2.5rem] font-bold text-gray-900 mb-2">Shopping List Assistant</h1>
                <p className="text-gray-500 font-medium text-lg">Tell me what you need, and I'll find farm-fresh products for you.</p>
            </div>
            <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#10B981] bg-[#10B981]/10 px-3 py-1.5 rounded-full">
                    <Icon name="sparkles" className="w-3.5 h-3.5" /> AI-Powered
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#10B981] bg-[#10B981]/10 px-3 py-1.5 rounded-full">
                    <Icon name="leaf" className="w-3.5 h-3.5" /> Local Farms
                </span>
            </div>
        </div>

        <ShoppingListScanner 
            allListings={allListings} 
            customerLocation={userProfile?.location || ''}
            onAddToCart={handleAddToCart}
            onItemsScanned={handleItemsScanned}
        />
    </div>
  );

  const renderMarketplace = () => {
    const filteredListings = allListings.filter(listing => 
        listing.cropName.toLowerCase().includes(marketplaceSearch.toLowerCase()) || 
        listing.farmerName.toLowerCase().includes(marketplaceSearch.toLowerCase())
    );

    return (
        <div className="animate-fade-in-up">
            <div className="pt-12 pb-16 text-center max-w-4xl mx-auto px-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#88B08B]/10 text-[#2D6A4F] text-xs font-black uppercase tracking-widest mb-8 border border-[#88B08B]/20">
                    <span className="material-symbols-outlined text-sm font-bold">shopping_basket</span>
                    Local & Fresh
                </div>
                <h1 className="font-serif text-5xl md:text-7xl font-bold text-[#2A4535] leading-[1.1] mb-8">
                    Your Direct Link <br/> <span className="italic text-[#7DA68D] opacity-90">to Honest Farming.</span>
                </h1>
                <p className="text-lg md:text-xl text-[#2A4535]/60 font-medium leading-relaxed max-w-3xl mx-auto">
                    No middlemen, no hidden costs. Browse seasonal produce harvested by independent farmers just hours away.
                </p>
            </div>

            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 pb-4 border-b border-gray-100 gap-4">
                    <h3 className="font-serif text-3xl font-bold text-[#2A4535]">Available Harvests</h3>
                    
                    <div className="flex items-center gap-4 flex-1 justify-end">
                        <div className="relative w-full max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Icon name="search" className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:border-transparent sm:text-sm transition-shadow shadow-sm"
                                placeholder="Search crops or farmers..."
                                value={marketplaceSearch}
                                onChange={(e) => setMarketplaceSearch(e.target.value)}
                            />
                        </div>
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest whitespace-nowrap hidden sm:inline-block">
                            {filteredListings.length} LISTINGS
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {filteredListings.length === 0 ? (
                        <div className="col-span-full py-32 text-center bg-gray-50/50 rounded-[3rem] border-2 border-dashed border-gray-200">
                            <Icon name="shopping-bag" className="size-16 mx-auto mb-4 opacity-10" />
                            <p className="text-gray-400 font-bold text-xl">
                                {marketplaceSearch ? `No matches found for "${marketplaceSearch}"` : 'The market is currently being restocked.'}
                            </p>
                        </div>
                    ) : (
                        filteredListings.map((listing) => (
                            <div key={listing.id} className="bg-white rounded-[2.5rem] p-4 border border-gray-100 shadow-premium hover:shadow-card-hover transition-all duration-500 group flex flex-col h-full">
                                <div className="h-60 rounded-[2rem] overflow-hidden relative mb-6">
                                    <img src={listing.imageUrl || undefined} alt={listing.cropName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                    <div className="absolute top-4 right-4 px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-black text-fc-dark-green shadow-sm">
                                        {listing.listingType === 'wholesale' ? 'BULK' : 'RETAIL'}
                                    </div>
                                    {listing.listingType === 'wholesale' && (
                                        <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1 bg-cyan-500 text-white text-[10px] font-black rounded-full shadow-lg">
                                            <Icon name="sparkles" className="h-3 w-3" /> NEGOTIABLE
                                        </div>
                                    )}
                                </div>
                                
                                <div className="px-4 flex flex-col flex-grow">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-serif text-2xl font-bold text-[#2A4535] leading-tight">{listing.cropName}</h4>
                                        <p className="text-xl font-black text-[#2D6A4F]">₹{listing.price.toFixed(0)}<span className="text-[10px] text-gray-400 uppercase font-black">/{listing.unit}</span></p>
                                    </div>
                                    <div className="flex justify-between items-center mb-4">
                                        <p className="text-xs text-fc-medium-sage font-bold uppercase tracking-wider">{listing.farmerName}'s Farm</p>
                                        <span className="text-[10px] font-black tracking-wide text-gray-600 bg-gray-100 px-2 py-1 rounded-md">
                                            AVAIL: {listing.quantity} {listing.unit}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1.5 mb-6">
                                        <p className="text-sm text-gray-500 font-medium line-clamp-1 flex items-center gap-1.5">
                                            <Icon name="map-pin" className="h-4 w-4 text-gray-400 shrink-0" />
                                            {listing.location}
                                        </p>
                                        {listing.farmerPhoneNumber && (
                                            <p className="text-sm text-gray-500 font-medium flex items-center gap-1.5">
                                                <i className="fa-solid fa-phone text-sm text-gray-400 shrink-0"></i>
                                                {listing.farmerPhoneNumber}
                                            </p>
                                        )}
                                    </div>
                                    
                                    <div className="mt-auto flex flex-col gap-2">
                                        {listing.listingType === 'wholesale' ? (
                                            <button 
                                                onClick={() => onStartNegotiation(listing, userProfile as FarmerProfile)}
                                                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-3 rounded-xl font-black text-sm transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 mb-2"
                                            >
                                                <Icon name="chat-bubble-left-right" className="h-4 w-4" /> Start AI Negotiation
                                            </button>
                                        ) : null}
                                        <button 
                                            onClick={() => handleAddToCart(listing)}
                                            className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] text-white py-3 rounded-xl font-black text-sm transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <Icon name="plus" className="h-4 w-4" /> Add to Basket
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
  };

  const renderContent = () => {
    switch (activeView) {
        case 'marketplace': return renderMarketplace();
        case 'scanner': return renderScanner();
        case 'recipes': return <RecipeGenerator allListings={allListings} onIngredientClick={(name) => { setActiveView('marketplace'); setMarketplaceSearch(name); }} />;
        case 'csa': return <CustomerCSA />;
        case 'activity': return <MyActivity cart={cart} onUpdateCartQuantity={(id, q) => handleUpdateCartQuantity(id, q - (cart.find(i => i.listing.id === id)?.quantity || 0))} onRemoveFromCart={(id) => handleUpdateCartQuantity(id, -999)} onCheckout={handleCheckout} checkoutLoading={checkoutLoading} onStartNegotiation={(listing) => userProfile && onStartNegotiation(listing, userProfile)} allListings={allListings} />;
        case 'profile': return <CustomerProfile />;
        default: return renderMarketplace();
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
        <CustomerHeader activeView={activeView} setActiveView={setActiveView} onLogout={onBack} cartItemCount={cart.length} />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            {renderContent()}
        </main>
        
        <footer className="py-16 text-center border-t border-gray-200/50 bg-white/40 backdrop-blur-sm mt-10">
            <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 text-[#7DA68D]">
                    <i className="fa-solid fa-leaf text-lg"></i>
                    <span className="font-black tracking-[0.4em] text-[10px] uppercase text-[#2A4535]/60">Supporting Local Agriculture</span>
                </div>
                <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">© 2024 KisanMitra. Sustainable. Fresh. Local.</p>
            </div>
        </footer>
    </div>
  );
};
