// The 'ActiveView' enum is defined and exported from this file, making it the single source of truth.
export enum ActiveView {
  Weather = 'Weather',
  HealthAnalysis = 'Health Analysis',

  PlantingRecommendations = 'Planting Recommendations',
  MarketPrices = 'Market Prices',
  CropYieldPrediction = 'Crop Yield Prediction',
  ProfitForecaster = 'Profit Forecaster',
  DirectMarketplace = 'Direct Marketplace',
  Community = 'Community',
  FarmAssetsExchange = 'Farm Assets & Exchange',
  Profile = 'My Profile',
  AddFeatures = 'Feature Store',
  IndianAgriNews = 'Indian Agri News',
  CSAManagement = 'CSA Management',
  MyDeals = 'My Deals',
  MyFarm = 'My Farm',

}

export interface ParsedListItem {
  itemName: string;
  quantity: number;
  unit: string;
}

export interface CartItem {
    listing: ProductListing;
    quantity: number;
}

export interface ParsedCommand {
    action: ActiveView | 'add-listing' | 'unknown';
    parameters?: {
        location?: string;
        cropName?: string;
        listingType?: 'wholesale' | 'retail';
        quantity?: number;
        unit?: string;
        price?: number;
        currency?: string;
    };
}


export interface CurrentWeather {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
}

export interface DailyForecast {
  day: string;
  high: number;
  low: number;
  condition: string;
}

export interface WeatherData {
  currentWeather: CurrentWeather;
  dailyForecast: DailyForecast[];
  seasonalContext: string;
}

export interface DiseaseReport {
  isHealthy: boolean;
  diseaseName: string;
  description: string;
  treatment: string[];
}

export interface SoilHealthReport {
  soilType: string;
  texture: string;
  phLevel: string;
  organicMatter: string;
  nutrientAnalysis: string;
  recommendations: string[];
}


export enum SoilType {
    Loam = 'Loam',
    Clay = 'Clay',
    Sandy = 'Sandy',
    Silt = 'Silt',
    Peat = 'Peat',
}

export enum CropType {
    Vegetable = 'Vegetable',
    Fruit = 'Fruit',
    Grain = 'Grain',
    Legume = 'Legume',
    Herb = 'Herb',
}

export interface PlantingRecommendation {
  cropName: string;
  reason: string;
  plantingTime: string;
  daysToHarvest: number;
  imageUrl?: string;
}

export interface PlantingRequest {
    location: string;
    soilType: SoilType;
    cropType: CropType;
    previousCrop?: string;
}

export interface PlantingRecommendationResponse {
  season: string;
  recommendations: PlantingRecommendation[];
}

export interface DiseaseHotspot {
  lat: number;
  lng: number;
  diseaseName: string;
  severity: 'low' | 'medium' | 'high';
}

export interface PriceDataPoint {
    month: string;
    price: number;
}

export interface WebSource {
    uri: string;
    title: string;
}

