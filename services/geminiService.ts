import { GoogleGenAI, Type } from "@google/genai";
import Exa from "exa-js";
import { ActiveView } from '../types';
import type { WeatherData, DiseaseReport, PlantingRecommendation, PlantingRequest, DiseaseHotspot, SoilHealthReport, PlantingRecommendationResponse, CropPricePrediction, WebSource, ChatMessage, NegotiationTerms, NegotiationResponse, CropYieldRequest, CropYieldResponse, PriceBrokerAnalysis, MicroclimateAnalysis, Alert, Livestock, LivestockHealthAnalysis, ProfitForecastRequest, ProfitForecastResponse, IndianAgriNewsResponse, RecipeResponse, ParsedListItem, ParsedCommand, DynamicSubscriptionPreferences, WeeklyProduceItem, CuratedItem, CSATier, FarmMachinery, MachineryRentalRequest, Zone, ProductListing } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

if (!process.env.EXA_API_KEY) {
  throw new Error("EXA_API_KEY environment variable is not set");
}
const exa = new Exa(process.env.EXA_API_KEY);

const diseaseReportCache = new Map<string, DiseaseReport>();
const soilHealthCache = new Map<string, SoilHealthReport>();
const weatherCache = new Map<string, WeatherData>();
const plantingRecommendationsCache = new Map<string, PlantingRecommendationResponse>();

const coordinatesCache = new Map<string, { lat: number; lng: number }>();
const marketPriceCache = new Map<string, CropPricePrediction>();
const microclimateCache = new Map<string, MicroclimateAnalysis>();
const profitForecastCache = new Map<string, ProfitForecastResponse>();
let diseaseHotspotsCache: DiseaseHotspot[] | null = null;
const indianAgriNewsCache = new Map<string, IndianAgriNewsResponse>();
const recipeCache = new Map<string, RecipeResponse>();

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

const extractJson = (text: string): string => {
    if (!text) return '';
    const markdownMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        return markdownMatch[1];
    }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    
    // Find the outermost structure (either array or object)
    if (firstBrace !== -1 && lastBrace > firstBrace && (firstBracket === -1 || firstBrace < firstBracket)) {
        return text.substring(firstBrace, lastBrace + 1);
    }
    if (firstBracket !== -1 && lastBracket > firstBracket) {
        return text.substring(firstBracket, lastBracket + 1);
    }
    
    return text.trim();
};

const getLanguageName = (lang: string = 'en') => {
    const names: Record<string, string> = { 'en': 'English', 'hi': 'Hindi', 'te': 'Telugu' };
    return names[lang] || 'English';
};

const getLanguageInstruction = (lang: string = 'en') => {
    return `You MUST provide all natural language text (descriptions, titles, instructions, analysis, reasons, etc.) in ${getLanguageName(lang)}. Keep JSON keys and structural identifiers in English as per the schema, but translate the values that are shown to the user.`;
};

