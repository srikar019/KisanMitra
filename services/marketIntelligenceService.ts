/**
 * Gemini AI Service — Market & Agriculture Intelligence Module
 * Handles market prices, profit forecasts, crop yield predictions,
 * planting recommendations, and Indian agri news.
 */
import { GoogleGenAI, Type } from "@google/genai";
import Exa from "exa-js";
import type {
    PlantingRequest, PlantingRecommendationResponse,
    CropPricePrediction, WebSource,
    CropYieldRequest, CropYieldResponse,
    PriceBrokerAnalysis, Alert,
    ProfitForecastRequest, ProfitForecastResponse,
    IndianAgriNewsResponse
} from '../types';
import { TTLCache } from './retryUtils';
import { extractJson, getLanguageInstruction } from './weatherService';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}
if (!process.env.EXA_API_KEY) {
    throw new Error("EXA_API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const exa = new Exa(process.env.EXA_API_KEY);

// ─── TTL Caches ──────────────────────────────────────────────────────────
const marketPriceCache = new TTLCache<string, CropPricePrediction>(10 * 60 * 1000, 50);
const profitForecastCache = new TTLCache<string, ProfitForecastResponse>(10 * 60 * 1000, 30);
const indianAgriNewsCache = new TTLCache<string, IndianAgriNewsResponse>(15 * 60 * 1000, 20);

const handleGeminiError = (error: unknown, context: string): never => {
    console.error(`Error ${context}:`, error);
    if (error instanceof Error && (error.message.includes('429') || error.message.toUpperCase().includes('RESOURCE_EXHAUSTED'))) {
        throw new Error("API request limit reached. Please try again in a few minutes.");
    }
    if (error instanceof SyntaxError) {
        throw new Error("Failed to parse the data from the AI. The format was unexpected.");
    }
    throw new Error(`An AI error occurred while ${context}.`);
};

// ─── Planting Recommendations ────────────────────────────────────────────

export const getPlantingRecommendations = async (request: PlantingRequest, language: string = 'en'): Promise<PlantingRecommendationResponse> => {
    try {
        const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Today is ${currentDate}. Provide planting recommendations for ${request.cropType} in ${request.location} considering soil type ${request.soilType}. Previous crop: ${request.previousCrop || 'None'}. Determine the current growing season (like Zaid/Summer, Kharif, or Rabi) based on this date and location. ${getLanguageInstruction(language)}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        season: { type: Type.STRING, description: "Current growing season" },
                        recommendations: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    cropName: { type: Type.STRING },
                                    reason: { type: Type.STRING },
                                    plantingTime: { type: Type.STRING },
                                    daysToHarvest: { type: Type.INTEGER },
                                    imageUrl: { type: Type.STRING, description: "Optional image URL" }
                                },
                                required: ["cropName", "reason", "plantingTime", "daysToHarvest"]
                            }
                        }
                    },
                    required: ["season", "recommendations"]
                }
            },
        });
        return JSON.parse(response.text || '{}') as PlantingRecommendationResponse;
    } catch (error) {
        return handleGeminiError(error, 'getting planting recommendations');
    }
};

// ─── Market Price Prediction ─────────────────────────────────────────────

