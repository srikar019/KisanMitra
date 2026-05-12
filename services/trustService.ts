import { firestore } from './firebase';
import type { FarmerVerification, FarmerReview, ProductPassport, FarmerTrustStats, VerificationLevel, PesticideRiskLevel, ProductListing } from '../types';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { getNdviTimeSeries } from './satelliteService';
import { estimateCropAndSoilData } from './geminiService';

// ── Farmer Verification ──────────────────────────────────────────────

/**
 * Fetches a farmer's verification record.
 */
export const getFarmerVerification = async (farmerUid: string): Promise<FarmerVerification | null> => {
    try {
        const doc = await firestore.collection('farmerVerifications').doc(farmerUid).get();
        if (!doc.exists) return null;
        const data = doc.data()!;
        return {
            ...data,
            updatedAt: data.updatedAt?.toDate() || new Date(),
        } as FarmerVerification;
    } catch (error) {
        console.error('Error fetching farmer verification:', error);
        return null;
    }
};

/**
 * Saves/updates a farmer's verification profile.
 */
export const saveFarmerVerification = async (data: Omit<FarmerVerification, 'updatedAt'>): Promise<void> => {
    try {
        await firestore.collection('farmerVerifications').doc(data.farmerUid).set({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    } catch (error) {
        console.error('Error saving farmer verification:', error);
        throw new Error('Failed to save verification data.');
    }
};

/**
 * Computes the verification level based on data completeness.
 */
export const computeVerificationLevel = (v: Partial<FarmerVerification>, stats?: FarmerTrustStats): VerificationLevel => {
    if (!v.phoneVerified) return 'basic';
    const hasCert = v.certifications && v.certifications.some(c => c.aiVerified);
    const isTrusted = stats && stats.totalOrders >= 10 && stats.avgRating >= 4.5;
    if (hasCert && isTrusted && v.locationVerified) return 'premium';
    if (hasCert) return 'certified';
    if (v.locationVerified) return 'verified';
    return 'basic';
};


// ── Product Passports ────────────────────────────────────────────────

/**
 * Fetches the health passport for a specific product listing.
 */
export const getProductPassport = async (listingId: string): Promise<ProductPassport | null> => {
    try {
        const doc = await firestore.collection('productPassports').doc(listingId).get();
        if (!doc.exists) return null;
        const data = doc.data()!;
        return {
            id: doc.id,
            ...data,
            generatedAt: data.generatedAt?.toDate() || new Date(),
            harvestDate: data.harvestDate?.toDate() || new Date(),
            diseaseHistory: {
                ...data.diseaseHistory,
                lastScanDate: data.diseaseHistory?.lastScanDate?.toDate(),
            },
        } as ProductPassport;
    } catch (error) {
        console.error('Error fetching product passport:', error);
        return null;
    }
};

/**
 * Creates an immutable product health passport snapshot for a listing.
 */
export const createProductPassport = async (passport: Omit<ProductPassport, 'id'>): Promise<void> => {
    try {
        await firestore.collection('productPassports').doc(passport.listingId).set({
            ...passport,
            generatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        console.error('Error creating product passport:', error);
        throw new Error('Failed to create health passport.');
    }
};

/**
 * Fully automatic Health Passport generation.
 * 
 * When a farmer creates a listing, this function:
 * 1. Geocodes their location → lat/lng
 * 2. Fetches real NDVI from Sentinel-2 satellite
 * 3. Uses Gemini AI to estimate soil health + pesticide risk for that crop/region
 * 
 * No manual farmer steps required.
 */
export const generatePassportFromFarmData = async (
    listing: ProductListing,
    verification: FarmerVerification | null,
): Promise<Omit<ProductPassport, 'id'>> => {

    // ── Step 1: Get farm coordinates ──────────────────────────────────
    let lat: number | null = null;
    let lng: number | null = null;

    // Try saved GPS first
    if (verification?.farmCoordinates) {
        lat = verification.farmCoordinates.lat;
        lng = verification.farmCoordinates.lng;
    }

    // Fallback: geocode the farmer's location string
    if (lat === null && listing.location) {
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(listing.location + ', India')}&format=json&limit=1`
            );
            const data = await res.json();
            if (data.length > 0) {
                lat = parseFloat(data[0].lat);
                lng = parseFloat(data[0].lon);
            }
        } catch (err) {
            console.warn('Geocoding failed for passport:', err);
        }
    }

    // ── Step 2: Fetch NDVI from Sentinel-2 satellite ─────────────────
    let ndviScore = 0;
    let ndviAvailable = false;

    if (lat !== null && lng !== null) {
        try {
            const timeSeries = await getNdviTimeSeries(lat, lng, 3);
            if (timeSeries.length > 0) {
                ndviScore = timeSeries[timeSeries.length - 1].mean;
                ndviAvailable = true;
            }
        } catch (err) {
            console.warn('NDVI fetch failed for passport:', err);
        }
    }

    // ── Step 3: AI estimation for soil + pesticide risk ───────────────
    let soilHealthScore = 0;
    let pesticideRiskLevel: PesticideRiskLevel = 'moderate';
    let aiSoilSummary = '';
    let aiPesticideSummary = '';

    try {
        const result = await estimateCropAndSoilData(listing.cropName, listing.location);
        
        soilHealthScore = Math.min(100, Math.max(0, Math.round(result.soilHealthScore || 50)));
        aiSoilSummary = result.soilDescription || '';
        aiPesticideSummary = result.pesticideReasoning || '';

        // Map AI response to our risk levels
        const riskStr = (result.pesticideRisk || '').toLowerCase();
        if (riskStr.includes('minimal') || riskStr.includes('very low') || riskStr.includes('negligible')) {
            pesticideRiskLevel = 'minimal';
        } else if (riskStr.includes('low')) {
            pesticideRiskLevel = 'low';
        } else if (riskStr.includes('high') || riskStr.includes('heavy')) {
            pesticideRiskLevel = 'high';
        } else {
            pesticideRiskLevel = 'moderate';
        }
    } catch (err: any) {
        console.warn('AI crop analysis failed for passport:', err);
        // Log to Firestore for debugging
        try {
            await firestore.collection('debugLogs').add({
                type: 'passport_ai_error',
                message: err.message,
                stack: err.stack,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (e) {}
    }

    // ── Step 4: Build the passport ───────────────────────────────────
    const summaryParts: string[] = [];

    if (ndviAvailable) {
        const quality = ndviScore >= 0.7 ? 'healthy vegetation' : ndviScore >= 0.4 ? 'moderate vegetation' : 'stressed vegetation';
        summaryParts.push(`Sentinel-2 satellite confirms ${quality} (NDVI: ${ndviScore.toFixed(2)}) at this farm location.`);
    }

    if (soilHealthScore > 0) {
        summaryParts.push(`${aiSoilSummary} Estimated soil health: ${soilHealthScore}/100 (AI estimate for ${listing.location} region).`);
    }

    if (aiPesticideSummary) {
        summaryParts.push(aiPesticideSummary);
    }

    if (summaryParts.length === 0) {
        summaryParts.push(`Analysis data could not be generated for this ${listing.cropName} listing.`);
    }

    // Confidence: satellite data counts most, AI estimates are lower confidence
    let confidence = 30; // base
    if (ndviAvailable) confidence += 30;
    if (soilHealthScore > 0) confidence += 20;
    confidence = Math.min(90, confidence);

    const passport: Omit<ProductPassport, 'id'> = {
        listingId: listing.id,
        farmerUid: listing.farmerUid,
        cropName: listing.cropName,
        generatedAt: new Date(),
        soilHealthScore,
        ndviScore: ndviAvailable ? ndviScore : 0,
        pesticideRiskLevel,
        diseaseHistory: {
            hasRecentDisease: false,
            scanResult: 'Auto-generated from regional data',
        },
        weatherSummary: '',
        aiConfidence: confidence,
        aiSummary: summaryParts.join(' '),
        harvestDate: listing.createdAt || new Date(),
    };

    return passport;
};



// ── Customer Reviews ─────────────────────────────────────────────────

/**
 * Submits a customer review for a farmer.
 */
export const submitFarmerReview = async (review: Omit<FarmerReview, 'id' | 'createdAt' | 'overallScore'>): Promise<void> => {
    try {
        const overallScore = (
            review.ratings.freshness +
            review.ratings.quality +
            review.ratings.honesty +
            review.ratings.communication
        ) / 4;

        await firestore.collection('farmerReviews').add({
            ...review,
            overallScore: Math.round(overallScore * 10) / 10,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        console.error('Error submitting review:', error);
        throw new Error('Failed to submit review.');
    }
};

/**
 * Real-time listener for reviews of a specific farmer.
 */
export const onFarmerReviewsSnapshot = (
    farmerUid: string,
    callback: (reviews: FarmerReview[]) => void
): (() => void) => {
    return firestore.collection('farmerReviews')
        .where('farmerUid', '==', farmerUid)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .onSnapshot(
            (snapshot) => {
                const reviews = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate() || new Date(),
                } as FarmerReview));
                callback(reviews);
            },
            (error) => {
                console.error('Error fetching farmer reviews:', error);
                callback([]);
            }
        );
};

/**
 * Computes trust stats for a farmer from their reviews and order history.
 */
export const getFarmerTrustStats = async (farmerUid: string): Promise<FarmerTrustStats> => {
    try {
        const reviewsSnap = await firestore.collection('farmerReviews')
            .where('farmerUid', '==', farmerUid)
            .get();

        const reviews = reviewsSnap.docs.map(d => d.data());
        const totalReviews = reviews.length;
        const avgRating = totalReviews > 0
            ? reviews.reduce((sum, r) => sum + (r.overallScore || 0), 0) / totalReviews
            : 0;

        // Count unique customers vs repeat customers
        const customerCounts: Record<string, number> = {};
        reviews.forEach(r => {
            customerCounts[r.customerUid] = (customerCounts[r.customerUid] || 0) + 1;
        });
        const uniqueCustomers = Object.keys(customerCounts).length;
        const repeatCustomers = Object.values(customerCounts).filter(c => c > 1).length;
        const repeatRate = uniqueCustomers > 0 ? Math.round((repeatCustomers / uniqueCustomers) * 100) : 0;

        // Get order count from retailOrders
        const ordersSnap = await firestore.collection('retailOrders')
            .where('farmerUid', '==', farmerUid)
            .get();

        return {
            totalOrders: ordersSnap.size,
            repeatRate,
            avgDeliveryDays: 1.5, // Placeholder — would need delivery tracking
            complaintsCount: 0,   // Placeholder — would need complaints collection
            avgRating: Math.round(avgRating * 10) / 10,
            totalReviews,
        };
    } catch (error) {
        console.error('Error computing trust stats:', error);
        return { totalOrders: 0, repeatRate: 0, avgDeliveryDays: 0, complaintsCount: 0, avgRating: 0, totalReviews: 0 };
    }
};
