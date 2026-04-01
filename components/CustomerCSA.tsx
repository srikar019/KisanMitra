import React, { useState, useEffect } from 'react';
import { onAllCSATiersSnapshot, createCSASubscription, cancelCSASubscription, onCSASubscriptionsForCustomerSnapshot, updateSubscriptionPreferences } from '../services/marketplaceService';
import { CSATier, CSASubscription, DynamicSubscriptionPreferences } from '../types';
import { useAuth } from '../contexts/AuthContext';
import Card from './common/Card';
import Button from './common/Button';
import Icon from './common/Icon';
import Spinner from './common/Spinner';
import Modal from './common/Modal';

const CustomerCSA: React.FC = () => {
    const { currentUser, userProfile } = useAuth();
    const [tiers, setTiers] = useState<CSATier[]>([]);
    const [mySubscriptions, setMySubscriptions] = useState<CSASubscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState<string | null>(null);
    const [isPrefsModalOpen, setIsPrefsModalOpen] = useState(false);
    const [selectedSub, setSelectedSub] = useState<CSASubscription | null>(null);

    useEffect(() => {
        const unsubTiers = onAllCSATiersSnapshot(setTiers);
        let unsubMySubs = () => {};
        if (currentUser?.email) {
            unsubMySubs = onCSASubscriptionsForCustomerSnapshot(currentUser.email, setMySubscriptions);
        }
        setLoading(false);
        return () => { unsubTiers(); unsubMySubs(); };
    }, [currentUser]);

    const handleSubscribe = async (tier: CSATier) => {
        if (!currentUser || !userProfile) return;
        
        if (tier.type === 'dynamic') {
            setSelectedSub({ tierId: tier.id, tierInfo: { ...tier, type: 'dynamic' } } as Partial<CSASubscription> as CSASubscription);
            setIsPrefsModalOpen(true);
            return;
        }

        setSubmitting(tier.id);
        try {
            await createCSASubscription(tier, userProfile);
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(null);
        }
    };

    const handleUnsubscribe = async (subscriptionId: string) => {
        if (!confirm("Are you sure you want to cancel this subscription?")) return;
        setSubmitting(subscriptionId);
        try {
            await cancelCSASubscription(subscriptionId);
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(null);
        }
    };

    const handlePrefsSubmit = async (prefs: DynamicSubscriptionPreferences) => {
        if (!currentUser || !userProfile || !selectedSub) return;
        setSubmitting(selectedSub.tierId);
        try {
            const tier = tiers.find(t => t.id === selectedSub.tierId);
            if (tier) {
                await createCSASubscription(tier, userProfile, prefs);
            }
            setIsPrefsModalOpen(false);
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(null);
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Spinner /></div>;

    const subscribedTierIds = new Set(mySubscriptions.map(s => s.tierId));

    return (
        <div className="space-y-12 animate-fade-in pb-20">
            <PreferencesModal 
                isOpen={isPrefsModalOpen} 
                onClose={() => setIsPrefsModalOpen(false)} 
                onSave={handlePrefsSubmit}
                loading={!!submitting}
            />

            <div className="text-center max-w-3xl mx-auto">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#88B08B]/10 text-[#2D6A4F] text-xs font-black uppercase tracking-widest mb-6 border border-[#88B08B]/20">
                    <span className="material-symbols-outlined text-sm font-bold">event_repeat</span>
                    Direct from Farm
                </div>
                <h2 className="font-serif text-5xl font-bold text-[#2A4535] mb-6">Farm Subscriptions</h2>
                <p className="text-lg text-[#2A4535]/60 font-medium leading-relaxed">
                    Support local farmers directly and receive regular deliveries of fresh, seasonal produce curated specifically for you.
                </p>
            </div>

            {mySubscriptions.length > 0 && (
                <section className="animate-fade-in-up">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="size-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                            <Icon name="check-circle" className="h-6 w-6" />
                        </div>
                        <h3 className="text-2xl font-bold text-[#2A4535]">Your Active Subscriptions</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {mySubscriptions.map(sub => (
                            <div key={sub.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-premium flex flex-col sm:flex-row gap-6 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-[4rem] -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                                <div className="size-20 rounded-3xl bg-[#88B08B]/10 flex items-center justify-center text-[#2D6A4F] shrink-0 border border-[#88B08B]/20 relative z-10">
                                    <Icon name="collection" className="h-10 w-10" />
                                </div>
                                <div className="relative z-10 flex-grow">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-serif text-2xl font-bold text-gray-800">{sub.tierInfo.name}</h4>
                                        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-wider border border-emerald-100">ACTIVE</span>
                                    </div>
                                    <p className="text-sm text-gray-500 font-medium mb-4">From: {sub.tierInfo.farmerName}</p>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <p className="text-xl font-black text-[#2D6A4F]">{sub.tierInfo.price} {sub.tierInfo.currency} <span className="text-xs font-bold text-gray-400 uppercase">/ {sub.tierInfo.frequency}</span></p>
                                            <div className="size-1 bg-gray-200 rounded-full"></div>
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-tighter">{sub.tierInfo.type} BOX</p>
                                        </div>
                                        <button 
                                            onClick={() => handleUnsubscribe(sub.id)}
                                            disabled={submitting === sub.id}
                                            className="px-4 py-2 border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                                        >
                                            {submitting === sub.id ? 'Leaving...' : 'Leave'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section className="animate-fade-in-up [animation-delay:200ms]">
                <div className="flex items-center gap-3 mb-8">
                    <div className="size-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 border border-orange-100">
                        <Icon name="sparkles" className="h-6 w-6" />
                    </div>
                    <h3 className="text-2xl font-bold text-[#2A4535]">Explore Available Tiers</h3>
                </div>
                {tiers.length === 0 ? (
                    <div className="text-center py-24 bg-white/40 rounded-[3rem] border-2 border-dashed border-gray-200">
                        <Icon name="collection" className="h-16 w-16 mx-auto mb-4 opacity-10 text-[#2A4535]" />
                        <p className="text-gray-400 font-bold text-xl">No subscriptions available in your area yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                        {tiers.map(tier => (
                            <div key={tier.id} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-premium flex flex-col group overflow-hidden hover:shadow-card-hover transition-all duration-500">
                                <div className="h-60 overflow-hidden relative">
                                    <img src={tier.imageUrl || undefined} alt={tier.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="absolute top-6 right-6 px-4 py-2 bg-white/90 backdrop-blur-md rounded-2xl text-[10px] font-black text-emerald-800 shadow-xl border border-white/50 uppercase tracking-widest">
                                        {tier.frequency}
                                    </div>
                                    {tier.type === 'dynamic' && (
                                        <div className="absolute bottom-6 left-6 flex items-center gap-2 px-3 py-1 bg-cyan-500 text-white text-[10px] font-black rounded-full shadow-lg">
                                            <Icon name="sparkles" className="h-3 w-3" /> AI CURATED
                                        </div>
                                    )}
                                </div>
                                <div className="p-8 flex flex-col flex-grow">
                                    <h4 className="font-serif text-2xl font-bold text-gray-800 mb-2">{tier.name}</h4>
                                    <p className="text-xs text-[#88B08B] font-bold mb-4 uppercase tracking-wider">{tier.farmerName}'s Farm</p>
                                    <p className="text-sm text-gray-500 mb-8 flex-grow leading-relaxed font-medium">{tier.description}</p>
                                    
                                    <div className="flex items-center justify-between mt-auto pt-8 border-t border-gray-50">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Price</p>
                                            <p className="text-2xl font-black text-[#2A4535]">{tier.price} {tier.currency}</p>
                                        </div>
                                        <button 
                                            disabled={subscribedTierIds.has(tier.id) || submitting === tier.id}
                                            onClick={() => handleSubscribe(tier)}
                                            className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 shadow-lg ${
                                                subscribedTierIds.has(tier.id) 
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                                : 'bg-[#88B08B] text-white hover:bg-[#77a07a] shadow-[#88B08B]/20'
                                            }`}
                                        >
                                            {submitting === tier.id ? <Spinner /> : subscribedTierIds.has(tier.id) ? 'Subscribed' : 'Subscribe Now'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

const PreferencesModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (prefs: DynamicSubscriptionPreferences) => void;
    loading: boolean;
}> = ({ isOpen, onClose, onSave, loading }) => {
    const [prefs, setPrefs] = useState<DynamicSubscriptionPreferences>({
        dietaryGoal: 'balanced',
        dislikes: [],
        allergies: []
    });
    const [newDislike, setNewDislike] = useState('');
    const [newAllergy, setNewAllergy] = useState('');

    const goals: { id: DynamicSubscriptionPreferences['dietaryGoal']; label: string; icon: string }[] = [
        { id: 'balanced', label: 'Balanced Diet', icon: 'scale' },
        { id: 'high-protein', label: 'High Protein', icon: 'fitness_center' },
        { id: 'low-carb', label: 'Low Carb', icon: 'nutrition' },
        { id: 'low-calorie', label: 'Low Calorie', icon: 'speed' },
    ];

    const addItem = (list: 'dislikes' | 'allergies', value: string) => {
        if (!value.trim()) return;
        setPrefs(prev => ({ ...prev, [list]: [...(prev[list] || []), value.trim()] }));
        if (list === 'dislikes') setNewDislike(''); else setNewAllergy('');
    };

    const removeItem = (list: 'dislikes' | 'allergies', value: string) => {
        setPrefs(prev => ({ ...prev, [list]: (prev[list] || []).filter(i => i !== value) }));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Customize Your Subscription">
            <div className="space-y-8 p-2">
                <div>
                    <h4 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Choose Your Dietary Goal</h4>
                    <div className="grid grid-cols-2 gap-4">
                        {goals.map(goal => (
                            <button
                                key={goal.id}
                                onClick={() => setPrefs(p => ({ ...p, dietaryGoal: goal.id }))}
                                className={`flex flex-col items-center gap-2 p-4 rounded-3xl border-2 transition-all ${
                                    prefs.dietaryGoal === goal.id 
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                                    : 'border-gray-100 hover:border-emerald-200 text-gray-500'
                                }`}
                            >
                                <span className="material-symbols-outlined text-2xl">{goal.icon}</span>
                                <span className="text-xs font-bold">{goal.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <h4 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Allergies & Dislikes</h4>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={newAllergy} 
                                onChange={e => setNewAllergy(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addItem('allergies', newAllergy)}
                                placeholder="Add allergy (e.g., Peanuts)" 
                                className="flex-grow p-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                            <button onClick={() => addItem('allergies', newAllergy)} className="bg-emerald-600 text-white p-3 rounded-2xl hover:bg-emerald-700 transition-all"><Icon name="plus" className="h-5 w-5"/></button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {prefs.allergies?.map(a => (
                                <span key={a} className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-black border border-red-100 flex items-center gap-1">
                                    {a} <button onClick={() => removeItem('allergies', a)}><Icon name="x-mark" className="h-3 w-3"/></button>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-8 border-t">
                    <Button onClick={() => onSave(prefs)} disabled={loading} className="!rounded-2xl !py-4 px-10 font-bold shadow-xl shadow-emerald-600/20">
                        {loading ? <Spinner /> : 'Complete Subscription'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default CustomerCSA;
