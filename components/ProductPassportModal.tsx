import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ProductPassport, ProductListing, FarmerVerification, FarmerTrustStats } from '../types';
import { getProductPassport, getFarmerVerification, getFarmerTrustStats } from '../services/trustService';
import FarmerTrustBadge from './common/FarmerTrustBadge';
import PesticideRiskBadge from './common/PesticideRiskBadge';
import Spinner from './common/Spinner';

interface ProductPassportModalProps {
    listing: ProductListing;
    isOpen: boolean;
    onClose: () => void;
    onViewFarmerProfile?: (farmerUid: string) => void;
    onAddToCart?: (listing: ProductListing) => void;
}

// ── Gauge that shows actual data OR a "no data" state ────────────────
const CircularGauge: React.FC<{
    value: number | null;
    max: number;
    label: string;
    sublabel: string;
    color: string;
}> = ({ value, max, label, sublabel, color }) => {
    const circumference = 2 * Math.PI * 40;

    if (value === null) {
        return (
            <div className="flex flex-col items-center opacity-50">
                <div className="relative w-24 h-24">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="6" strokeDasharray="6 4" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-300">—</span>
                    </div>
                </div>
                <p className="text-sm font-bold text-gray-400 mt-2">{label}</p>
                <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-wide">Not yet verified</p>
            </div>
        );
    }

    const percent = (value / max) * 100;
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    return (
        <div className="flex flex-col items-center">
            <div className="relative w-24 h-24">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                    <circle
                        cx="50" cy="50" r="40" fill="none"
                        stroke={color}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-1000 ease-out"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-black text-gray-800">
                        {typeof value === 'number' && value < 1 ? value.toFixed(2) : value}
                    </span>
                </div>
            </div>
            <p className="text-sm font-bold text-gray-700 mt-2">{label}</p>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{sublabel}</p>
        </div>
    );
};

// ── Info row for when data hasn't been collected ─────────────────────
const PendingDataCard: React.FC<{ icon: string; label: string }> = ({ icon, label }) => (
    <div className="bg-white p-4 rounded-xl text-center border border-dashed border-gray-200">
        <span className="text-lg opacity-40">{icon}</span>
        <p className="text-[10px] font-black text-gray-300 uppercase mt-1">{label}</p>
        <p className="text-[10px] font-bold text-gray-300 mt-0.5">Pending</p>
    </div>
);


