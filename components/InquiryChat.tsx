import React, { useState, useEffect, useRef } from 'react';
import { onInquiryMessagesSnapshot, sendInquiryMessage } from '../services/marketplaceService';
import { useAuth } from '../contexts/AuthContext';
import Icon from './common/Icon';
import Button from './common/Button';

interface InquiryChatProps {
    chat: any;
    onBack: () => void;
}

const InquiryChat: React.FC<InquiryChatProps> = ({ chat, onBack }) => {
    const { currentUser } = useAuth();
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLoading(true);
        const unsubscribe = onInquiryMessagesSnapshot(chat.id, (data) => {
            setMessages(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [chat.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !currentUser) return;
        const text = newMessage;
        setNewMessage('');
        await sendInquiryMessage(chat.id, currentUser.uid, text);
    };

    return (
        <div className="flex flex-col h-[600px] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            {/* Header with Product Context */}
            <div className="bg-gray-50 p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                        <Icon name="arrow-left" className="h-5 w-5 text-gray-600" />
                    </button>
                    <img src={chat.listingInfo.imageUrl || undefined} alt={chat.listingInfo.cropName} className="w-10 h-10 object-cover rounded-md border" />
                    <div>
                        <h3 className="font-bold text-gray-800 text-sm leading-tight">{chat.listingInfo.cropName}</h3>
                        <p className="text-xs text-gray-500">{chat.listingInfo.price} {chat.listingInfo.currency} per {chat.listingInfo.unit}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Direct Chat</p>
                    <p className="text-xs text-green-600 font-bold">{chat.listingInfo.farmerName}</p>
                    {chat.listingInfo.farmerPhoneNumber && (
                        <a href={`tel:${chat.listingInfo.farmerPhoneNumber.replace(/\s/g, '')}`} className="text-xs text-blue-600 hover:underline flex items-center justify-end gap-1 mt-0.5">
                            <Icon name="phone" className="h-3 w-3" />
                            {chat.listingInfo.farmerPhoneNumber}
                        </a>
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
                {loading ? (
                    <div className="flex justify-center py-10"><Icon name="sparkles" className="h-8 w-8 text-green-500 animate-spin" /></div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 italic text-sm">No messages yet. Ask the farmer anything!</div>
                ) : (
                    messages.map((msg, idx) => {
                        const isMe = msg.senderUid === currentUser?.uid;
                        return (
                            <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                                    isMe ? 'bg-green-600 text-white rounded-tr-none' : 'bg-white border text-gray-800 rounded-tl-none shadow-sm'
                                }`}>
                                    {msg.text}
                                    <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-green-100' : 'text-gray-400'}`}>
                                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} className="p-4 bg-white border-t flex gap-2">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 p-2 border rounded-full text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
                <button type="submit" disabled={!newMessage.trim()} className="bg-green-600 text-white p-2 rounded-full hover:bg-green-700 disabled:opacity-50 transition-colors">
                    <Icon name="paper-airplane" className="h-5 w-5" />
                </button>
            </form>
        </div>
    );
};

export default InquiryChat;