export const getMarketPricePrediction = async (cropName: string, location: string, startDate: string, endDate: string, language: string = 'en'): Promise<CropPricePrediction> => {
    const cacheKey = `${cropName}|${location}|${startDate}-${endDate}|lang:${language}`;
    const cached = marketPriceCache.get(cacheKey);
    if (cached) return cached;

    try {
        const exaResults = await exa.searchAndContents(`Current market price prediction and trends for ${cropName} in ${location} ${startDate} to ${endDate}`, {
            type: "auto" as const,
            numResults: 3,
            text: { maxCharacters: 5000 }
        });
        const context = exaResults.results.map((r) => `Source: ${r.title ?? 'Unknown'}\n${r.text ?? ''}`).join('\n\n');

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Using this real-time web context: ${context}\n\nProvide Market price prediction for ${cropName} in ${location}. ${getLanguageInstruction(language)} Respond STRICTLY with a valid JSON object matching this schema, no markdown or conversational text:
{
  "cropName": "${cropName}",
  "location": "${location}",
  "currentPrice": number,
  "predictedPriceNextMonth": number,
  "priceUnit": string,
  "trend": "up" | "down" | "stable",
  "analysis": string,
  "historicalData": [{"month": string, "price": number}],
  "predictedData": [{"month": string, "price": number}]
}`,
        });
        const parsed = JSON.parse(extractJson(response.text || '{}'));
        const sources: WebSource[] = exaResults.results.map((r) => ({ uri: r.url, title: r.title ?? 'Source' }));
        const result = { ...parsed, sources };
        marketPriceCache.set(cacheKey, result);
        return result;
    } catch (error) {
        return handleGeminiError(error, 'getting market price prediction');
    }
};

// ─── Profit Forecaster ───────────────────────────────────────────────────

export const getProfitForecast = async (request: ProfitForecastRequest, language: string = 'en'): Promise<ProfitForecastResponse> => {
    const cacheKey = `${request.cropName}|${request.location}|lang:${language}`;
    const cached = profitForecastCache.get(cacheKey);
    if (cached) return cached;

    try {
        const exaResults = await exa.searchAndContents(`Profit margin forecast, demand, and analysis for ${request.cropName} in ${request.location}`, {
            type: "auto" as const,
            numResults: 3,
            text: { maxCharacters: 5000 }
        });
        const context = exaResults.results.map((r) => `Source: ${r.title ?? 'Unknown'}\n${r.text ?? ''}`).join('\n\n');

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Using this real-time web context: ${context}\n\nProvide Profit forecast for ${request.cropName} in ${request.location}. ${getLanguageInstruction(language)} Respond STRICTLY with a valid JSON object matching this schema, no markdown or conversational text:
{
  "predictedMarketPrice": number,
  "priceUnit": string,
  "totalRevenue": number,
  "netProfitOrLoss": number,
  "returnOnInvestment": number,
  "analysis": string,
  "alternativeCrops": [{"cropName": string, "profitMarginChange": string, "reasoning": string}]
}`,
        });
        const parsed = JSON.parse(extractJson(response.text || '{}'));
        const sources: WebSource[] = exaResults.results.map((r) => ({ uri: r.url, title: r.title ?? 'Source' }));
        const result = { ...parsed, sources };
        profitForecastCache.set(cacheKey, result);
        return result;
    } catch (error) {
        return handleGeminiError(error, `getting profit forecast`);
    }
};

// ─── Crop Yield Prediction ───────────────────────────────────────────────

export const getCropYieldPrediction = async (request: CropYieldRequest, language: string = 'en'): Promise<CropYieldResponse> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Provide a detailed crop yield prediction for ${request.crop} in ${request.location}. Assume cultivation area: ${request.area} ${request.areaUnit}. Soil type: ${request.soilType}. Include historical yield trends and major influencing factors. ${getLanguageInstruction(language)}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        predictedYield: { type: Type.STRING, description: "Total predicted yield as a number range or value string" },
                        yieldUnit: { type: Type.STRING },
                        historicalYieldData: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    year: { type: Type.INTEGER },
                                    yield: { type: Type.NUMBER }
                                },
                                required: ["year", "yield"]
                            }
                        },
                        analysis: { type: Type.STRING },
                        influencingFactors: {
                            type: Type.OBJECT,
                            properties: {
                                positive: { type: Type.ARRAY, items: { type: Type.STRING } },
                                negative: { type: Type.ARRAY, items: { type: Type.STRING } }
                            },
                            required: ["positive", "negative"]
                        },
                        recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["predictedYield", "yieldUnit", "historicalYieldData", "analysis", "influencingFactors", "recommendations"]
                }
            },
        });
        return JSON.parse(response.text || '{}') as CropYieldResponse;
    } catch (error) {
        return handleGeminiError(error, 'getting yield prediction');
    }
};

// ─── Price Broker Analysis ───────────────────────────────────────────────

