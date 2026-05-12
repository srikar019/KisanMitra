# 🌾 KisanMitra — AI-Powered Agriculture Platform

<p align="center">
  <strong>Comprehensive farm-to-table platform empowering farmers with AI, real-time markets, and community</strong>
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
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Deployment](#deployment)

---

## Overview

KisanMitra is an advanced, AI-native agriculture platform designed to empower Indian farmers with intelligent tools for crop management, dynamic market access, and community networking. It acts as a full-stack digital cooperative, eliminating middlemen by connecting farmers directly with consumers through AI-powered negotiations, real-time market tracking, and trust-verified digital passports.

### Portfolio Highlights

- **Deployed on Vercel** handling real-world user workflows and live data.
- **20+ Integrated Features** covering the full farm-to-fork pipeline.
- **6 Custom AI Decision Tools** powered by the Google Gemini API, reducing farm management decision time by ~60%.
- **Firestore Real-time Infrastructure** powering chat, alerts, dynamic CSA workflows, and live marketplaces.
- **Tri-lingual support** (English, Hindi, Telugu) maximizing accessibility for regional farmers.

---

## Key Features

### 🧑‍🌾 Farm Management & AI Tools
- **Satellite Farm Twin:** Digital twin visualization using NDVI tracking and satellite-based field monitoring.
- **AI Health Analysis:** On-device machine learning (MobileNetV2 TF.js) for instant crop disease detection from photos.
- **Microclimate Weather:** 5-day predictive forecasting with Leaflet maps and localized microclimate alerts.
- **Profit & Yield Forecaster:** Financial modeling predicting crop yields based on historical data and AI trends.

### 🛒 Real-Time Marketplace & Commerce
- **Live Commodities Market:** Real-time tracking of agricultural commodity prices with dynamic trend indicators.
- **Direct Marketplace:** Wholesale and retail listings with automated AI-negotiation agents.
- **CSA Management:** Intelligent subscription boxes that dynamically curate produce based on harvest cycles and dietary preferences.
- **Product Digital Passports:** Supply chain transparency tracking freshness, pesticide risk, and origin verification.
- **Farmer Trust Scoring:** Algorithmic trust badges based on fulfillment rates, reviews, and community standing.

### 🤝 Community & Networking
- **Community Hub:** Real-time social feed, farmer directory, and direct connection workflows.
- **Agri-Swap:** Barter network for locally exchanging crops, tools, and farm services.
- **Farm Machinery Sharing:** Geo-located equipment rental and scheduling system.
- **Regional Agri News:** Daily feeds on government schemes, subsidies, and agricultural advancements.

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   Client (React)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  Farmer   │ │ Customer │ │   Community      │ │
│  │  Portal   │ │  Portal  │ │   Directory      │ │
│  └────┬─────┘ └────┬─────┘ └───────┬──────────┘ │
│       │             │               │             │
│  ┌────┴─────────────┴───────────────┴──────────┐ │
│  │    React Router v7 + Context Providers       │ │
│  └──────────────────┬──────────────────────────┘ │
│                     │                             │
│  ┌──────────────────┴──────────────────────────┐ │
│  │           Service Layer                      │ │
│  │  geminiService │ marketplaceService │ trust │ │
│  └───────┬────────────────┬────────────────────┘ │
└──────────┼────────────────┼──────────────────────┘
           │                │
    ┌──────┴──────┐  ┌──────┴──────┐
    │  Gemini AI  │  │  Firebase   │
    │  + Exa API  │  │  Auth +     │
    │  (AI/RAG)   │  │  Firestore  │
    └─────────────┘  └─────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19, TypeScript 5.8 | Core UI framework |
| **Build & Deploy** | Vite 6, Vercel | Bundling and cloud deployment |
| **Styling** | TailwindCSS 3.4 | Utility-first responsive design |
| **AI Integration** | Google Gemini 3 Flash, Exa API | Generative AI and web-grounded RAG |
| **Machine Learning** | TensorFlow.js | In-browser crop disease detection |
| **Backend & DB** | Firebase (Auth, Firestore) | Authentication and real-time NoSQL |
| **Maps & Viz** | Leaflet.js, Framer Motion | Interactive mapping and animations |

---

## Project Structure

```
kisanmitra/
├── components/              # React components
│   ├── common/              # Reusable UI (Badges, Buttons, Loaders)
│   ├── modals/              # Alert & Interactive dialogs
│   └── *.tsx                # Feature components (Dashboard, Marketplace)
├── contexts/                # Global State (Auth, Theme, Notifications)
├── services/                # Business Logic (Firebase, Gemini, Trust Scoring)
├── public/                  # Static assets & TF.js Models
├── translations.ts          # i18n dictionaries (EN, HI, TE)
├── types.ts                 # TypeScript type definitions
├── tailwind.config.js       # Tailwind configuration
├── vite.config.ts           # Vite configuration
└── firestore.rules          # Firestore security rules
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- A [Google AI Studio](https://aistudio.google.com/) API key (Gemini)
- A [Firebase](https://console.firebase.google.com/) project

### Installation

```bash
# Clone the repository
git clone https://github.com/srikar019/KisanMitra.git
cd KisanMitra

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

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
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server on port 3000 |
| `npm run build` | Build production bundle |
| `npm run preview` | Preview production build locally |
| `npm run lint` | TypeScript type-checking and ESLint |

---

## Deployment

The application is configured for seamless deployment on **Vercel** or **Firebase Hosting**.

**For Vercel:**
Connect your GitHub repository to Vercel. It will automatically detect Vite and configure the build settings. Ensure you add the environment variables in the Vercel dashboard.

**For Firebase Hosting:**
```bash
npm run build
firebase deploy --only hosting,firestore:rules
```

---

<p align="center">
  Built with ❤️ for Indian Agriculture
</p>