export const getRecipesForIngredients = async (ingredients: string[], availableCrops: string[], dietaryPrefs: string[] = [], recipeCount: number = 3, language: string = 'en'): Promise<RecipeResponse> => {
    const cacheKey = `recipes|${ingredients.sort().join(',')}|${availableCrops.sort().join(',')}|${dietaryPrefs.sort().join(',')}|count:${recipeCount}|lang:${language}`;
    if (recipeCache.has(cacheKey)) return recipeCache.get(cacheKey)!;

    try {
        const cropsListStr = availableCrops.length > 0 ? availableCrops.join(', ') : "No fresh crops currently listed.";
        const prefsStr = dietaryPrefs.length > 0 ? `Dietary Restrictions: ${dietaryPrefs.join(', ')}.` : '';
        
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `User has: "${ingredients.join(', ')}". 
            Local Marketplace has: "${cropsListStr}".
            ${prefsStr}
            Desired Recipe Count: ${recipeCount}`,
            config: {
                systemInstruction: `You are a creative world-class chef specializing in Indian Cuisine. 
                ALWAYS generate EXACTLY ${recipeCount} high-quality recipes using the user's pantry items.
                Focus on diverse Indian dishes such as Curries, Rice Items (Biryani, Pulao), Dals, and Starters.
                
                STRICTLY adhere to these dietary preferences if provided: ${dietaryPrefs.join(', ')}.
                
                RULES:
                1. Provide a FULL list of ingredients for every recipe.
                2. For each ingredient, set "availableOnMarket" to true if it matches an item in the 'Local Marketplace' list provided.
                3. Assume standard pantry staples like oil, salt, and basic spices are available.
                4. ${getLanguageInstruction(language)}
                
                RESPONSE: Return valid JSON with a "recipes" array containing exactly ${recipeCount} items.`,
                thinkingConfig: { thinkingBudget: 0 },
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        recipes: {
                            type: Type.ARRAY,
                            minItems: recipeCount,
                            maxItems: recipeCount,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    prepTime: { type: Type.STRING },
                                    ingredients: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                name: { type: Type.STRING },
                                                quantity: { type: Type.STRING },
                                                availableOnMarket: { type: Type.BOOLEAN },
                                            },
                                            required: ['name', 'quantity', 'availableOnMarket']
                                        },
                                    },
                                    instructions: {
                                        type: Type.ARRAY,
                                        items: { type: Type.STRING },
                                    },
                                },
                                required: ['title', 'description', 'prepTime', 'ingredients', 'instructions']
                            },
                        },
                    },
                    required: ['recipes']
                },
            },
        });

        const rawText = response.text || '';
        const jsonText = extractJson(rawText);
        if (!jsonText) throw new Error("AI returned empty response.");
        
        const data = JSON.parse(jsonText) as RecipeResponse;
        
        if (!data || !data.recipes || !Array.isArray(data.recipes)) {
             throw new Error("Malformed recipe data received.");
        }

        const result = { recipes: data.recipes };
        recipeCache.set(cacheKey, result);
        return result;

    } catch (error) {
        return handleGeminiError(error, `generating recipes`);
    }
};

export const getWeatherForecast = async (location: string): Promise<WeatherData> => {
  const cacheKey = location.trim().toLowerCase();
  if (weatherCache.has(cacheKey)) return weatherCache.get(cacheKey)!;
  try {
    const { lat, lng } = await getCoordinatesForLocation(location);
    const params = new URLSearchParams({
      latitude: lat.toString(), longitude: lng.toString(),
      current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min',
      forecast_days: '5', timezone: 'auto',
    });
    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    const weatherResponse = await fetch(url);
    if (!weatherResponse.ok) throw new Error(`Failed to fetch weather data: ${weatherResponse.statusText}`);
    const data = await weatherResponse.json();
    if (data.error) throw new Error(`Open-Meteo API Error: ${data.reason}`);
    
    const weatherData: WeatherData = {
      currentWeather: {
        temperature: Math.round(data.current?.temperature_2m || 0),
        condition: getWeatherConditionFromWMO(data.current?.weather_code || 0),
        humidity: data.current?.relative_humidity_2m || 0,
        windSpeed: Math.round(data.current?.wind_speed_10m || 0),
      },
      dailyForecast: (data.daily?.time || []).map((dateString: string, index: number) => ({
        day: new Date(dateString).toLocaleDateString('en-US', { weekday: 'short' }),
        high: Math.round(data.daily.temperature_2m_max[index] || 0),
        low: Math.round(data.daily.temperature_2m_min[index] || 0),
        condition: getWeatherConditionFromWMO(data.daily.weather_code[index] || 0),
      })),
      seasonalContext: getSeasonalContext(lat),
    };
    weatherCache.set(cacheKey, weatherData);
    return weatherData;
  } catch (error) {
    return handleGeminiError(error, `fetching weather forecast for "${location}"`);
  }
};

