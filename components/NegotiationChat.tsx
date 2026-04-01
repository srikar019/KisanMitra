import React, { useState, useEffect, useRef } from 'react';
import {
    onNegotiationMessagesSnapshot,
    startNegotiationChat,
    postCustomerMessageAndGetResponse,
    onNegotiationChatSnapshot,
    customerAuthorizeDeal
} from '../services/marketplaceService';
import type { ProductListing, NegotiationChatMessage, NegotiationChat, FarmerProfile } from '../types';
import Card from './common/Card';
import Icon from './common/Icon';
import Button from './common/Button';
import Spinner from './common/Spinner';
import { useLanguage } from '../contexts/LanguageContext';

interface NegotiationChatProps {
    listing: ProductListing;
    customer: FarmerProfile;
    onBack: () => void;
}

const NegotiationChat: React.FC<NegotiationChatProps> = ({ listing, customer, onBack }) => {
    const { translate, language } = useLanguage();
    const [chatId, setChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<NegotiationChatMessage[]>([]);
    const [chatInfo, setChatInfo] = useState<NegotiationChat | null>(null);
    const [customerReply, setCustomerReply] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const initChat = async () => {
            try {
                const id = await startNegotiationChat(listing, customer, language);
                setChatId(id);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to start negotiation.");
                setLoading(false);
            }
        };
        initChat();
    }, [listing, customer]);

    useEffect(() => {
        if (!chatId) return;

        setLoading(true);
        const unsubscribeMessages = onNegotiationMessagesSnapshot(chatId, (newMessages) => {
            setMessages(newMessages);
            setLoading(false);
        });
        
        const unsubscribeChatInfo = onNegotiationChatSnapshot(chatId, (chatData) => {
            setChatInfo(chatData);
        });

        return () => {
            unsubscribeMessages();
            unsubscribeChatInfo();
        };
    }, [chatId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerReply.trim() || !chatId || loading) return;

        setLoading(true);
        setError(null);
        const reply = customerReply;
        setCustomerReply('');

        try {
            await postCustomerMessageAndGetResponse(chatId, listing, reply, messages, language);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send message or get a response.');
        } finally {
            setLoading(false);
        }
    };

    const handleAuthorizeDeal = async () => {
        if (!chatId) return;
        setLoading(true);
        setError(null);
        try {
            await customerAuthorizeDeal(chatId, listing);
            // The on-screen state will update automatically via the snapshot listener
        } catch (err) {
             setError(err instanceof Error ? err.message : 'Failed to authorize deal.');
        } finally {
            setLoading(false);
        }
    };

    const renderChatFooter = () => {
        if (chatInfo?.status === 'awaiting-authorization' && chatInfo.proposedDeal) {
            const deal = chatInfo.proposedDeal;
            return (
                <div className="text-center p-4 bg-yellow-50 border-t-2 border-yellow-200 rounded-b-lg animate-fade-in">
                    <h3 className="text-lg font-bold text-yellow-800">Deal Proposal from Agent</h3>
                    <p className="my-2 text-yellow-700">The agent has proposed the following final terms for your approval:</p>
                    <div className="text-left bg-white p-3 rounded-md border text-sm space-y-1 my-3">
                        <p><strong>Crop:</strong> {deal.crop}</p>
                        <p><strong>Quantity:</strong> {deal.quantity} {deal.unit}</p>
                        <p><strong>Final Price:</strong> <span className="font-bold text-gray-800">{deal.finalPrice.toFixed(2)} {deal.currency}</span> per {deal.unit}</p>
                    </div>
                    <Button onClick={handleAuthorizeDeal} disabled={loading}>
                        {loading ? <Spinner /> : "Authorize Deal"}
                    </Button>
                </div>
            );
        }

        if (chatInfo?.status === 'deal-made') {
             return (
                <div className="text-center p-6 bg-green-100 border border-green-200 rounded-b-lg animate-fade-in">
                    <Icon name="check-circle" className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-green-800">Deal Authorized!</h3>
                    <p className="text-green-700 mt-2">The farmer has been notified of the agreement. Thank you!</p>
                </div>
            );
        }

        return (
             <div className="space-y-4 p-4 border-t">
                <form onSubmit={handleSendMessage}>
                     <label className="font-semibold text-gray-700 text-sm">Your Reply:</label>
                     <textarea value={customerReply} onChange={(e) => setCustomerReply(e.target.value)} rows={3} className="w-full mt-1 p-2 border rounded-md" placeholder="Enter your counter-offer or message..." disabled={loading}></textarea>
                    <div className="text-center mt-2">
                        <Button type="submit" disabled={loading || !customerReply.trim()}>{loading ? <Spinner /> : "Send Reply"}</Button>
                    </div>
                </form>
                 {error && <p className="text-red-500 text-center text-sm">{error}</p>}
            </div>
        );
    };


    return (
        <div className="min-h-screen bg-green-50/50 flex items-center justify-center p-4">
            <Card className="!max-w-2xl w-full !p-0 flex flex-col">
                <div className="flex items-center justify-between mb-0 p-4 border-b">
                    <div className="flex items-center gap-3">
                        <Icon name="chat-bubble-left-right" className="h-8 w-8 text-cyan-500"/>
                        <div>
                           <h2 className="text-2xl font-bold text-gray-700">Negotiation</h2>
                           <p className="text-sm text-gray-500">with {listing.farmerName}'s AI Agent</p>
                           {listing.farmerEmail && <p className="text-xs text-gray-400">Farmer: {listing.farmerEmail}</p>}
                        </div>
                    </div>
                    <Button onClick={onBack} variant="secondary" className="!px-4 !py-2 !text-sm">
                        {chatInfo?.status === 'deal-made' ? 'Finish' : 'Leave'}
                    </Button>
                </div>
                 <div className="h-96 bg-gray-50 p-4 overflow-y-auto space-y-4">
                    {messages.map((msg, index) => {
                      // user is the Agent, model is the Customer
                      const isAgent = msg.role === 'user';
                      return (
                        <div key={index} className={`flex items-start gap-3 ${isAgent ? 'justify-end' : 'justify-start'}`}>
                          {!isAgent && <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0" title="You (Buyer)"><Icon name="user-circle" className="h-5 w-5 text-white" /></div>}
                          <div className={`p-3 rounded-2xl max-w-[80%] break-words ${isAgent ? 'bg-green-600 text-white' : 'bg-white border'}`}>
                            {msg.content}
                          </div>
                          {isAgent && <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center flex-shrink-0" title="AI Agent"><Icon name="sparkles" className="h-5 w-5 text-white" /></div>}
                        </div>
                      );
                    })}
                    {loading && messages.length > 0 && (
                         <div className={`flex items-start gap-3 justify-end`}>
                            <div className="p-3 rounded-2xl max-w-[80%] break-words bg-green-600/80">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-white rounded-full animate-pulse [animation-delay:0s]"></span>
                                    <span className="w-2 h-2 bg-white rounded-full animate-pulse [animation-delay:0.15s]"></span>
                                    <span className="w-2 h-2 bg-white rounded-full animate-pulse [animation-delay:0.3s]"></span>
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center flex-shrink-0" title="AI Agent"><Icon name="sparkles" className="h-5 w-5 text-white" /></div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                
                {renderChatFooter()}
            </Card>
        </div>
    );
};

export default NegotiationChat;
