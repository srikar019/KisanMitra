/**
 * API Client for Firebase Cloud Functions
 * Routes AI/Exa calls through the backend to avoid CORS issues
 */
/* cspell:ignore cloudfunctions */

import { auth } from './firebase';
import type { IndianAgriNewsResponse, CropPricePrediction, ProfitForecastRequest, ProfitForecastResponse } from '../types';

// Get Cloud Functions base URL from environment or derive from Firebase config
const getApiBaseUrl = (): string => {
    // Use environment variable if set (recommended for production)
    const envUrl = import.meta.env.VITE_FUNCTIONS_URL;
    if (envUrl) {
        return envUrl;
    }
    
    // Derive from Firebase project ID
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    if (projectId) {
        // Firebase Cloud Functions URL format (cloudfunctions is correct - it's Google's domain)
        return `https://us-central1-${projectId}.cloudfunctions.net/api`;
    }
    
    // Fallback to emulator for local development
    return 'http://localhost:5001/demo-project/us-central1/api';
};

/**
 * Get the current user's auth token for authenticated requests
 */
const getAuthToken = async (): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
};

/**
 * Make an authenticated API request to Cloud Functions
 */
const apiRequest = async <T>(endpoint: string, body: Record<string, unknown>): Promise<T> => {
    const token = await getAuthToken();
    
    const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `API request failed: ${response.status}`);
    }

    return response.json();
};

/**
 * Get Indian Agri News via Cloud Functions (avoids Exa CORS)
 */
export const fetchIndianAgriNews = async (
    location?: string,
    topic?: string,
    timeFilter?: string,
    language: string = 'en'
): Promise<IndianAgriNewsResponse> => {
    return apiRequest<IndianAgriNewsResponse>('/getIndianAgriNews', {
        location,
        topic,
        timeFilter,
        language,
    });
};

/**
 * Get Market Price Prediction via Cloud Functions
 */
export const fetchMarketPricePrediction = async (
    cropName: string,
    location: string,
    startDate: string,
    endDate: string,
    language: string = 'en'
): Promise<CropPricePrediction> => {
    return apiRequest<CropPricePrediction>('/getMarketPricePrediction', {
        cropName,
        location,
        startDate,
        endDate,
        language,
    });
};

/**
 * Get Profit Forecast via Cloud Functions
 */
export const fetchProfitForecast = async (
    request: ProfitForecastRequest,
    language: string = 'en'
): Promise<ProfitForecastResponse> => {
    return apiRequest<ProfitForecastResponse>('/getProfitForecast', {
        ...request,
        language,
    });
};