const getWeatherConditionFromWMO = (code: number): string => {
    const wmoMap: { [key: number]: string } = {
        0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
        45: 'Fog', 48: 'Depositing Rime Fog', 51: 'Light Drizzle', 53: 'Moderate Drizzle',
        55: 'Dense Drizzle', 56: 'Light Freezing Drizzle', 57: 'Dense Freezing Drizzle',
        61: 'Slight Rain', 63: 'Moderate Rain', 65: 'Heavy Rain', 66: 'Light Freezing Rain',
        67: 'Heavy Freezing Rain', 71: 'Slight Snow Fall', 73: 'Moderate Snow Fall',
        75: 'Heavy Snow Fall', 77: 'Snow Grains', 80: 'Slight Rain Showers',
        81: 'Moderate Rain Showers', 82: 'Violent Rain Showers', 85: 'Slight Snow Showers',
        86: 'Heavy Snow Showers', 95: 'Thunderstorm', 96: 'Thunderstorm with Hail',
        99: 'Thunderstorm with Heavy Hail',
    };
    return wmoMap[code] || 'Unknown';
};

const getSeasonalContext = (latitude: number, date: Date = new Date()): string => {
    const month = date.getMonth();
    const isNorthernHemisphere = latitude >= 0;
    let season: string;
    if (isNorthernHemisphere) {
        if (month >= 2 && month <= 4) season = 'Spring';
        else if (month >= 5 && month <= 7) season = 'Summer';
        else if (month >= 8 && month <= 10) season = 'Autumn';
        else season = 'Winter';
    } else {
        if (month >= 8 && month <= 10) season = 'Spring';
        else if (month >= 11 || month <= 1) season = 'Summer';
        else if (month >= 2 && month <= 4) season = 'Autumn';
        else season = 'Winter';
    }
    switch (season) {
        case 'Spring': return `It's ${season}. Expect milder weather with a mix of sun and rain as temperatures rise.`;
        case 'Summer': return `It's ${season}. Expect warm to hot temperatures and longer daylight hours.`;
        case 'Autumn': return `It's ${season}. Expect cooler temperatures and changing foliage.`;
        case 'Winter': return `It's ${season}. Expect cold temperatures, with potential for frost or snow depending on the region.`;
        default: return 'Weather conditions are typical for the current season.';
    }
};

export const getCoordinatesForLocation = async (locationName: string): Promise<{ lat: number; lng: number }> => {
  const cacheKey = locationName.trim().toLowerCase();
  if (coordinatesCache.has(cacheKey)) return coordinatesCache.get(cacheKey)!;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Provide the latitude and longitude for the location: "${locationName}". Respond ONLY with JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER },
          },
          required: ['lat', 'lng']
        },
      },
    });
    const jsonText = response.text || '{}';
    const coords = JSON.parse(jsonText) as { lat: number; lng: number };
    coordinatesCache.set(cacheKey, coords);
    return coords;
  } catch (error) {
    return handleGeminiError(error, `getting coordinates for "${locationName}"`);
  }
};

export const detectCropDisease = async (imageBase64: string, mimeType: string, language: string = 'en'): Promise<DiseaseReport> => {
  const cacheKey = `${imageBase64}|lang:${language}`;
  if (diseaseReportCache.has(cacheKey)) return diseaseReportCache.get(cacheKey)!;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [
        { inlineData: { data: imageBase64, mimeType } },
        { text: `Analyze plant disease. Respond in JSON. ${getLanguageInstruction(language)}` }
      ] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isHealthy: { type: Type.BOOLEAN },
            diseaseName: { type: Type.STRING },
            description: { type: Type.STRING },
            treatment: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
    });
    const report = JSON.parse(response.text || '{}') as DiseaseReport;
    diseaseReportCache.set(cacheKey, report);
    return report;
  } catch (error) {
    return handleGeminiError(error, 'detecting crop disease');
  }
};

export const analyzeSoilHealth = async (imageBase64: string, mimeType: string, language: string = 'en'): Promise<SoilHealthReport> => {
  const cacheKey = `${imageBase64}|lang:${language}`;
  if (soilHealthCache.has(cacheKey)) return soilHealthCache.get(cacheKey)!;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [
        { inlineData: { data: imageBase64, mimeType } },
        { text: `Analyze soil health. Respond in JSON. ${getLanguageInstruction(language)}` }
      ] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            soilType: { type: Type.STRING },
            texture: { type: Type.STRING },
            phLevel: { type: Type.STRING },
            organicMatter: { type: Type.STRING },
            nutrientAnalysis: { type: Type.STRING },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['soilType', 'texture', 'phLevel', 'organicMatter', 'nutrientAnalysis', 'recommendations']
        },
      },
    });
    const report = JSON.parse(response.text || '{}') as SoilHealthReport;
    soilHealthCache.set(cacheKey, report);
    return report;
  } catch (error) {
    return handleGeminiError(error, 'analyzing soil health');
  }
};






