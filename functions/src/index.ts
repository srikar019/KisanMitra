/**
 * Firebase Cloud Functions - Secure Backend API Layer
 * Handles all AI API calls server-side with validation and rate limiting
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleGenAI } from '@google/genai';
import Exa from 'exa-js';
import * as cors from 'cors';
import * as express from 'express';
import {
  validateRequired,
  validateLocation,
  validateImageData,
  validateMimeType,
  validateLanguage,
  validateAll,
  sanitizeInput,
  checkRateLimit,
} from './validation';

// Initialize Firebase Admin
admin.initializeApp();

// Initialize AI services with environment variables (secure!)
const geminiApiKey = functions.config().gemini?.api_key || process.env.GEMINI_API_KEY;
const exaApiKey = functions.config().exa?.api_key || process.env.EXA_API_KEY;

if (!geminiApiKey) {
  throw new Error('GEMINI_API_KEY not configured. Run: firebase functions:config:set gemini.api_key="YOUR_KEY"');
}

if (!exaApiKey) {
  throw new Error('EXA_API_KEY not configured. Run: firebase functions:config:set exa.api_key="YOUR_KEY"');
}

const ai = new GoogleGenAI({ apiKey: geminiApiKey });
const exa = new Exa(exaApiKey);

// CORS configuration - only allow your domains
const corsOptions = {
  origin: true, // Change to your domain in production: ['https://your-app.web.app']
  credentials: true,
};

// Rate limiting storage (in production, use Redis or Firestore)
const rateLimitMap = new Map<string, number[]>();

// Express app for HTTP functions
const app = express();
app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));

/**
 * Middleware to verify Firebase Auth token
 */
const verifyAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized - No token provided' });
    return;
  }
  
  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }
};

/**
 * Middleware to check rate limits
 */
const rateLimitMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const userId = (req as any).user?.uid || 'anonymous';
  const rateCheck = checkRateLimit(rateLimitMap, userId, 20); // 20 calls per minute
  
  if (!rateCheck.isValid) {
    res.status(429).json({ error: rateCheck.error });
    return;
  }
  
  next();
};

// Apply auth and rate limiting to all routes
app.use(verifyAuth);
app.use(rateLimitMiddleware);

/**
 * POST /api/detectCropDisease
 * Analyzes crop images for disease detection
 */
app.post('/api/detectCropDisease', async (req, res) => {
  try {
    const { imageBase64, mimeType, language = 'en' } = req.body;
    
    // Server-side validation
    const validation = validateAll(
      validateImageData(imageBase64),
      validateMimeType(mimeType),
      validateLanguage(language)
    );
    
    if (!validation.isValid) {
      res.status(400).json({ error: validation.error });
      return;
    }
    
    // Call Gemini AI (API key is secure on server)
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: imageBase64, mimeType } },
          { text: `Analyze plant disease. Respond in JSON.` }
        ]
      },
      config: {
        responseMimeType: 'application/json',
      },
    });
    
    const result = JSON.parse(response.text || '{}');
    res.json(result);
    
  } catch (error) {
    console.error('Disease detection error:', error);
    res.status(500).json({ error: 'Failed to analyze crop disease' });
  }
});

/**
 * POST /api/analyzeSoilHealth
 * Analyzes soil images for health assessment
 */
app.post('/api/analyzeSoilHealth', async (req, res) => {
  try {
    const { imageBase64, mimeType, language = 'en' } = req.body;
    
    const validation = validateAll(
      validateImageData(imageBase64),
      validateMimeType(mimeType),
      validateLanguage(language)
    );
    
    if (!validation.isValid) {
      res.status(400).json({ error: validation.error });
      return;
    }
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: imageBase64, mimeType } },
          { text: `Analyze soil health. Respond in JSON.` }
        ]
      },
      config: {
        responseMimeType: 'application/json',
      },
    });
    
    const result = JSON.parse(response.text || '{}');
    res.json(result);
    
  } catch (error) {
    console.error('Soil analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze soil health' });
  }
});

/**
 * POST /api/getMarketPricePrediction
 * Gets market price predictions with web grounding (RAG)
 */
