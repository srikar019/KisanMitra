# 🌾 KisanMitra — Smart Agriculture Platform

<p align="center">
  <strong>AI-powered farm-to-table platform connecting farmers, customers, and markets</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-blue?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6-purple?logo=vite" alt="Vite 6" />
  <img src="https://img.shields.io/badge/Firebase-12-orange?logo=firebase" alt="Firebase" />
  <img src="https://img.shields.io/badge/Gemini_AI-3_Flash-green?logo=google" alt="Gemini AI" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-cyan?logo=tailwindcss" alt="Tailwind" />
</p>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [Internationalization](#internationalization)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

KisanMitra is an AI-native agriculture platform that empowers Indian farmers with intelligent tools for crop management, market access, and community building. The platform connects farmers directly with customers, eliminating middlemen through AI-powered negotiation, real-time market intelligence, and a comprehensive farm management suite.

### Key Differentiators

- **20+ AI-powered features** covering the full farm-to-fork pipeline
- **Autonomous AI Negotiation Agent** that bargains on behalf of farmers
- **Web-grounded predictions** using Exa search + Gemini AI (RAG pattern)
- **Multi-modal AI** — analyze crops, soil, and shopping lists from photos
- **Tri-lingual support** — English, Hindi (हिंदी), and Telugu (తెలుగు)
- **Real-time collaboration** via Firebase Firestore

---

## Features

### 🧑‍🌾 Farmer Portal

| Feature | Description | AI-Powered |
|---|---|:---:|
| **Weather Forecast** | 5-day forecast with microclimate zone analysis and Leaflet maps | ✅ |
| **Health Analysis** | Crop disease detection and soil health analysis from photos | ✅ |
| **Planting Recommendations** | Season-aware, location-specific crop suggestions | ✅ |
| **Market Price Prediction** | Web-grounded price forecasts with source citations | ✅ |
| **Crop Yield Prediction** | AI-powered harvest forecasting with historical trends | ✅ |
| **Profit Forecaster** | Financial analysis with alternative crop suggestions | ✅ |
| **Direct Marketplace** | Wholesale (AI-negotiated) and retail (fixed price) listings | ✅ |
| **CSA Management** | Static and AI-curated dynamic subscription boxes | ✅ |
| **Community Hub** | Social feed, connections, and farmer-to-farmer chat | — |
| **Agri-Swap** | Barter network for exchanging crops, tools, and services | — |
| **Livestock Management** | Digital herd tracking with AI health co-pilot | ✅ |
| **Farm Machinery Sharing** | Geo-located equipment rental marketplace | — |
| **My Farm Dashboard** | Tasks, expenses, irrigation management | ✅ |
| **Indian Agri News** | Latest agriculture news, government schemes, and incentives | ✅ |

### 🛒 Customer Portal

| Feature | Description |
|---|---|
| **Browse Marketplace** | View and purchase farm-fresh produce |
| **AI Negotiation** | Negotiate prices with AI agent representing farmers |
| **AI Recipe Generator** | Generate Indian cuisine recipes from pantry items |
| **Shopping List Scanner** | Parse handwritten/typed lists via AI vision |
| **Smart Subscriptions** | CSA boxes with dietary preference matching |
| **AI Price Broker** | Find the best prices across the marketplace |

### 🔧 Admin Portal

| Feature | Description |
|---|---|
| **Dashboard** | System stats and analytics |
| **User Management** | Manage farmer and customer accounts |

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   Client (React)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  Farmer   │ │ Customer │ │     Admin        │ │
│  │  Portal   │ │  Portal  │ │   Dashboard      │ │
│  └────┬─────┘ └────┬─────┘ └───────┬──────────┘ │
│       │             │               │             │
│  ┌────┴─────────────┴───────────────┴──────────┐ │
│  │           React Router v7                    │ │
│  │    (Route-based navigation + deep linking)   │ │
│  └──────────────────┬──────────────────────────┘ │
│                     │                             │
│  ┌──────────────────┴──────────────────────────┐ │
│  │         Context Providers                    │ │
│  │  Auth │ Language │ Theme │ Toast │ Notif.   │ │
│  └──────────────────┬──────────────────────────┘ │
│                     │                             │
│  ┌──────────────────┴──────────────────────────┐ │
│  │           Service Layer                      │ │
│  │  geminiService │ marketplaceService │ auth.. │ │
│  └───────┬────────────────┬────────────────────┘ │
└──────────┼────────────────┼──────────────────────┘
           │                │
    ┌──────┴──────┐  ┌──────┴──────┐
    │  Gemini AI  │  │  Firebase   │
    │  + Exa API  │  │  Auth +     │
    │  (AI/RAG)   │  │  Firestore  │
    └─────────────┘  └─────────────┘
```

### Data Flow

1. **Authentication**: Firebase Auth (Email/Password + Google OAuth) → User profile stored in Firestore
2. **AI Features**: User input → Gemini AI (with optional Exa web search for grounding) → Structured JSON response → UI
3. **Real-time Data**: Firestore `onSnapshot` listeners for live updates across all marketplace and community features
4. **Caching**: In-memory `Map` caches with TTL for AI results to reduce API calls

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19, TypeScript 5.8 | UI framework |
| **Build** | Vite 6 | Dev server & bundler |
| **Styling** | TailwindCSS 3.4 | Utility-first CSS |
| **Animation** | Framer Motion 12 | UI animations |
| **AI** | Google Gemini 3 Flash (`@google/genai`) | All AI features |
| **Search** | Exa API (`exa-js`) | Web-grounded RAG |
| **Auth** | Firebase Auth | Email/Password + Google OAuth |
| **Database** | Cloud Firestore | Real-time NoSQL database |
| **Maps** | Leaflet.js | Interactive weather & machinery maps |
| **Testing** | Vitest + React Testing Library | Unit & component tests |
| **CI/CD** | GitHub Actions | Automated testing & linting |

---

## Project Structure

```
kisanmitra/
├── .github/workflows/      # CI/CD pipeline
├── components/              # React components
│   ├── common/              # Reusable UI (Button, Card, Modal, etc.)
│   ├── modals/              # Alert dialog components
│   └── *.tsx                # Feature components
├── contexts/                # React contexts
│   ├── AuthContext.tsx       # Authentication state
│   ├── LanguageContext.tsx   # i18n translation
│   ├── ThemeContext.tsx      # Dark/light mode
│   ├── ToastContext.tsx      # Toast notifications
│   └── NotificationContext  # Push notifications
├── services/                # Business logic & API calls
│   ├── geminiService.ts     # All Gemini AI interactions
│   ├── marketplaceService   # Marketplace, CSA, orders
│   ├── authService.ts       # Authentication
│   ├── firebase.ts          # Firebase initialization
│   ├── validationService    # Input validation utilities
│   └── *.ts                 # Other domain services
├── tests/                   # Test files
├── public/                  # Static assets
├── translations.ts          # i18n dictionaries (EN, HI, TE)
├── types.ts                 # TypeScript type definitions
├── App.tsx                  # Root component with routing
├── index.html               # HTML entry point
├── index.css                # Global styles
├── tailwind.config.js       # Tailwind configuration
├── vite.config.ts           # Vite configuration
└── firestore.rules          # Firestore security rules
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- A [Google AI Studio](https://aistudio.google.com/) API key (Gemini)
- A [Firebase](https://console.firebase.google.com/) project
- An [Exa](https://exa.ai/) API key

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/kisanmitra.git
cd kisanmitra

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Add your API keys to .env.local (see Environment Variables below)

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
# AI Services
GEMINI_API_KEY=your_gemini_api_key_here
EXA_API_KEY=your_exa_api_key_here

# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

> ⚠️ **Security Note**: Never commit `.env.local` to version control. The `.gitignore` is already configured to exclude it.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server on port 3000 |
| `npm run build` | Build production bundle |
| `npm run preview` | Preview production build locally |
| `npm run test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | TypeScript type-checking |
| `npm run lint:eslint` | ESLint code quality checks |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting without writing |

---

## Testing

The project uses **Vitest** with **React Testing Library** for testing.

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Test Structure

```
tests/
├── components.test.tsx        # Common component tests
├── toastContext.test.tsx       # Toast notification tests
├── validationService.test.ts  # Input validation tests
├── geminiService.test.ts      # AI service tests
├── authService.test.ts        # Authentication tests
├── languageContext.test.tsx    # i18n tests
└── setup.ts                   # Test configuration
```

---

## Deployment

### Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Build the project
npm run build

# Deploy
firebase deploy --only hosting
```

### Deploy Firestore Security Rules

```bash
firebase deploy --only firestore:rules
```

---

## Security

### Firestore Rules

Security rules are defined in `firestore.rules` with the following patterns:

- **User profiles**: Users can only write to their own profile
- **Products**: Authenticated users can read; only owners can update/delete
- **Orders**: Transaction-based with stock validation
- **Notifications**: Recipients can only read their own notifications

### Input Validation

All user inputs are validated using `services/validationService.ts`:

- Email format validation
- Phone number validation (Indian format)
- Image file type and size checks
- Numeric range validation
- XSS sanitization via `sanitizeInput()`

---

## Internationalization

The app supports 3 languages with 560+ translation keys each:

| Language | Code | Coverage |
|---|:---:|:---:|
| English | `en` | 100% |
| Hindi (हिंदी) | `hi` | ~95% |
| Telugu (తెలుగు) | `te` | ~95% |

Language is persisted in `localStorage` and applied to both the static UI and AI-generated content.

To add a new language, add a new dictionary in `translations.ts` following the existing key structure.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- TypeScript strict mode
- ESLint + Prettier for code formatting
- All new features must include tests
- Translation keys required for all user-facing text

---

## License

This project is private and proprietary. All rights reserved.

---

<p align="center">
  Built with ❤️ for Indian Agriculture
</p>