export const getLivestockHealthAnalysis = async (animal: Livestock, language: string = 'en'): Promise<LivestockHealthAnalysis> => {
    try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
            contents: `Vet analysis for ${animal.type} ${animal.breed}. Health context: ${animal.healthStatus}. Notes: ${animal.notes || 'None'}. JSON format. ${getLanguageInstruction(language)}`,
            config: { responseMimeType: "application/json" },
        });
        return JSON.parse(response.text || '{}') as LivestockHealthAnalysis;
    } catch (error) {
        return handleGeminiError(error, `getting livestock health analysis`);
    }
};

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
        const data = JSON.parse(response.text || '{}') as PlantingRecommendationResponse;
        return data;
    } catch (error) {
        return handleGeminiError(error, 'getting planting recommendations');
    }
};

export const getMarketPricePrediction = async (cropName: string, location: string, startDate: string, endDate: string, language: string = 'en'): Promise<CropPricePrediction> => {
    try {
        const exaResults = await exa.searchAndContents(`Current market price prediction and trends for ${cropName} in ${location} ${startDate} to ${endDate}`, {
            type: "auto",
            numResults: 3,
            text: { maxCharacters: 5000 }
        });
        const context = exaResults.results.map(r => `Source: ${r.title}\n${r.text}`).join('\n\n');

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
        const sources: WebSource[] = exaResults.results.map(r => ({ uri: r.url, title: r.title || 'Source' }));
        return { ...parsed, sources };
    } catch (error) {
        return handleGeminiError(error, 'getting market price prediction');
    }
};

export const getProfitForecast = async (request: ProfitForecastRequest, language: string = 'en'): Promise<ProfitForecastResponse> => {
    try {
        const exaResults = await exa.searchAndContents(`Profit margin forecast, demand, and analysis for ${request.cropName} in ${request.location}`, {
            type: "auto",
            numResults: 3,
            text: { maxCharacters: 5000 }
        });
        const context = exaResults.results.map(r => `Source: ${r.title}\n${r.text}`).join('\n\n');

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
        const sources: WebSource[] = exaResults.results.map(r => ({ uri: r.url, title: r.title || 'Source' }));
        return { ...parsed, sources };
    } catch (error) {
        return handleGeminiError(error, `getting profit forecast`);
    }
};

export const getIndianAgriNews = async (location?: string, topic?: string, timeFilter?: string, language: string = 'en'): Promise<IndianAgriNewsResponse> => {
    try {
        const topicQuery = topic ? ` about ${topic}` : '';
        const exaOptions: any = {
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

        const exaResults = await exa.searchAndContents(`Latest agriculture news ${location || 'national'}${topicQuery}`, exaOptions);
        const context = exaResults.results.map((r: any) => `Source: ${r.title}\n${r.text}`).join('\n\n');

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
        const sources: WebSource[] = exaResults.results.map(r => ({ uri: r.url, title: r.title || 'Source' }));
        return { ...parsed, sources };
    } catch (error) {
        return handleGeminiError(error, 'getting Indian agri news');
    }
};

export const getChatbotResponse = async (history: ChatMessage[], language: string = 'en'): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
            contents: history.map(msg => ({ role: msg.role, parts: [{ text: msg.content }] })),
            config: {
                systemInstruction: `You are AgriGenius AI. Help farmers. 5-6 bullet points. ${getLanguageInstruction(language)}`,
            },
        });
        return response.text || '';
    } catch (error) {
        return handleGeminiError(error, 'getting chatbot response');
    }
};