const ProductPassportModal: React.FC<ProductPassportModalProps> = ({ listing, isOpen, onClose, onViewFarmerProfile, onAddToCart }) => {
    const [passport, setPassport] = useState<ProductPassport | null>(null);
    const [verification, setVerification] = useState<FarmerVerification | null>(null);
    const [stats, setStats] = useState<FarmerTrustStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);

        const fetchData = async () => {
            const [p, v, s] = await Promise.all([
                getProductPassport(listing.id),
                getFarmerVerification(listing.farmerUid),
                getFarmerTrustStats(listing.farmerUid),
            ]);
            setPassport(p);
            setVerification(v);
            setStats(s);
            setLoading(false);
        };

        fetchData();
    }, [isOpen, listing.id, listing.farmerUid]);

    // ── Freshness is the ONLY metric we can honestly derive from existing data ──
    const daysSinceCreated = listing.createdAt
        ? Math.floor((Date.now() - listing.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;

    const hasPassport = !!passport;
    const hasVerification = !!verification;

    // Determine what we can actually confirm
    const confirmedFacts: { icon: string; text: string; verified: boolean }[] = [];

    // Phone verification — uses existing auth system
    confirmedFacts.push({
        icon: '📱',
        text: 'Phone verified via OTP',
        verified: true, // Every logged-in farmer has this
    });

    if (hasVerification) {
        if (verification!.locationVerified) {
            confirmedFacts.push({ icon: '📍', text: 'Farm location GPS verified', verified: true });
        }
        if (verification!.certifications?.length > 0) {
            const certs = verification!.certifications;
            const aiVerifiedCount = certs.filter(c => c.aiVerified).length;
            confirmedFacts.push({
                icon: '📜',
                text: `${certs.length} certificate${certs.length > 1 ? 's' : ''} uploaded${aiVerifiedCount > 0 ? ` (${aiVerifiedCount} AI-verified)` : ' (pending review)'}`,
                verified: aiVerifiedCount > 0,
            });
        }
        if (verification!.farmingMethod) {
            confirmedFacts.push({
                icon: '🌱',
                text: `Farming method: ${verification!.farmingMethod} (self-declared)`,
                verified: false, // Self-declared, not independently verified
            });
        }
    }

    if (stats && stats.totalOrders > 0) {
        confirmedFacts.push({
            icon: '📦',
            text: `${stats.totalOrders} orders completed`,
            verified: true, // From actual order data
        });
    }
    if (stats && stats.totalReviews > 0) {
        confirmedFacts.push({
            icon: '⭐',
            text: `${stats.avgRating}/5 avg rating from ${stats.totalReviews} customer reviews`,
            verified: true, // From actual reviews
        });
        if (stats.repeatRate > 0) {
            confirmedFacts.push({
                icon: '🔄',
                text: `${stats.repeatRate}% of customers re-ordered`,
                verified: true,
            });
        }
    }

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
                        className="bg-[#fafaea] rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {loading ? (
                            <div className="flex items-center justify-center py-32">
                                <Spinner />
                            </div>
                        ) : (
                            <>
                                {/* Header */}
                                <div className="sticky top-0 z-10 bg-gradient-to-r from-[#0f5238] to-[#2d6a4f] text-white px-8 py-6 rounded-t-3xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">🛡️</span>
                                        <div>
                                            <h2 className="text-xl font-['Noto_Serif'] font-bold">{listing.cropName} Health Passport</h2>
                                            <p className="text-white/60 text-xs font-semibold tracking-wide uppercase">
                                                {hasPassport ? 'Verified Quality Certificate' : 'Transparency Report'}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                        <span className="material-symbols-outlined text-white/80">close</span>
                                    </button>
                                </div>

                                {/* Farmer Info */}
                                <div className="px-8 py-6 flex items-center gap-4 border-b border-gray-200/50">
                                    <div className="w-14 h-14 rounded-full bg-[#2d6a4f]/10 flex items-center justify-center text-2xl">
                                        👨‍🌾
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-bold text-gray-800 text-lg">{listing.farmerName}</h3>
                                            {hasVerification
                                                ? <FarmerTrustBadge level={verification!.verificationLevel} />
                                                : <FarmerTrustBadge level="basic" />
                                            }
                                        </div>
                                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                                            <span className="material-symbols-outlined text-sm">location_on</span>
                                            {listing.location}
                                            {verification?.yearsExperience && (
                                                <span className="ml-2">· {verification.yearsExperience} yrs farming</span>
                                            )}
                                            {verification?.farmSizeAcres && (
                                                <span>· {verification.farmSizeAcres} acres</span>
                                            )}
                                        </p>
                                    </div>
                                    {stats && stats.totalReviews > 0 && (
                                        <div className="text-right">
                                            <p className="text-lg font-black text-amber-500">⭐ {stats.avgRating}</p>
                                            <p className="text-[10px] text-gray-400 font-bold">{stats.totalReviews} reviews</p>
                                        </div>
                                    )}
                                </div>

                                {/* ── What We Can Verify (Confirmed Facts) ───────────── */}
                                <div className="px-8 py-6">
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">fact_check</span>
                                        What we can confirm
                                    </h4>
                                    <div className="space-y-2.5">
                                        {confirmedFacts.map((fact, i) => (
                                            <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
                                                <span className="text-lg">{fact.icon}</span>
                                                <span className="flex-1 text-sm font-medium text-gray-700">{fact.text}</span>
                                                {fact.verified ? (
                                                    <span className="text-emerald-500 flex items-center gap-1 text-[10px] font-black uppercase">
                                                        <span className="material-symbols-outlined text-sm">check_circle</span>
                                                        Confirmed
                                                    </span>
                                                ) : (
                                                    <span className="text-amber-500 flex items-center gap-1 text-[10px] font-black uppercase">
                                                        <span className="material-symbols-outlined text-sm">pending</span>
                                                        Self-declared
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* ── Verified Lab/Satellite Data (only if passport exists) ──── */}
                                {hasPassport ? (
                                    <div className="px-8 pb-6">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-sm">science</span>
                                            Farm data (snapshot at listing time)
                                        </h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                                            <CircularGauge
                                                value={passport!.soilHealthScore > 0 ? passport!.soilHealthScore : null}
                                                max={100}
                                                label="Soil Health"
                                                sublabel={passport!.soilHealthScore >= 85 ? 'Excellent' : passport!.soilHealthScore >= 65 ? 'Good' : passport!.soilHealthScore > 0 ? 'Fair' : 'Pending'}
                                                color="#10B981"
                                            />
                                            <CircularGauge
                                                value={passport!.ndviScore > 0 ? Math.round(passport!.ndviScore * 100) / 100 : null}
                                                max={1}
                                                label="NDVI Score"
                                                sublabel={passport!.ndviScore >= 0.7 ? 'Healthy' : passport!.ndviScore >= 0.4 ? 'Moderate' : passport!.ndviScore > 0 ? 'Stressed' : 'Pending'}
                                                color="#059669"
                                            />
                                            <div className="flex flex-col items-center justify-center text-center">
                                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mb-2 ${
                                                    passport!.pesticideRiskLevel === 'minimal' ? 'bg-emerald-100' :
                                                    passport!.pesticideRiskLevel === 'low' ? 'bg-lime-100' :
                                                    passport!.pesticideRiskLevel === 'moderate' ? 'bg-amber-100' : 'bg-red-100'
                                                }`}>
                                                    🛡️
                                                </div>
                                                <PesticideRiskBadge level={passport!.pesticideRiskLevel} />
                                                <p className="text-[10px] text-gray-400 mt-1 font-medium">
                                                    {passport!.diseaseHistory.hasRecentDisease
                                                        ? `Last scan: ${passport!.diseaseHistory.scanResult}`
                                                        : 'No disease in last scan'}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-center justify-center text-center">
                                                <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center text-2xl mb-2">
                                                    🌿
                                                </div>
                                                <p className="text-sm font-bold text-gray-700">Freshness</p>
                                                {daysSinceCreated !== null ? (
                                                    <>
                                                        <div className="w-full max-w-[100px] h-2 bg-gray-200 rounded-full overflow-hidden mt-1.5">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-700 ${
                                                                    daysSinceCreated <= 2 ? 'bg-emerald-500' :
                                                                    daysSinceCreated <= 5 ? 'bg-green-400' :
                                                                    daysSinceCreated <= 8 ? 'bg-yellow-400' : 'bg-orange-400'
                                                                }`}
                                                                style={{ width: `${Math.max(10, 100 - daysSinceCreated * 8)}%` }}
                                                            />
                                                        </div>
                                                        <p className="text-[10px] text-gray-400 mt-1 font-bold">
                                                            Listed {daysSinceCreated} day{daysSinceCreated !== 1 ? 's' : ''} ago
                                                        </p>
                                                    </>
                                                ) : (
                                                    <p className="text-[10px] text-gray-300 mt-1">Date unavailable</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* AI Analysis — only with real data */}
                                        <div className="p-5 bg-white rounded-2xl border border-emerald-100">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="material-symbols-outlined text-emerald-600 text-lg">auto_awesome</span>
                                                <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">AI Analysis</span>
                                                <span className="ml-auto text-sm font-black text-emerald-600">
                                                    {passport!.aiConfidence}% Confidence
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 leading-relaxed">{passport!.aiSummary}</p>
                                        </div>
                                    </div>
                                ) : (
                                    /* ── No passport data yet — be transparent ──────── */
                                    <div className="px-8 pb-6">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-sm">science</span>
                                            Farm data
                                        </h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                                            <CircularGauge value={null} max={100} label="Soil Health" sublabel="" color="" />
                                            <CircularGauge value={null} max={1} label="NDVI Score" sublabel="" color="" />
                                            <CircularGauge value={null} max={100} label="Pesticide Risk" sublabel="" color="" />
                                            <div className="flex flex-col items-center justify-center text-center">
                                                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl mb-2 opacity-40">
                                                    🌿
                                                </div>
                                                <p className="text-sm font-bold text-gray-400">Freshness</p>
                                                {daysSinceCreated !== null ? (
                                                    <>
                                                        <div className="w-full max-w-[100px] h-2 bg-gray-200 rounded-full overflow-hidden mt-1.5">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-700 ${
                                                                    daysSinceCreated <= 2 ? 'bg-emerald-500' :
                                                                    daysSinceCreated <= 5 ? 'bg-green-400' :
                                                                    daysSinceCreated <= 8 ? 'bg-yellow-400' : 'bg-orange-400'
                                                                }`}
                                                                style={{ width: `${Math.max(10, 100 - daysSinceCreated * 8)}%` }}
                                                            />
                                                        </div>
                                                        <p className="text-[10px] text-gray-400 mt-1 font-bold">
                                                            Listed {daysSinceCreated} day{daysSinceCreated !== 1 ? 's' : ''} ago
                                                        </p>
                                                    </>
                                                ) : (
                                                    <p className="text-[10px] text-gray-300 mt-1">Date unavailable</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Honest "no data" message */}
                                        <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200/50">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="material-symbols-outlined text-amber-600 text-lg">info</span>
                                                <span className="text-xs font-black text-amber-700 uppercase tracking-widest">Data not yet available</span>
                                            </div>
                                            <p className="text-sm text-amber-800/70 leading-relaxed">
                                                This farmer hasn't completed their full verification process yet. 
                                                Soil health, NDVI, and pesticide data will appear here once the farmer 
                                                uses KisanMitra's Satellite Farm Twin and Crop Health Scanner features.
                                            </p>
                                            <p className="text-[11px] text-amber-600 font-bold mt-3">
                                                💡 Farmers with complete data earn the 💎 Premium Grower badge 
                                                and typically receive 3× more orders.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Listing Freshness — the ONE thing we can honestly measure */}
                                {daysSinceCreated !== null && !hasPassport && (
                                    <div className="mx-8 mb-6 p-4 bg-white rounded-2xl border border-gray-100">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Listing Age</p>
                                                <p className="text-sm font-bold text-gray-700 mt-1">
                                                    Posted {daysSinceCreated} day{daysSinceCreated !== 1 ? 's' : ''} ago
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-gray-400">
                                                    ⚠️ This is when the listing was created, not necessarily when the crop was harvested.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="px-8 pb-8 flex gap-3">
                                    {onAddToCart && (
                                        <button
                                            onClick={() => { onAddToCart(listing); onClose(); }}
                                            className="flex-1 bg-[#2d6a4f] text-white py-3.5 rounded-xl font-black text-sm hover:bg-[#1b4332] transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-sm">shopping_cart</span>
                                            Add to Basket
                                        </button>
                                    )}
                                    {onViewFarmerProfile && (
                                        <button
                                            onClick={() => { onViewFarmerProfile(listing.farmerUid); onClose(); }}
                                            className="flex-1 border-2 border-[#2d6a4f] text-[#2d6a4f] py-3.5 rounded-xl font-black text-sm hover:bg-[#2d6a4f]/5 transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-sm">person</span>
                                            View Farmer Profile
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ProductPassportModal;