export interface CropPricePrediction {
    cropName: string;
    location: string;
    currentPrice: number;
    predictedPriceNextMonth: number;
    priceUnit: string;
    trend: 'up' | 'down' | 'stable';
    analysis: string;
    historicalData: PriceDataPoint[];
    predictedData: PriceDataPoint[];
    sources?: WebSource[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface NegotiationTerms {
  crop: string;
  quantity: number;
  unit: string;
  targetPrice: number;
  lowestPrices: number[];
  location: string;
  farmerName: string;
  currency: string;
}

export interface NegotiationResponse {
  suggestion: string;
  isDealClose: boolean;
  dealSummary?: {
    crop: string;
    quantity: number;
    unit: string;
    finalPrice: number;
    currency: string;
  };
}

export interface CropYieldRequest {
    crop: string;
    location: string;
    area: number;
    areaUnit: 'acres' | 'hectares';
    soilType: SoilType;
}

export interface CropYieldResponse {
    predictedYield: string;
    yieldUnit: string;
    historicalYieldData: { year: number; yield: number }[];
    analysis: string;
    influencingFactors: {
        positive: string[];
        negative: string[];
    };
    recommendations: string[];
}

export interface ProductListing {
    id: string;
    listingType: 'wholesale' | 'retail';
    farmerUid: string;
    farmerEmail: string;
    farmerName: string;
    location: string;
    farmerPhoneNumber?: string;
    cropName: string;
    quantity: number;
    unit: string;
    price: number;
    currency: string;
    imageUrl: string;
    createdAt?: Date;
    targetPrice?: number;
    lowestPrices?: number[];
}

export interface RetailOrder {
    id: string;
    farmerUid: string;
    customerEmail: string;
    customerName: string;
    customerLocation: string;
    listingId: string;
    productName: string;
    quantityBought: number;
    unit: string;
    pricePerUnit: number;
    totalPrice: number;
    currency: string;
    createdAt: Date;
    status: 'new' | 'processing' | 'shipped' | 'cancelled'; 
}


export interface PricePoint {
    location: string;
    price: number;
    source: string;
}

export interface PriceBrokerAnalysis {
    crop: string;
    location: string;
    averagePrice: number;
    priceUnit: string;
    pricePoints: PricePoint[];
    analysis: string;
    sources: WebSource[];
}

export interface FarmerProfile {
    uid: string;
    email: string;
    role: 'farmer' | 'customer' | 'admin';
    name?: string;
    location?: string;
    phoneNumber?: string;
    enabledFeatures?: ActiveView[];
    smartAutomationEnabled?: boolean;
}

export interface FarmerChatMessage {
    id: string;
    senderUid: string;
    senderEmail: string;
    text: string;
    timestamp: Date;
    edited?: boolean;
    deleted?: boolean;
    updatedAt?: Date;
}

export interface ChatParticipantStatus {
    isTyping: boolean;
    lastRead: Date | null;
}
export interface ChatMetadata {
    participants?: string[];
    participantInfo: {
        [uid: string]: ChatParticipantStatus;
    };
    lastMessage?: {
        text: string;
        senderUid: string;
        senderEmail: string;
        timestamp: Date;
    };
}

export interface ConnectionRequest {
    id: string;
    senderUid: string;
    senderEmail: string;
    recipientUid: string;
    recipientEmail: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: Date;
}

export interface DealRequest {
    id: string;
    farmerUid: string;
    customerEmail: string;
    product: Omit<ProductListing, 'farmerUid' | 'id'>;
    status: 'pending' | 'read';
    createdAt: Date;
}

export interface NegotiationChat {
    id: string;
    listingId: string;
    farmerUid: string;
    customerEmail: string;
    customerName: string;
    customerLocation: string;
    listingInfo: {
        cropName: string;
        farmerName: string;
        imageUrl: string;
    };
    status: 'active' | 'awaiting-authorization' | 'deal-made' | 'closed';
    dealSummary?: NegotiationResponse['dealSummary'];
    proposedDeal?: NegotiationResponse['dealSummary'];
    createdAt: Date;
    updatedAt: Date;
}

export interface NegotiationChatMessage {
    id: string;
    role: 'user' | 'model'; 
    content: string;
    timestamp: Date;
}

export interface DealNotification {
    id: string;
    farmerUid: string;
    message: string;
    listingId: string;
    status: 'unread' | 'read';
    createdAt: Date;
}

export enum ExpenseCategory {
    Seeds = 'Seeds',
    Fertilizer = 'Fertilizer',
    Pesticides = 'Pesticides',
    Machinery = 'Machinery',
    Labor = 'Labor',
    Utilities = 'Utilities',
    Other = 'Other',
}

export interface Expense {
    id: string;
    description: string;
    category: ExpenseCategory;
    amount: number;
    currency: string;
    date: string; 
}

export interface ChatNotification {
    id: string; 
    senderUid: string;
    senderEmail: string;
    text: string;
    timestamp: Date;
}

export interface MicroclimateZone {
  zoneName: string;
  description: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  temperatureDelta: string;
  risk: string;
}

export interface MicroclimateAnalysis {
  inferredTopography: string;
  zones: MicroclimateZone[];
}

export interface Alert {
    id: string;
    uid: string;
    type: 'weather' | 'market';
    severity: 'info' | 'warning' | 'danger';
    message: string;
    status: 'unread' | 'read';
    relatedView: ActiveView;
    relatedEntityId: string; 
    createdAt: Date;
}

export interface CustomWeatherAlert {
    id: string;
    uid: string;
    type: 'weather';
    location: string;
    condition: 'temperature' | 'humidity' | 'windSpeed';
    operator: 'gte' | 'lte'; 
    value: number;
    status: 'active' | 'triggered';
    createdAt: Date;
}

export interface CustomMarketAlert {
    id: string;
    uid: string;
    type: 'market';
    crop: string;
    location: string;
    operator: 'gte' | 'lte';
    value: number;
    status: 'active' | 'triggered';
    createdAt: Date;
}

export type CustomAlert = CustomWeatherAlert | CustomMarketAlert;

export interface AgriSwapListing {
    id: string;
    farmerUid: string;
    farmerEmail: string;
    farmerName: string;
    location: string;
    farmerPhoneNumber?: string;
    offerItemName: string;
    offerQuantity: number;
    offerUnit: string;
    offerDescription?: string;
    offerImageUrl: string;
    wantItemName: string;
    wantQuantity: number;
    wantUnit: string;
    wantDescription?: string;
    status: 'active' | 'traded' | 'cancelled';
    createdAt: Date;
}

export enum TaskPriority {
    High = 'High',
    Medium = 'Medium',
    Low = 'Low',
}

export interface Task {
    id: string;
    description: string;
    dueDate: string; 
    priority: TaskPriority;
    isCompleted: boolean;
    createdAt: Date;
}

// --- Livestock Management ---
export enum LivestockType {
    Cow = 'Cow',
    Sheep = 'Sheep',
    Goat = 'Goat',
    Chicken = 'Chicken',
    Pig = 'Pig',
}

export enum LivestockGender {
    Male = 'Male',
    Female = 'Female',
}

export enum HealthStatus {
    Healthy = 'Healthy',
    Sick = 'Sick',
    UnderObservation = 'Under Observation',
    Quarantined = 'Quarantined',
}

export interface Livestock {
    id: string;
    farmerUid: string;
    tagId: string;
    type: LivestockType;
    breed: string;
    gender: LivestockGender;
    birthDate: string; 
    healthStatus: HealthStatus;
    notes?: string;
    imageUrl: string;
    createdAt: Date;
}

export interface LivestockHealthAnalysis {
    summary: string;
    recommendations: string[];
}

// --- Profit Forecaster ---
export interface ProfitForecastRequest {
    cropName: string;
    location: string;
    expectedYield: number;
    yieldUnit: string;
    cultivationArea: number;
    areaUnit: 'acres' | 'hectares';
    totalCosts: number;
    currency: string;
}

export interface ProfitForecastResponse {
    predictedMarketPrice: number;
    priceUnit: string;
    totalRevenue: number;
    netProfitOrLoss: number;
    returnOnInvestment: number;
    analysis: string;
    alternativeCrops: {
        cropName: string;
        profitMarginChange: string;
        reasoning: string;
    }[];
    sources?: WebSource[];
}

// --- Community & News ---
export interface NewsArticle {
    title: string;
    summary: string;
    source: string;
    url: string;
    publishedDate: string;
}

export interface GovernmentScheme {
    name: string;
    description: string;
    benefits: string[];
    eligibility: string;
    howToApply: string;
    officialLink: string;
}

export interface Incentive {
    name: string;
    description: string;
    benefitAmount: string;
    eligibility: string;
    applicationProcess: string;
    link: string;
}

export interface IndianAgriNewsResponse {
    news: NewsArticle[];
    schemes: GovernmentScheme[];
    incentives: Incentive[];
    sources?: WebSource[];
}

export type SharedContent = NewsArticle | GovernmentScheme | Incentive;
export type ContentType = 'news' | 'scheme' | 'incentive';

export interface CommunityFeedPost {
    id: string;
    senderUid: string;
    senderName: string;
    senderEmail: string;
    content: SharedContent;
    contentType: ContentType;
    contentIdentifier: string;
    userComment?: string;
    createdAt: Date;
}

// --- Customer Portal, CSA & Recipes ---
export interface Recipe {
    title: string;
    description: string;
    prepTime: string;
    imageUrl?: string;
    ingredients: {
        name: string;
        quantity: string;
        availableOnMarket: boolean;
    }[];
    instructions: string[];
}


export interface RecipeResponse {
    recipes: Recipe[];
}

export interface CSATier {
    id: string;
    farmerUid: string;
    farmerName: string;
    name: string;
    description: string;
    price: number;
    currency: string;
    frequency: 'weekly' | 'bi-weekly' | 'monthly';
    type: 'static' | 'dynamic';
    items?: { name: string; quantity: string }[];
    imageUrl: string;
    createdAt: Date;
}

export interface DynamicSubscriptionPreferences {
    dietaryGoal: 'balanced' | 'low-calorie' | 'high-protein' | 'low-carb';
    calorieTarget?: number;
    dislikes?: string[];
    allergies?: string[];
}

export interface CuratedItem {
    itemName: string;
    quantity: number;
    unit: string;
}

export interface CSASubscription {
    id: string;
    tierId: string;
    farmerUid: string;
    customerEmail: string;
    customerName: string;
    status: 'active' | 'cancelled';
    subscribedAt: Date;
    tierInfo: {
        name: string;
        price: number;
        currency: string;
        frequency: string;
        farmerName: string;
        type: 'static' | 'dynamic';
    };
    preferences?: DynamicSubscriptionPreferences;
    curatedItems?: {
        [weekId: string]: CuratedItem[];
    };
}

export interface WeeklyProduceItem {
    id: string;
    itemName: string;
    unit: string;
    pricePerUnit: number;
    availableQuantity: number;
}

export interface WeeklyAvailability {
    id: string; 
    items: WeeklyProduceItem[];
}

// --- Agri-Swap Requests ---
export interface AgriSwapDealRequest {
    id: string;
    listingId: string;
    listerUid: string;
    requesterUid: string;
    requesterEmail: string;
    requesterName: string;
    requesterLocation: string;
    status: 'pending' | 'accepted' | 'rejected';
    listingOfferItemName: string;
    createdAt: Date;
}

export interface FinalizedAgriSwapDeal {
    id: string;
    recipientUid: string;
    message: string;
    listingId: string;
    status: 'unread' | 'read';
    createdAt: Date;
}

// --- Farm Machinery Sharing ---
export enum MachineryType {
    Tractor = 'Tractor',
    Harvester = 'Harvester',
    Seeder = 'Seeder',
    Sprayer = 'Sprayer',
    Baler = 'Baler',
    Other = 'Other',
}

export interface FarmMachinery {
    id: string;
    ownerUid: string;
    ownerName: string;
    ownerPhoneNumber?: string;
    type: MachineryType;
    model: string;
    description?: string;
    rentalRate: number;
    currency: string;
    rateType: 'perHour' | 'perDay';
    location: string;
    coordinates: {
        lat: number;
        lng: number;
    };
    imageUrl: string;
    status: 'available' | 'rented_out' | 'maintenance';
    createdAt: Date;
    distance?: number;
}

export interface MachineryRentalRequest {
    id: string;
    machineryId: string;
    ownerUid: string;
    renterUid: string;
    renterName: string;
    renterLocation: string;
    startDate: string; 
    endDate: string; 
    totalCost: number;
    currency: string;
    status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'paid' | 'cancelled';
    machineryInfo: {
        type: MachineryType;
        model: string;
        imageUrl: string;
    };
    createdAt: Date;
}

// --- Admin ---
export interface SystemStats {
    totalFarmers: number;
    totalCustomers: number;
    marketplaceListings: number;
    agriSwapListings: number;
}

// --- Smart Irrigation Dashboard ---
export interface Zone {
  id: string;
  name: string;
  crop: string;
  coordinates: { lat: number; lng: number };
  soilMoisture: number; 
  isIrrigating: boolean;
  aiRecommendation?: string;
  recommendationLoading?: boolean;
}

export interface WaterUsageRecord {
  day: string;
  usage: number; 
  saved: number; 
}

export interface IrrigationAlert {
  id: string;
  type: 'info' | 'warning' | 'danger';
  message: string;
}


