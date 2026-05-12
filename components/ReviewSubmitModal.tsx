import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { submitFarmerReview } from '../services/trustService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Spinner from './common/Spinner';

interface ReviewSubmitModalProps {
    isOpen: boolean;
    onClose: () => void;
    farmerUid: string;
    farmerName: string;
    orderId: string;
    productName: string;
    productQuantity?: string;
    deliveredDate?: string;
}

const StarRating: React.FC<{ value: number; onChange: (v: number) => void; label: string; sublabel: string; icon: string }> = ({
    value, onChange, label, sublabel, icon
}) => {
    const [hover, setHover] = useState(0);

    return (
        <div className="flex items-center gap-4 py-3">
            <span className="text-xl w-8 text-center">{icon}</span>
            <div className="flex-1">
                <p className="text-sm font-bold text-gray-800">{label}</p>
                <p className="text-[11px] text-gray-400 font-medium">{sublabel}</p>
            </div>
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => onChange(star)}
                        onMouseEnter={() => setHover(star)}
                        onMouseLeave={() => setHover(0)}
                        className="text-2xl transition-transform hover:scale-125 active:scale-95"
                    >
                        {star <= (hover || value)
                            ? <span className="text-amber-400">★</span>
                            : <span className="text-gray-200">★</span>
                        }
                    </button>
                ))}
            </div>
        </div>
    );
};

const ReviewSubmitModal: React.FC<ReviewSubmitModalProps> = ({
    isOpen, onClose, farmerUid, farmerName, orderId, productName, productQuantity, deliveredDate
}) => {
    const { currentUser, userProfile } = useAuth();
    const { showToast } = useToast();
    const [ratings, setRatings] = useState({ freshness: 0, quality: 0, honesty: 0, communication: 0 });
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);

    const isComplete = ratings.freshness > 0 && ratings.quality > 0 && ratings.honesty > 0 && ratings.communication > 0;

    const handleSubmit = async () => {
        if (!currentUser || !isComplete) return;
        setLoading(true);
        try {
            await submitFarmerReview({
                farmerUid,
                customerUid: currentUser.uid,
                customerName: userProfile?.name || currentUser.email || 'Anonymous',
                orderId,
                ratings,
                comment,
            });
            showToast('Review submitted! Thank you for your feedback 🙏', 'success');
            onClose();
            // Reset form
            setRatings({ freshness: 0, quality: 0, honesty: 0, communication: 0 });
            setComment('');
        } catch (error) {
            showToast('Failed to submit review. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-8 py-6 border-b border-amber-100/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">🎁</span>
                                    <div>
                                        <h2 className="text-xl font-['Noto_Serif'] font-bold text-gray-900">Rate Your Experience</h2>
                                        <p className="text-xs font-semibold text-gray-400 mt-0.5">
                                            Order from {farmerName}'s Farm
                                        </p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                                    <span className="material-symbols-outlined text-gray-400">close</span>
                                </button>
                            </div>
                        </div>

                        {/* Order Summary */}
                        <div className="mx-8 mt-6 p-4 bg-gray-50 rounded-xl flex items-center gap-3">
                            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center text-xl">🥬</div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-gray-800">{productName}{productQuantity ? ` · ${productQuantity}` : ''}</p>
                                <p className="text-[11px] text-gray-400 font-medium">
                                    {deliveredDate ? `Delivered ${deliveredDate}` : `Order #${orderId.slice(0, 8)}`}
                                </p>
                            </div>
                        </div>

                        {/* Rating Dimensions */}
                        <div className="px-8 py-4 divide-y divide-gray-100">
                            <StarRating
                                value={ratings.freshness}
                                onChange={(v) => setRatings(p => ({ ...p, freshness: v }))}
                                label="Freshness"
                                sublabel="Was the produce fresh when delivered?"
                                icon="🥬"
                            />
                            <StarRating
                                value={ratings.quality}
                                onChange={(v) => setRatings(p => ({ ...p, quality: v }))}
                                label="Quality"
                                sublabel="Did it match the listing photos?"
                                icon="✨"
                            />
                            <StarRating
                                value={ratings.honesty}
                                onChange={(v) => setRatings(p => ({ ...p, honesty: v }))}
                                label="Honesty"
                                sublabel="Was quantity/weight accurate?"
                                icon="⚖️"
                            />
                            <StarRating
                                value={ratings.communication}
                                onChange={(v) => setRatings(p => ({ ...p, communication: v }))}
                                label="Communication"
                                sublabel="Was the farmer responsive?"
                                icon="💬"
                            />
                        </div>

                        {/* Written Review */}
                        <div className="px-8 pb-4">
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Share your experience with other buyers... (optional)"
                                className="w-full p-4 border border-gray-200 rounded-xl resize-none h-24 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6a4f] focus:border-transparent placeholder:text-gray-300 bg-gray-50/50"
                            />
                        </div>

                        {/* Photo Upload Placeholder */}
                        <div className="mx-8 mb-6 p-5 border-2 border-dashed border-gray-200 rounded-xl text-center cursor-pointer hover:border-[#2d6a4f]/30 hover:bg-emerald-50/30 transition-colors">
                            <span className="text-2xl">📸</span>
                            <p className="text-xs font-bold text-gray-400 mt-1">Upload an unboxing photo (optional)</p>
                            <p className="text-[10px] text-gray-300 font-medium">Help other buyers see the real product</p>
                        </div>

                        {/* Submit */}
                        <div className="px-8 pb-8 space-y-3">
                            <button
                                onClick={handleSubmit}
                                disabled={!isComplete || loading}
                                className={`w-full py-4 rounded-xl font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${
                                    isComplete
                                        ? 'bg-[#2d6a4f] text-white hover:bg-[#1b4332] shadow-lg'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}
                            >
                                {loading ? <Spinner /> : (
                                    <>
                                        <span className="material-symbols-outlined text-sm">send</span>
                                        Submit Review
                                    </>
                                )}
                            </button>
                            <button
                                onClick={onClose}
                                className="w-full text-center text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors py-2"
                            >
                                Skip for now
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ReviewSubmitModal;
