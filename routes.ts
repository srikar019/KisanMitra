/**
 * Route configuration — single source of truth for URL paths.
 * Maps each ActiveView to a URL-safe route segment.
 */
import { ActiveView } from './types';

/** Maps ActiveView enum values to URL path segments */
export const viewToPath: Record<ActiveView, string> = {
  [ActiveView.Weather]: 'weather',
  [ActiveView.HealthAnalysis]: 'health-analysis',
  [ActiveView.PlantingRecommendations]: 'planting',
  [ActiveView.MarketPrices]: 'market-prices',
  [ActiveView.CropYieldPrediction]: 'yield-prediction',
  [ActiveView.ProfitForecaster]: 'profit-forecaster',
  [ActiveView.DirectMarketplace]: 'marketplace',
  [ActiveView.Community]: 'community',
  [ActiveView.FarmAssetsExchange]: 'assets-exchange',
  [ActiveView.Profile]: 'profile',
  [ActiveView.AddFeatures]: 'features',
  [ActiveView.IndianAgriNews]: 'news',
  [ActiveView.CSAManagement]: 'csa',
  [ActiveView.MyDeals]: 'deals',
  [ActiveView.MyFarm]: 'my-farm',
};

/** Reverse lookup — URL path segment to ActiveView */
export const pathToView: Record<string, ActiveView> = Object.fromEntries(
  Object.entries(viewToPath).map(([view, path]) => [path, view as ActiveView]),
) as Record<string, ActiveView>;

/** Build a full farmer route path */
export const farmRoute = (view: ActiveView): string => `/farm/${viewToPath[view]}`;
