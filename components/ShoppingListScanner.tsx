import React, { useState, useRef, useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';
import { parseShoppingList } from '../services/geminiService';
import type { ParsedListItem, ProductListing } from '../types';
import Icon from './common/Icon';
import Spinner from './common/Spinner';

interface ShoppingListScannerProps {
    allListings?: ProductListing[];
    customerLocation?: string;
    onAddToCart?: (listing: ProductListing) => void;
    onItemsScanned?: (items: ParsedListItem[]) => Promise<{ foundCount: number, notFoundCount: number }>;
}

type MessageItem = {
    parsedText: string;
    matches: ProductListing[];
    quantity: number;
    parsedUnit: string;
};

type Message = {
    id: string;
    role: 'bot' | 'user';
    type: 'text' | 'products';
    content?: string;
    items?: MessageItem[];
    imageUrl?: string;
};

const ShoppingListScanner: React.FC<ShoppingListScannerProps> = ({ allListings = [], customerLocation = '', onAddToCart, onItemsScanned }) => {
    const { showToast } = useToast();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'init',
            role: 'bot',
            type: 'text',
            content: "Hello! I'm your FarmConnect AI. You can upload a photo of your shopping list or type it out. What are you looking for today?"
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    const MAX_VISIBLE = 3;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    React.useEffect(() => {
        scrollToBottom();
    }, [messages, loading]);

    const processItems = (parsedItems: ParsedListItem[]): MessageItem[] => {
        return parsedItems.map(item => {
            const itemNameLower = item.itemName.toLowerCase();
            // Find ALL matching listings, sorted by location proximity + price
            const customerLocLower = customerLocation.toLowerCase();
            const matches = allListings
                .filter(l => 
                    l.cropName.toLowerCase().includes(itemNameLower) || 
                    itemNameLower.includes(l.cropName.toLowerCase())
                )
                .sort((a, b) => {
                    // Priority 1: Same location as customer (partial string match)
                    const aLocMatch = customerLocLower && a.location.toLowerCase().includes(customerLocLower) ? 1 : 0;
                    const bLocMatch = customerLocLower && b.location.toLowerCase().includes(customerLocLower) ? 1 : 0;
                    if (bLocMatch !== aLocMatch) return bLocMatch - aLocMatch; // location matches first
                    // Priority 2: Cheapest price
                    return a.price - b.price;
                });

            return {
                parsedText: `${item.quantity} ${item.unit} ${item.itemName}`.trim(),
                matches,
                quantity: item.quantity > 0 ? item.quantity : 1,
                parsedUnit: item.unit
            };
        });
    };

    const handleSendText = async () => {
        if (!inputValue.trim()) return;
        const textToProcess = inputValue;
        
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', type: 'text', content: textToProcess }]);
        setInputValue('');
        setLoading(true);

        try {
            const parsedItems = await parseShoppingList({ text: textToProcess });
            if (onItemsScanned) await onItemsScanned(parsedItems);
            
            const messageItems = processItems(parsedItems);
            
            if (messageItems.length > 0) {
                setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', type: 'products', items: messageItems }]);
            } else {
                setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', type: 'text', content: "I couldn't find any specific items in that text. Try listing them out!" }]);
            }
        } catch (error) {
            console.error("Parse error:", error);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', type: 'text', content: "Sorry, I had trouble reading that. Please try again." }]);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Display image instantly in chat
        const tempPreviewUrl = URL.createObjectURL(file);
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', type: 'text', imageUrl: tempPreviewUrl }]);
        setLoading(true);

        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64String = (reader.result as string).split(',')[1];
                const parsedItems = await parseShoppingList({ imageBase64: base64String, mimeType: file.type });
                if (onItemsScanned) await onItemsScanned(parsedItems);
                
                const messageItems = processItems(parsedItems);
                
                if (messageItems.length > 0) {
                    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', type: 'products', items: messageItems }]);
                } else {
                    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', type: 'text', content: "I couldn't detect any items in that image. Please make sure the handwriting is legible." }]);
                }
                setLoading(false);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error("Image parse error:", error);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', type: 'text', content: "Sorry, I failed to process that image." }]);
            setLoading(false);
        }
    };

    const updateItemQuantity = (msgId: string, itemIdx: number, delta: number) => {
        setMessages(prev => prev.map(msg => {
            if (msg.id === msgId && msg.items) {
                const newItems = [...msg.items];
                const newQty = Math.max(1, newItems[itemIdx].quantity + delta);
                newItems[itemIdx] = { ...newItems[itemIdx], quantity: newQty };
                return { ...msg, items: newItems };
            }
            return msg;
        }));
    };

    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col h-[700px] max-h-[85vh]">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'bot' && (
                            <div className="w-8 h-8 rounded-full bg-black shrink-0 flex items-center justify-center text-white">
                                <Icon name="sparkles" className="w-4 h-4" />
                            </div>
                        )}
                        
                        <div className="flex flex-col gap-2 max-w-[85%]">
                            {msg.type === 'text' && (
                                <div className={`p-4 rounded-2xl text-sm font-medium leading-relaxed ${
                                    msg.role === 'user'
                                    ? 'bg-white border border-gray-200 text-gray-800 rounded-tr-sm' 
                                    : 'bg-[#ecfdf5] text-gray-800 rounded-tl-sm'
                                }`}>
                                    {msg.imageUrl && <img src={msg.imageUrl} alt="Uploaded list" className="max-w-[200px] rounded-lg mb-2" />}
                                    {msg.content}
                                </div>
                            )}

                            {msg.type === 'products' && msg.items?.map((item, idx) => (
                                <div key={idx} className="bg-white border border-gray-100 shadow-sm rounded-xl overflow-hidden w-full max-w-md mb-2">
                                    <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-[#10B981]">
                                            DETECTED: "{item.parsedText}"
                                        </p>
                                        {item.matches.length > 1 && (
                                            <span className="text-[10px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                                {item.matches.length} FARMERS
                                            </span>
                                        )}
                                    </div>
                                    
                                    {item.matches.length === 0 && (
                                        <div className="p-4 pt-1 text-sm text-gray-500 font-medium">
                                            Could not find any matching products currently in the market.
                                        </div>
                                    )}

                                    {item.matches.length > 0 && (() => {
                                        const itemKey = `${msg.id}-${idx}`;
                                        const isExpanded = expandedItems.has(itemKey);
                                        const visibleMatches = isExpanded ? item.matches : item.matches.slice(0, MAX_VISIBLE);
                                        const hiddenCount = item.matches.length - MAX_VISIBLE;

                                        return (
                                        <div className={`${item.matches.length > 1 ? 'divide-y divide-gray-50' : ''}`}>
                                            {visibleMatches.map((matchedListing, mIdx) => (
                                                <div key={matchedListing.id} className={`${item.matches.length > 1 && mIdx > 0 ? 'border-t border-dashed border-gray-100' : ''}`}>
                                                    {item.matches.length > 1 && mIdx === 0 && (
                                                        <p className="px-4 pt-1 pb-0 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Compare {item.matches.length} options — sorted by price</p>
                                                    )}
                                                    <div className="flex gap-3 px-4 py-2.5">
                                                        {matchedListing.imageUrl ? (
                                                            <img src={matchedListing.imageUrl} alt={matchedListing.cropName} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                                                        ) : (
                                                            <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                                                                <i className="fa-solid fa-image text-xl"></i>
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="min-w-0">
                                                                    <h4 className="font-bold text-gray-900 text-sm truncate">{matchedListing.cropName}</h4>
                                                                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                                                                        <i className="fa-solid fa-user text-[10px] mr-1"></i>{matchedListing.farmerName}
                                                                    </p>
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <p className="font-black text-sm text-[#2D6A4F]">₹{matchedListing.price.toFixed(0)}<span className="text-[10px] text-gray-400 font-bold">/{matchedListing.unit}</span></p>
                                                                    <p className="text-[10px] text-gray-400 font-medium">{matchedListing.quantity} {matchedListing.unit} avail</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400 font-medium">
                                                                <span className="flex items-center gap-1 truncate"><i className="fa-solid fa-location-dot text-[10px]"></i>{matchedListing.location}</span>
                                                                {matchedListing.farmerPhoneNumber && (
                                                                    <span className="flex items-center gap-1 shrink-0"><i className="fa-solid fa-phone text-[10px]"></i>{matchedListing.farmerPhoneNumber}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="px-4 pb-3 flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-0.5">
                                                            <button onClick={() => updateItemQuantity(msg.id, idx, -1)} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-900 bg-white rounded shadow-sm transition-colors"><Icon name="minus" className="w-3 h-3"/></button>
                                                            <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                                                            <button onClick={() => updateItemQuantity(msg.id, idx, 1)} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-900 bg-white rounded shadow-sm transition-colors"><Icon name="plus" className="w-3 h-3"/></button>
                                                        </div>
                                                        <button 
                                                            onClick={() => {
                                                                if (onAddToCart) {
                                                                    for(let i=0; i<item.quantity; i++){
                                                                        onAddToCart(matchedListing);
                                                                    }
                                                                    showToast(`Added ${item.quantity} × ${matchedListing.cropName} from ${matchedListing.farmerName} to cart!`, 'success');
                                                                }
                                                            }}
                                                            className="flex-1 bg-[#10B981] hover:bg-[#059669] text-white py-2 rounded-lg text-xs font-bold transition-transform active:scale-95 flex items-center justify-center gap-1.5"
                                                        >
                                                            <Icon name="shopping-cart" className="w-3.5 h-3.5" /> Add {matchedListing.farmerName}'s
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}

                                            {hiddenCount > 0 && (
                                                <button
                                                    onClick={() => {
                                                        setExpandedItems(prev => {
                                                            const next = new Set(prev);
                                                            if (next.has(itemKey)) next.delete(itemKey);
                                                            else next.add(itemKey);
                                                            return next;
                                                        });
                                                    }}
                                                    className="w-full py-2.5 text-xs font-bold text-[#2D6A4F] hover:bg-[#f0fdf4] transition-colors flex items-center justify-center gap-1.5 border-t border-dashed border-gray-100"
                                                >
                                                    {isExpanded ? (
                                                        <><i className="fa-solid fa-chevron-up text-[10px]"></i> Show less</>
                                                    ) : (
                                                        <><i className="fa-solid fa-chevron-down text-[10px]"></i> Show {hiddenCount} more farmer{hiddenCount > 1 ? 's' : ''}</>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                        );
                                    })()}
                                </div>
                            ))}
                        </div>

                        {msg.role === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0 flex items-center justify-center text-gray-600">
                                <Icon name="user" className="w-4 h-4" />
                            </div>
                        )}
                    </div>
                ))}

                {loading && (
                    <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 rounded-full bg-black shrink-0 flex items-center justify-center text-white">
                            <Icon name="sparkles" className="w-4 h-4" />
                        </div>
                        <div className="bg-[#ecfdf5] text-[#10B981] p-4 rounded-2xl rounded-tl-sm w-16 flex items-center justify-center">
                            <Spinner />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-gray-100 bg-white rounded-b-3xl">
                <div className="relative flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-1 shadow-inner focus-within:ring-2 focus-within:ring-[#10B981]/20 focus-within:border-[#10B981] transition-all">
                    <input 
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                        placeholder="Type your shopping list here, or mention a photo upload..."
                        className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent text-sm p-3 placeholder-gray-400 font-medium text-gray-800"
                    />
                    
                    <button 
                        onClick={handleSendText}
                        disabled={!inputValue.trim()}
                        className="bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-white w-10 h-10 rounded-lg flex items-center justify-center shadow-sm transition-colors shrink-0"
                    >
                        <Icon name="paper-airplane" className="w-4 h-4 mr-0.5" />
                    </button>
                    
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-white hover:bg-gray-100 border border-gray-200 text-gray-600 w-10 h-10 rounded-lg flex items-center justify-center shadow-sm transition-colors shrink-0"
                    >
                        <i className="fa-solid fa-camera text-lg"></i>
                    </button>
                    <input type="file" accept="image/*" onChange={handleFileUpload} ref={fileInputRef} className="hidden" />
                </div>
                <p className="text-center text-xs text-gray-400 font-medium mt-3">
                    Pro Tip: For best results, ensure legible handwriting if uploading a photo.
                </p>
            </div>
        </div>
    );
};

export default ShoppingListScanner;
