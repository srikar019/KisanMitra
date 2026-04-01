import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateUserFeatures } from '../services/userService';
import { ActiveView } from '../types';

const ALL_FEATURES: { view: ActiveView; title: string; description: string; }[] = [
    { view: ActiveView.HealthAnalysis, title: 'Health Analysis', description: 'Detect crop diseases and analyze soil health instantly from an image to protect your yield.' },
    { view: ActiveView.PlantingRecommendations, title: 'Planting Suggestions', description: 'Get smart crop recommendations based on your location, soil, and season.' },
    { view: ActiveView.MarketPrices, title: 'Market Price Prediction', description: 'Maximize profits by knowing the best time to sell with AI-driven price forecasts.' },
    { view: ActiveView.CropYieldPrediction, title: 'Crop Yield Prediction', description: 'Forecast your harvest size to better plan for storage, transport, and sales.' },
    { view: ActiveView.ProfitForecaster, title: 'Profit Forecaster', description: 'Estimate your potential profit or loss based on your expected yield and costs.' },
    { view: ActiveView.DirectMarketplace, title: 'Direct Marketplace', description: 'Connect directly with buyers to sell your produce without intermediaries.' },
    { view: ActiveView.FarmAssetsExchange, title: 'Farm Assets & Exchange', description: 'Manage your livestock records and trade animals or produce directly with other farmers.' },
    { view: ActiveView.Community, title: 'Community Hub', description: 'Build your private network by connecting and chatting with other trusted farmers.' },
    { view: ActiveView.CSAManagement, title: 'CSA Management', description: 'Manage your Community Supported Agriculture program, from member subscriptions to delivery schedules.' },

];

const SeedSwitch: React.FC<{ checked: boolean; disabled?: boolean; }> = ({ checked, disabled }) => {
    return (
        <label className="seed-switch">
          <input type="checkbox" checked={checked} disabled={disabled} readOnly />
           <span className="slider">
             <svg className="seed" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 512.004 512.004" xmlSpace="preserve" fill="#000000"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path style={{fill:'#e5c11f'}} d="M370.114,157.811C351.523,65.174,307.456,0,256,0c-51.447,0-95.514,65.174-114.114,157.811 c41.057,46.036,72.854,122.827,92.328,199.477C251.065,406.528,256,461.356,256,512c0-50.644,4.935-105.472,21.786-154.712 C297.269,280.638,329.057,203.847,370.114,157.811"></path> <path style={{fill:'#AF6D2D'}} d="M256.002,512.004c0-138.664-77.241-397.241-194.207-397.241 C-19.966,351.668,96.373,512.004,256.002,512.004"></path> <path style={{fill:'#864D18'}} d="M185.347,471.952c-1.121,0-2.26-0.221-3.363-0.671c-31.603-13.065-58.033-34.278-78.539-63.047 c-41.393-58.068-52.515-141.047-31.329-233.657c1.086-4.758,5.826-7.733,10.575-6.63c4.749,1.086,7.724,5.817,6.638,10.567 c-20.047,87.623-9.931,165.57,28.495,219.471c18.556,26.033,42.408,45.197,70.894,56.973c4.511,1.863,6.656,7.027,4.793,11.529 C192.1,469.895,188.816,471.952,185.347,471.952"></path> <path style={{fill:'#AF6D2D'}} d="M256.002,512.004c0-138.664,77.241-397.241,194.207-397.241 C531.97,351.668,415.631,512.004,256.002,512.004"></path> <path style={{fill:'#B49377'}} d="M184.403,141.249c-0.83,0-1.66-0.124-2.498-0.362c-4.67-1.377-7.353-6.285-5.976-10.964 c11.714-39.812,28.637-71.318,47.634-88.691c3.593-3.302,9.181-3.046,12.473,0.556c3.293,3.593,3.037,9.181-0.556,12.473 c-16.419,15.007-31.947,44.403-42.611,80.649C191.739,138.751,188.216,141.249,184.403,141.249"></path> </g> </g></svg>
             <svg className="plant" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 512.002 512.002" xmlSpace="preserve" fill="#000000"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path style={{fill:'#8B4513'}} d="M252.899,512.002c-4.504,0-8.313-3.471-8.643-8.036c-7.706-104.222,3.662-160.516,11.186-197.762 c8.669-42.947,12.635-62.551-18.276-109.698c-2.629-4.009-1.51-9.39,2.499-12.019c4.009-2.629,9.39-1.519,12.019,2.499 c34.816,53.118,29.826,77.815,20.766,122.654c-7.775,38.487-18.415,91.205-10.891,193.041c0.356,4.782-3.237,8.947-8.01,9.294 C253.333,511.994,253.116,512.002,252.899,512.002"></path> <g> <path style={{fill:'#91CF96'}} d="M252.908,512.002c0-81.651-45.481-234.305-114.35-234.305 C90.422,417.187,158.917,512.002,252.908,512.002"></path> <path style={{fill:'#91CF96'}} d="M252.908,512.002c0-81.651,45.481-234.305,114.35-234.305 C415.394,417.187,346.899,512.002,252.908,512.002"></path> <path style={{fill:'#91CF96'}} d="M270.264,277.697c-1.927,0-3.81-0.642-5.346-1.84c-2.013-1.579-3.237-3.966-3.332-6.517 c-2.994-81.868,59.184-115.538,118.376-119.747c2.3-0.148,4.565,0.599,6.3,2.1c1.736,1.51,2.803,3.645,2.968,5.944 c0.876,12.314-16.419,98.807-117.187,119.877C271.453,277.636,270.854,277.697,270.264,277.697"></path> <path style={{fill:'#91CF96'}} d="M244.332,200.401c-0.963,0-1.927-0.165-2.846-0.495c-65.38-23.535-89.183-69.068-97.644-103.12 c-10.865-43.728-0.946-85.001,7.194-93.948c2.291-2.517,5.84-3.463,9.068-2.421c18.701,6.014,115.252,67.098,92.898,192.738 c-0.061,0.347-0.148,0.694-0.252,1.033c-0.694,2.265-2.308,4.209-4.434,5.268C247.074,200.071,245.703,200.401,244.332,200.401"></path> </g> <g> <path style={{fill:'#5ABA63'}} d="M270.264,277.697c-2.187,0-4.382-0.824-6.075-2.482c-3.419-3.35-3.48-8.843-0.121-12.271 l53.404-54.524c3.358-3.428,8.852-3.48,12.271-0.13c3.428,3.35,3.489,8.843,0.13,12.271l-53.413,54.532 C274.768,276.829,272.512,277.697,270.264,277.697"></path> <path style={{fill:'#5ABA63'}} d="M244.467,200.311c-3.15,0-6.187-1.718-7.732-4.712l-39.224-76.436 c-2.196-4.261-0.503-9.494,3.758-11.681c4.261-2.204,9.494-0.503,11.681,3.758l39.233,76.427c2.187,4.27,0.503,9.502-3.758,11.689 C247.157,200.008,245.795,200.311,244.467,200.311"></path> </g> </g> </g></svg>
           </span>
        </label>
    );
};


