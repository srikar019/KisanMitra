/**
 * Gemini AI Service — Weather & Location Module
 * Handles weather forecasts, coordinates, microclimate analysis, and weather alerts.
 */
import { GoogleGenAI, Type } from "@google/genai";
import type { WeatherData, MicroclimateAnalysis, Alert, Zone } from '../types';
import { TTLCache } from './retryUtils';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// ─── TTL Caches (5-minute TTL, max 50 entries) ──────────────────────────
const weatherCache = new TTLCache<string, WeatherData>(5 * 60 * 1000, 50);
const coordinatesCache = new TTLCache<string, { lat: number; lng: number }>(30 * 60 * 1000, 100);
const microclimateCache = new TTLCache<string, MicroclimateAnalysis>(10 * 60 * 1000, 20);

// ─── Shared Utilities ────────────────────────────────────────────────────

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

const getLanguageName = (lang: string = 'en'): string => {
    const names: Record<string, string> = { 'en': 'English', 'hi': 'Hindi', 'te': 'Telugu' };
    return names[lang] || 'English';
};

export const getLanguageInstruction = (lang: string = 'en'): string => {
    return `You MUST provide all natural language text (descriptions, titles, instructions, analysis, reasons, etc.) in ${getLanguageName(lang)}. Keep JSON keys and structural identifiers in English as per the schema, but translate the values that are shown to the user.`;
};

export const extractJson = (text: string): string => {
    if (!text) return '';
    const markdownMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (markdownMatch?.[1]) {
        return markdownMatch[1];
    }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    
    if (firstBrace !== -1 && lastBrace > firstBrace && (firstBracket === -1 || firstBrace < firstBracket)) {
        return text.substring(firstBrace, lastBrace + 1);
    }
    if (firstBracket !== -1 && lastBracket > firstBracket) {
        return text.substring(firstBracket, lastBracket + 1);
    }
    
    return text.trim();
};

// ─── Weather Services ────────────────────────────────────────────────────

export const getCoordinatesForLocation = async (locationName: string): Promise<{ lat: number; lng: number }> => {
  const cacheKey = locationName.trim().toLowerCase();
  const cached = coordinatesCache.get(cacheKey);
  if (cached) return cached;

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

const getWeatherConditionFromWMO = (code: number): string => {
    const wmoMap: Record<number, string> = {
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

export const getWeatherForecast = async (location: string): Promise<WeatherData> => {
  const cacheKey = location.trim().toLowerCase();
  const cached = weatherCache.get(cacheKey);
  if (cached) return cached;

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

export const getMicroclimateAnalysis = async (coords: { lat: number; lng: number }, weatherData: WeatherData, language: string = 'en'): Promise<MicroclimateAnalysis> => {
    const cacheKey = `${coords.lat},${coords.lng}|lang:${language}`;
    const cached = microclimateCache.get(cacheKey);
    if (cached) return cached;

    try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
            contents: `Microclimate division for farm at ${coords.lat}, ${coords.lng}. Weather: ${JSON.stringify(weatherData)}. ${getLanguageInstruction(language)} Respond in JSON.`,
            config: { responseMimeType: "application/json" },
        });
        const result = JSON.parse(response.text || '{}') as MicroclimateAnalysis;
        microclimateCache.set(cacheKey, result);
        return result;
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
