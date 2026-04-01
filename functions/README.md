# Firebase Cloud Functions - Secure Backend API

This directory contains Firebase Cloud Functions that provide a secure backend API layer for KisanMitra. All AI API calls are handled server-side to keep API keys secure and implement server-side validation and rate limiting.

## Features

✅ **Secure API Keys** - Gemini and Exa API keys stored server-side only  
✅ **Server-side Validation** - All inputs validated before processing  
✅ **Rate Limiting** - 20 requests per minute per user  
✅ **Firebase Auth** - Token verification on all endpoints  
✅ **CORS Protection** - Configurable allowed origins  
✅ **Error Handling** - Graceful error responses  
✅ **Auto-cleanup** - Scheduled function cleans rate limit cache  

## Setup

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Configure API Keys (Secure!)

Set your API keys as Firebase Functions config (NOT in `.env` files):

```bash
# Set Gemini API key
firebase functions:config:set gemini.api_key="your_gemini_api_key_here"

# Set Exa API key
firebase functions:config:set exa.api_key="your_exa_api_key_here"
```

Verify configuration:
```bash
firebase functions:config:get
```

### 3. Local Development

For local testing, create `.runtimeconfig.json` (gitignored):

```json
{
  "gemini": {
    "api_key": "your_gemini_api_key_here"
  },
  "exa": {
    "api_key": "your_exa_api_key_here"
  }
}
```

Start local emulator:
```bash
npm run serve
```

## Deployment

### Deploy all functions:
```bash
npm run deploy
```

### Deploy specific function:
```bash
firebase deploy --only functions:api
```

## Available Endpoints

All endpoints require Firebase Auth token in header:
```
Authorization: Bearer <firebase_id_token>
```

### POST /api/detectCropDisease
Analyzes crop disease from image

**Request Body:**
```json
{
  "imageBase64": "base64_encoded_image",
  "mimeType": "image/jpeg",
  "language": "en"
}
```

### POST /api/analyzeSoilHealth
Analyzes soil health from image

**Request Body:**
```json
{
  "imageBase64": "base64_encoded_image",
  "mimeType": "image/jpeg",
  "language": "en"
}
```

### POST /api/getMarketPricePrediction
Gets market price predictions (RAG with Exa)

**Request Body:**
```json
{
  "cropName": "Tomato",
  "location": "Maharashtra",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "language": "en"
}
```

### POST /api/getPlantingRecommendations
Gets AI planting recommendations

**Request Body:**
```json
{
  "location": "Punjab",
  "soilType": "Loam",
  "cropType": "Grain",
  "previousCrop": "Wheat",
  "language": "en"
}
```

### POST /api/getRecipes
Generates recipes from ingredients

**Request Body:**
```json
{
  "ingredients": ["tomato", "onion", "rice"],
  "availableCrops": ["tomato", "potato"],
  "dietaryPrefs": ["vegetarian"],
  "recipeCount": 3,
  "language": "en"
}
```

### GET /health
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Rate Limiting

- **Limit**: 20 requests per minute per user
- **Status Code**: 429 (Too Many Requests)
- **Cleanup**: Automatic every 5 minutes via scheduled function

## Security Features

### 1. Firebase Auth Verification
All requests must include valid Firebase ID token

### 2. Server-side Validation
- Email format validation
- Location validation (2-200 chars)
- Image data validation (max 4MB)
- MIME type validation
- Language code validation
- XSS sanitization

### 3. Rate Limiting
Prevents abuse by limiting requests per user

### 4. CORS Protection
Configure `corsOptions` in `index.ts`:
```typescript
const corsOptions = {
  origin: ['https://your-app.web.app', 'https://your-app.firebaseapp.com'],
  credentials: true,
};
```

## Error Handling

### 400 Bad Request
Invalid input or validation failure

### 401 Unauthorized
Missing or invalid Firebase Auth token

### 429 Too Many Requests
Rate limit exceeded

### 500 Internal Server Error
Server-side processing error

## Monitoring

View logs:
```bash
npm run logs
```

Or in Firebase Console: Functions → Logs

## Cost Optimization

1. **Caching**: Implement Redis or Firestore caching for repeated queries
2. **Region**: Deploy to region closest to your users
3. **Memory**: Adjust memory allocation in `firebase.json` if needed
4. **Timeout**: Set appropriate timeout values

## Production Checklist

- [ ] Set API keys via `firebase functions:config:set`
- [ ] Configure CORS to your production domain
- [ ] Set up monitoring and alerts
- [ ] Review rate limits for your use case
- [ ] Test all endpoints with Postman/Insomnia
- [ ] Deploy with `npm run deploy`
- [ ] Verify health check: `https://your-region-your-project.cloudfunctions.net/api/health`

## Troubleshooting

### "GEMINI_API_KEY not configured"
Run: `firebase functions:config:set gemini.api_key="YOUR_KEY"`

### "Cannot find module"
Run: `npm install` in functions directory

### CORS errors
Update `corsOptions` in `index.ts` to include your domain

### Rate limit issues
Adjust `maxCallsPerMinute` in `rateLimitMiddleware`