const FeatureSwitch: React.FC<{ checked: boolean; onChange?: () => void; disabled?: boolean; }> = ({ checked, onChange, disabled }) => {
    return (
        <label className="switch">
            <input className="ch" type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
            <span className="slider"></span>
        </label>
    );
};

const FeatureStore: React.FC = () => {
    const { currentUser, userProfile } = useAuth();
    const [loading, setLoading] = useState<string | null>(null); // Store the view being loaded
    const [error, setError] = useState<string | null>(null);

    const enabledFeatures = userProfile?.enabledFeatures || [ActiveView.Weather];

    const allOptionalFeatures = ALL_FEATURES.map(f => f.view);
    const allFeaturesEnabled = allOptionalFeatures.every(f => enabledFeatures.includes(f));

    const handleToggleAll = async () => {
        if (!currentUser) return;
        setLoading('all-features');
        setError(null);
        try {
            let newFeatures: ActiveView[];
            if (allFeaturesEnabled) {
                // If all are enabled, turn them off (except Weather)
                newFeatures = [ActiveView.Weather];
            } else {
                // If some/none are enabled, turn them all on
                newFeatures = Array.from(new Set([...allOptionalFeatures, ActiveView.Weather]));
            }
            await updateUserFeatures(currentUser.uid, newFeatures);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not update features.");
        } finally {
            setLoading(null);
        }
    };

    const handleToggleFeature = async (feature: ActiveView) => {
        if (!currentUser) return;
        setLoading(feature);
        setError(null);
        try {
            const isEnabled = enabledFeatures.includes(feature);
            let newFeatures;
            if (isEnabled) {
                if (feature === ActiveView.Weather) {
                    setError("The Weather Forecast feature cannot be removed.");
                    setLoading(null);
                    return;
                }
                newFeatures = enabledFeatures.filter(f => f !== feature);
            } else {
                newFeatures = [...enabledFeatures, feature];
            }
            await updateUserFeatures(currentUser.uid, newFeatures);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not update features.");
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="mb-12 text-center">
                <h2 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">Customize Your Dashboard</h2>
                <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
                    Enable or disable modules to tailor your KisanMitra experience. The Weather module is essential and cannot be disabled.
                </p>
            </div>

            {error && <p className="text-red-500 text-center mb-4 p-3 bg-red-50 rounded-md border border-red-200">{error}</p>}

            <div className="space-y-8">
                <div className="bg-white p-4 rounded-lg border shadow-sm flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-800">Enable All Features</h3>
                    <FeatureSwitch
                        checked={allFeaturesEnabled}
                        onChange={handleToggleAll}
                        disabled={loading === 'all-features'}
                    />
                </div>

                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-gray-800">Weather</h3>
                        <SeedSwitch checked disabled />
                    </div>
                    <p className="mt-2 text-gray-600">
                        Stay informed with real-time weather updates, forecasts, and alerts specific to your farm location. This module is essential for effective planning and cannot be disabled.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {ALL_FEATURES.map(feature => {
                        const isEnabled = enabledFeatures.includes(feature.view);
                        const isLoading = loading === feature.view;
                        return (
                            <div key={feature.view} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-gray-800">{feature.title}</h3>
                                    <FeatureSwitch
                                        checked={isEnabled}
                                        onChange={() => handleToggleFeature(feature.view)}
                                        disabled={isLoading}
                                    />
                                </div>
                                <p className="mt-2 text-gray-600">{feature.description}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default FeatureStore;