app.post('/api/getMarketPricePrediction', async (req, res) => {
  try {
    const { cropName, location, startDate, endDate, language = 'en' } = req.body;
    
    // Sanitize inputs
    const sanitizedCrop = sanitizeInput(cropName);
    const sanitizedLocation = sanitizeInput(location);
    
    const validation = validateAll(
      validateRequired(cropName, 'Crop name'),
      validateLocation(location),
      validateLanguage(language)
    );
    
    if (!validation.isValid) {
      res.status(400).json({ error: validation.error });
      return;
    }
    
    // Use Exa for web-grounded search (RAG pattern)
    const exaResults = await exa.searchAndContents(
      `Current market price prediction for ${sanitizedCrop} in ${sanitizedLocation}`,
      {
        type: 'auto',
        numResults: 3,
        text: { maxCharacters: 5000 }
      }
    );
    
    const context = exaResults.results.map(r => `Source: ${r.title}\n${r.text}`).join('\n\n');
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Using context: ${context}\n\nProvide market price prediction for ${sanitizedCrop} in ${sanitizedLocation}. JSON format.`,
      config: {
        responseMimeType: 'application/json',
      },
    });
    
    const result = JSON.parse(response.text || '{}');
    res.json(result);
    
  } catch (error) {
    console.error('Market prediction error:', error);
    res.status(500).json({ error: 'Failed to get market prediction' });
  }
});

/**
 * POST /api/getPlantingRecommendations
 * Gets AI-powered planting recommendations
 */
app.post('/api/getPlantingRecommendations', async (req, res) => {
  try {
    const { location, soilType, cropType, previousCrop, language = 'en' } = req.body;
    
    const validation = validateAll(
      validateLocation(location),
      validateRequired(soilType, 'Soil type'),
      validateRequired(cropType, 'Crop type'),
      validateLanguage(language)
    );
    
    if (!validation.isValid) {
      res.status(400).json({ error: validation.error });
      return;
    }
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Planting recommendations for ${cropType} in ${location}, soil: ${soilType}, previous: ${previousCrop || 'None'}. JSON format.`,
      config: {
        responseMimeType: 'application/json',
      },
    });
    
    const result = JSON.parse(response.text || '{}');
    res.json(result);
    
  } catch (error) {
    console.error('Planting recommendations error:', error);
    res.status(500).json({ error: 'Failed to get planting recommendations' });
  }
});

/**
 * POST /api/getRecipes
 * Generates AI recipes from ingredients
 */
app.post('/api/getRecipes', async (req, res) => {
  try {
    const { ingredients, availableCrops, dietaryPrefs = [], recipeCount = 3, language = 'en' } = req.body;
    
    const validation = validateAll(
      validateRequired(ingredients?.join(', '), 'Ingredients'),
      validateLanguage(language)
    );
    
    if (!validation.isValid) {
      res.status(400).json({ error: validation.error });
      return;
    }
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate ${recipeCount} Indian recipes using: ${ingredients.join(', ')}. Available crops: ${availableCrops.join(', ')}. Dietary: ${dietaryPrefs.join(', ')}. JSON format.`,
      config: {
        responseMimeType: 'application/json',
      },
    });
    
    const result = JSON.parse(response.text || '{}');
    res.json(result);
    
  } catch (error) {
    console.error('Recipe generation error:', error);
    res.status(500).json({ error: 'Failed to generate recipes' });
  }
});

/**
 * POST /api/getIndianAgriNews
 * Gets Indian agriculture news, government schemes, and incentives
 */
app.post('/api/getIndianAgriNews', async (req, res) => {
  try {
    const { location, topic, timeFilter, language = 'en' } = req.body;
    
    const validation = validateLanguage(language);
    if (!validation.isValid) {
      res.status(400).json({ error: validation.error });
      return;
    }
    
    const sanitizedLocation = location ? sanitizeInput(location) : 'India';
    const sanitizedTopic = topic ? sanitizeInput(topic) : '';
    const topicQuery = sanitizedTopic ? ` about ${sanitizedTopic}` : '';
    
    // Build Exa search options
    interface ExaSearchOptions {
      category?: string;
      type?: string;
      numResults?: number;
      text?: { maxCharacters: number };
      startPublishedDate?: string;
    }
    
    const exaOptions: ExaSearchOptions = {
      category: 'news',
      type: 'auto',
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
    
    // Use Exa for web search (server-side - no CORS issues!)
    const exaResults = await exa.searchAndContents(
      `Latest agriculture news ${sanitizedLocation}${topicQuery}`,
      exaOptions as Parameters<typeof exa.searchAndContents>[1]
    );
    
    const context = exaResults.results.map(r => `Source: ${r.title ?? 'Unknown'}\n${r.text ?? ''}`).join('\n\n');
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Using this real-time news context: ${context}\n\nProvide Indian agri news for ${sanitizedLocation}${sanitizedTopic ? ` focused on ${sanitizedTopic}` : ''}. You MUST extract and return up to 10 distinct news articles, exactly 5 related government schemes, and exactly 5 financial incentives. If the text does not contain enough specific schemes or incentives, use your knowledge base to fill out the remaining slots with highly relevant national or state-level agricultural schemes and incentives. Respond STRICTLY with a valid JSON object matching this schema:
{
  "news": [{"title": string, "summary": string, "source": string, "url": string, "publishedDate": string}],
  "schemes": [{"name": string, "description": string, "benefits": ["string"], "eligibility": string, "howToApply": string, "officialLink": string}],
  "incentives": [{"name": string, "description": string, "benefitAmount": string, "eligibility": string, "applicationProcess": string, "link": string}]
}`,
      config: {
        responseMimeType: 'application/json',
      },
    });
    
    const parsed = JSON.parse(response.text || '{}');
    const sources = exaResults.results.map(r => ({ uri: r.url, title: r.title ?? 'Source' }));
    res.json({ ...parsed, sources });
    
  } catch (error) {
    console.error('Indian Agri News error:', error);
    res.status(500).json({ error: 'Failed to get Indian agri news' });
  }
});