export const getOpeningOffer = async (terms: NegotiationTerms, language: string = 'en'): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
            contents: `You are an AI negotiating for a farmer (${terms.farmerName}). The farmer is selling ${terms.quantity} ${terms.unit} of ${terms.crop}. Target price is ${terms.targetPrice} ${terms.currency}. Write a short, friendly 2-sentence opening message to a potential buyer kicking off the negotiation. ${getLanguageInstruction(language)}`,
        });
        return response.text || `Hello! I see you're interested in purchasing ${terms.quantity} ${terms.unit} of ${terms.crop}. My starting offer is ${terms.targetPrice} ${terms.currency} per ${terms.unit}. What do you think?`;
    } catch (error) {
        return handleGeminiError(error, 'generating opening offer');
    }
};

export const getNextNegotiationStep = async (terms: NegotiationTerms, history: ChatMessage[], language: string = 'en'): Promise<NegotiationResponse> => {
    try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
            contents: `As an AI agent negotiating for a farmer, generate the next response. Target price is ${terms.targetPrice}, lowest acceptable is ${terms.lowestPrices[0] || terms.targetPrice}. ${getLanguageInstruction(language)} Respond in JSON matching the schema. Crop: ${terms.crop}. Quantity: ${terms.quantity} ${terms.unit}. Currency: ${terms.currency}. History: ${JSON.stringify(history)}`,
            config: { 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        suggestion: { type: Type.STRING, description: "Your message back to the customer" },
                        isDealClose: { type: Type.BOOLEAN, description: "True if you have reached a final agreement" },
                        dealSummary: {
                            type: Type.OBJECT,
                            properties: {
                                crop: { type: Type.STRING },
                                quantity: { type: Type.NUMBER },
                                unit: { type: Type.STRING },
                                finalPrice: { type: Type.NUMBER },
                                currency: { type: Type.STRING },
                            },
                        }
                    },
                    required: ["suggestion", "isDealClose"]
                }
            }
        });
        return JSON.parse(response.text || '{"suggestion":"I am unable to process that rate right now. Let us reconsider.","isDealClose":false}') as NegotiationResponse;
    } catch (error) {
        return handleGeminiError(error, 'getting next negotiation step');
    }
};

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

export const getPriceBrokerAnalysis = async (cropName: string, location: string, language: string = 'en'): Promise<PriceBrokerAnalysis> => {
    try {
        const exaResults = await exa.searchAndContents(`Broker price analysis, trends, and demand for ${cropName} in ${location}`, {
            type: "auto",
            numResults: 3,
            text: { maxCharacters: 5000 }
        });
        const context = exaResults.results.map(r => `Source: ${r.title}\n${r.text}`).join('\n\n');

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
            contents: `Using this real-time web context: ${context}\n\nProvide Broker price analysis for ${cropName} in ${location}. ${getLanguageInstruction(language)} Respond in JSON.`,
        });
        const parsed = JSON.parse(extractJson(response.text || '{}'));
        const sources: WebSource[] = exaResults.results.map(r => ({ uri: r.url, title: r.title || 'Source' }));
        return { ...parsed, sources };
    } catch (error) {
        return handleGeminiError(error, `getting broker analysis`);
    }
};

export const getMicroclimateAnalysis = async (coords: { lat: number; lng: number }, weatherData: WeatherData, language: string = 'en'): Promise<MicroclimateAnalysis> => {
    try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
            contents: `Microclimate division for farm at ${coords.lat}, ${coords.lng}. Weather: ${JSON.stringify(weatherData)}. ${getLanguageInstruction(language)} Respond in JSON.`,
            config: { responseMimeType: "application/json" },
        });
        return JSON.parse(response.text || '{}') as MicroclimateAnalysis;
    } catch (error) {
        return handleGeminiError(error, 'getting microclimate analysis');
    }
};

export const analyzeWeatherForAlerts = async (weatherData: WeatherData, language: string = 'en'): Promise<Omit<Alert, 'id' | 'uid' | 'status' | 'createdAt' | 'relatedView' | 'relatedEntityId'> | null> => {
    try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
            contents: `Agricultural risk analysis for: ${JSON.stringify(weatherData)}.\n\n${getLanguageInstruction(language)} Respond strictly with JSON containing 'severity' and 'message' (in ${getLanguageName(language)}) fields if a significant alert should be raised, otherwise respond with {}. Do not include markdown formatting like \`\`\`json.`,
        });
        const data = JSON.parse(extractJson(response.text || '{}') || response.text || '{}');
        return data.severity ? { type: 'weather', ...data } : null;
    } catch (error) {
        return handleGeminiError(error, 'analyzing weather alerts');
    }
};