export const getPriceBrokerAnalysis = async (cropName: string, location: string, language: string = 'en'): Promise<PriceBrokerAnalysis> => {
    try {
        const exaResults = await exa.searchAndContents(`Broker price analysis, trends, and demand for ${cropName} in ${location}`, {
            type: "auto" as const,
            numResults: 3,
            text: { maxCharacters: 5000 }
        });
        const context = exaResults.results.map((r) => `Source: ${r.title ?? 'Unknown'}\n${r.text ?? ''}`).join('\n\n');

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Using this real-time web context: ${context}\n\nProvide Broker price analysis for ${cropName} in ${location}. ${getLanguageInstruction(language)} Respond in JSON.`,
        });
        const parsed = JSON.parse(extractJson(response.text || '{}'));
        const sources: WebSource[] = exaResults.results.map((r) => ({ uri: r.url, title: r.title ?? 'Source' }));
        return { ...parsed, sources };
    } catch (error) {
        return handleGeminiError(error, `getting broker analysis`);
    }
};

// ─── Market Price Alerts ─────────────────────────────────────────────────

export const analyzeMarketPredictionForAlerts = async (prediction: CropPricePrediction, language: string = 'en'): Promise<Omit<Alert, 'id' | 'uid' | 'status' | 'createdAt' | 'relatedView' | 'relatedEntityId'> | null> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Market risk analysis for: ${JSON.stringify(prediction)}.\n\n${getLanguageInstruction(language)} Respond strictly with JSON containing 'severity' and 'message' fields if a significant alert should be raised, otherwise respond with {}. Do not include markdown formatting like \`\`\`json.`,
        });
        const data = JSON.parse(extractJson(response.text || '{}') || response.text || '{}');
        return data.severity ? { type: 'market', ...data } : null;
    } catch (error) {
        return handleGeminiError(error, 'analyzing market alerts');
    }
};

// ─── Indian Agri News ────────────────────────────────────────────────────

interface ExaSearchOptions {
    category?: 'news' | 'company' | 'research paper' | 'pdf' | 'personal site' | 'financial report' | 'people';
    type?: 'auto' | 'keyword' | 'neural';
    numResults?: number;
    text?: { maxCharacters: number };
    startPublishedDate?: string;
}

export const getIndianAgriNews = async (location?: string, topic?: string, timeFilter?: string, language: string = 'en'): Promise<IndianAgriNewsResponse> => {
    const cacheKey = `${location || 'national'}|${topic || ''}|${timeFilter || ''}|lang:${language}`;
    const cached = indianAgriNewsCache.get(cacheKey);
    if (cached) return cached;

    try {
        const topicQuery = topic ? ` about ${topic}` : '';
        const exaOptions: ExaSearchOptions = {
            category: "news",
            type: "auto",
            numResults: 25,
            text: { maxCharacters: 5000 }
        };

        if (timeFilter) {
            const now = new Date();
            let daysToSub = 0;
            if (timeFilter === '1d') daysToSub = 1;
            else if (timeFilter === '7d') daysToSub = 7;
            else if (timeFilter === '30d') daysToSub = 30;
            else if (timeFilter === '90d') daysToSub = 90;
            else if (timeFilter === '180d') daysToSub = 180;

            if (daysToSub > 0) {
                now.setDate(now.getDate() - daysToSub);
                exaOptions.startPublishedDate = now.toISOString();
            }
        }

        const exaResults = await exa.searchAndContents(`Latest agriculture news ${location || 'national'}${topicQuery}`, exaOptions as Parameters<typeof exa.searchAndContents>[1]);
        const context = exaResults.results.map((r: Record<string, unknown>) => `Source: ${(r.title as string) ?? 'Unknown'}\n${(r.text as string) ?? ''}`).join('\n\n');

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Using this real-time news context: ${context}\n\nProvide Indian agri news for ${location || 'national'}${topic ? ` focused on ${topic}` : ''}. ${getLanguageInstruction(language)} You MUST extract and return up to 10 distinct news articles, exactly 5 related government schemes, and exactly 5 financial incentives. If the text does not contain enough specific schemes or incentives, use your knowledge base to fill out the remaining slots with highly relevant national or state-level agricultural schemes and incentives. Respond STRICTLY with a valid JSON object matching this schema, no markdown or conversational text:
{
  "news": [{"title": string, "summary": string, "source": string, "url": string, "publishedDate": string}],
  "schemes": [{"name": string, "description": string, "benefits": ["string"], "eligibility": string, "howToApply": string, "officialLink": string}],
  "incentives": [{"name": string, "description": string, "benefitAmount": string, "eligibility": string, "applicationProcess": string, "link": string}]
}`,
        });
        const parsed = JSON.parse(extractJson(response.text || '{}'));
        const sources: WebSource[] = exaResults.results.map((r) => ({ uri: r.url, title: r.title ?? 'Source' }));
        const result = { ...parsed, sources };
        indianAgriNewsCache.set(cacheKey, result);
        return result;
    } catch (error) {
        return handleGeminiError(error, 'getting Indian agri news');
    }
};