/**
 * POST /api/getProfitForecast
 * Gets profit forecast with RAG from Exa
 */
app.post('/api/getProfitForecast', async (req, res) => {
  try {
    const { cropName, location, language = 'en' } = req.body;
    
    const validation = validateAll(
      validateRequired(cropName, 'Crop name'),
      validateLocation(location),
      validateLanguage(language)
    );
    
    if (!validation.isValid) {
      res.status(400).json({ error: validation.error });
      return;
    }
    
    const sanitizedCrop = sanitizeInput(cropName);
    const sanitizedLocation = sanitizeInput(location);
    
    const exaResults = await exa.searchAndContents(
      `Profit margin forecast, demand, and analysis for ${sanitizedCrop} in ${sanitizedLocation}`,
      {
        type: 'auto',
        numResults: 3,
        text: { maxCharacters: 5000 }
      }
    );
    
    const context = exaResults.results.map(r => `Source: ${r.title ?? 'Unknown'}\n${r.text ?? ''}`).join('\n\n');
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Using this real-time web context: ${context}\n\nProvide Profit forecast for ${sanitizedCrop} in ${sanitizedLocation}. Respond STRICTLY with a valid JSON object:
{
  "predictedMarketPrice": number,
  "priceUnit": string,
  "totalRevenue": number,
  "netProfitOrLoss": number,
  "returnOnInvestment": number,
  "analysis": string,
  "alternativeCrops": [{"cropName": string, "profitMarginChange": string, "reasoning": string}]
}`,
      config: {
        responseMimeType: 'application/json',
      },
    });
    
    const parsed = JSON.parse(response.text || '{}');
    const sources = exaResults.results.map(r => ({ uri: r.url, title: r.title ?? 'Source' }));
    res.json({ ...parsed, sources });
    
  } catch (error) {
    console.error('Profit forecast error:', error);
    res.status(500).json({ error: 'Failed to get profit forecast' });
  }
});

/**
 * POST /api/getPriceBrokerAnalysis
 * Gets price broker analysis with RAG from Exa
 */
app.post('/api/getPriceBrokerAnalysis', async (req, res) => {
  try {
    const { cropName, location, language = 'en' } = req.body;
    
    const validation = validateAll(
      validateRequired(cropName, 'Crop name'),
      validateLocation(location),
      validateLanguage(language)
    );
    
    if (!validation.isValid) {
      res.status(400).json({ error: validation.error });
      return;
    }
    
    const sanitizedCrop = sanitizeInput(cropName);
    const sanitizedLocation = sanitizeInput(location);
    
    const exaResults = await exa.searchAndContents(
      `Broker price analysis, trends, and demand for ${sanitizedCrop} in ${sanitizedLocation}`,
      {
        type: 'auto',
        numResults: 3,
        text: { maxCharacters: 5000 }
      }
    );
    
    const context = exaResults.results.map(r => `Source: ${r.title ?? 'Unknown'}\n${r.text ?? ''}`).join('\n\n');
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Using this real-time web context: ${context}\n\nProvide Broker price analysis for ${sanitizedCrop} in ${sanitizedLocation}. Respond in JSON.`,
      config: {
        responseMimeType: 'application/json',
      },
    });
    
    const parsed = JSON.parse(response.text || '{}');
    const sources = exaResults.results.map(r => ({ uri: r.url, title: r.title ?? 'Source' }));
    res.json({ ...parsed, sources });
    
  } catch (error) {
    console.error('Price broker analysis error:', error);
    res.status(500).json({ error: 'Failed to get price broker analysis' });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Export the Express app as a Cloud Function
export const api = functions.https.onRequest(app);

/**
 * Example: Scheduled function to clean up rate limit cache
 */
export const cleanupRateLimits = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    const now = Date.now();
    const fiveMinutesAgo = now - 300000;
    
    // Clean up old entries
    rateLimitMap.forEach((calls, userId) => {
      const recentCalls = calls.filter(timestamp => timestamp > fiveMinutesAgo);
      if (recentCalls.length === 0) {
        rateLimitMap.delete(userId);
      } else {
        rateLimitMap.set(userId, recentCalls);
      }
    });
    
    console.log(`Cleaned up rate limits. Active users: ${rateLimitMap.size}`);
  });