export const analyzeMarketPredictionForAlerts = async (prediction: CropPricePrediction, language: string = 'en'): Promise<Omit<Alert, 'id' | 'uid' | 'status' | 'createdAt' | 'relatedView' | 'relatedEntityId'> | null> => {
    try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
            contents: `Market risk analysis for: ${JSON.stringify(prediction)}.\n\n${getLanguageInstruction(language)} Respond strictly with JSON containing 'severity' and 'message' (in ${getLanguageName(language)}) fields if a significant alert should be raised, otherwise respond with {}. Do not include markdown formatting like \`\`\`json.`,
        });
        const data = JSON.parse(extractJson(response.text || '{}') || response.text || '{}');
        return data.severity ? { type: 'market', ...data } : null;
    } catch (error) {
        return handleGeminiError(error, 'analyzing market alerts');
    }
};

export const parseShoppingList = async (listContent: { text?: string; imageBase64?: string; mimeType?: string }): Promise<ParsedListItem[]> => {
    try {
        const instructionText = listContent.text 
            ? "Extract list of grocery/produce items. If quantity or unit is not specified, default to 1 'unit'. Respond ONLY with a JSON array."
            : "Extract list of grocery/produce items from the image. If quantity or unit is not specified, default to 1 'unit'. Respond ONLY with a JSON array.";

        const contentParts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
        
        if (listContent.text) {
            contentParts.push({ text: listContent.text });
        } else if (listContent.imageBase64 && listContent.mimeType) {
            contentParts.push({ inlineData: { data: listContent.imageBase64, mimeType: listContent.mimeType } });
        }
        contentParts.push({ text: instructionText });
            
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
            contents: { role: 'user', parts: contentParts },
            config: { 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            itemName: { type: Type.STRING },
                            quantity: { type: Type.NUMBER },
                            unit: { type: Type.STRING },
                        },
                        required: ["itemName", "quantity", "unit"]
                    }
                }
            },
        });
        const jsonText = extractJson(response.text || '[]');
        return JSON.parse(jsonText) as ParsedListItem[];
    } catch (error) {
        return handleGeminiError(error, 'parsing shopping list');
    }
};

export const curateDynamicBox = async (preferences: DynamicSubscriptionPreferences, availableProduce: WeeklyProduceItem[], tier: CSATier): Promise<CuratedItem[]> => {
    try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
            contents: `Curate box for tier ${tier.name} (${tier.price} ${tier.currency}). Preferences: ${JSON.stringify(preferences)}. Availability: ${JSON.stringify(availableProduce)}. JSON array.`,
            config: { responseMimeType: "application/json" },
        });
        const jsonText = extractJson(response.text || '[]');
        return JSON.parse(jsonText) as CuratedItem[];
    } catch (error) {
        return handleGeminiError(error, 'curating dynamic box');
    }
};

export const getIrrigationRecommendation = async (zone: Zone, weather: WeatherData, language: string = 'en'): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
            contents: `Irrigation tip for ${zone.crop} at ${zone.soilMoisture}% moisture. Weather: ${JSON.stringify(weather)}. ${getLanguageInstruction(language)} Concise.`,
        });
        return (response.text || '').trim();
    } catch (error) {
        return handleGeminiError(error, 'getting irrigation tip');
    }
};

export const parseUserCommand = async (command: string): Promise<ParsedCommand> => {
    try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
            contents: `Parse user intent: "${command}". JSON with action and parameters.`,
            config: { responseMimeType: "application/json" }
        });
        const jsonText = extractJson(response.text || '{}');
        return JSON.parse(jsonText) as ParsedCommand;
    } catch (error) {
        return handleGeminiError(error, 'parsing user command');
    }
};
