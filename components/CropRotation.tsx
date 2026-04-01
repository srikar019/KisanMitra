import React, { useState, useCallback } from 'react';
import { getProfitForecast } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';
import type { ProfitForecastRequest, ProfitForecastResponse } from '../types';
import Icon from './common/Icon';
import Spinner from './common/Spinner';
import { useLanguage } from '../contexts/LanguageContext';

const ProfitForecaster: React.FC = () => {
    const { userProfile } = useAuth();
    const { translate } = useLanguage();
    const currencies = ['USD', 'EUR', 'INR', 'GBP', 'JPY', 'CAD', 'AUD'];
    const [request, setRequest] = useState<ProfitForecastRequest>({
        cropName: 'Corn',
        location: userProfile?.location || '',
        expectedYield: 50,
        yieldUnit: 'tons',
        cultivationArea: 100,
        areaUnit: 'acres',
        totalCosts: 15000,
        currency: 'USD',
    });
    const [forecast, setForecast] = useState<ProfitForecastResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleRequestChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setRequest(prev => ({ 
            ...prev, 
            [name]: ['expectedYield', 'cultivationArea', 'totalCosts'].includes(name) ? parseFloat(value) || 0 : value 
        }));
    };

    const handleLocationDetect = () => {
        if (navigator.geolocation) {
            setLoading(true);
            setError(null);
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setRequest(prev => ({ ...prev, location: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` }));
                    setLoading(false);
                },
                (geoError) => {
                    setError(`Geolocation error: ${geoError.message}`);
                    setLoading(false);
                }
            );
        } else {
            setError("Geolocation is not supported by this browser.");
        }
    };

    const getPrediction = useCallback(async () => {
        if (!request.location.trim() || !request.cropName.trim() || request.expectedYield <= 0 || request.totalCosts <= 0) {
            setError('Please fill in all required fields with valid numbers.');
            return;
        }
        setLoading(true);
        setError(null);
        setForecast(null);
        try {
            const data = await getProfitForecast(request);
            setForecast(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setLoading(false);
        }
    }, [request]);

    return (
        <div className="w-full bg-[#f8faf6] min-h-screen text-[#191c1a] font-sans pb-16 pt-4 rounded-xl">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header Area */}
                <div className="pt-4 px-4 md:px-6">
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#0d631b] mb-3" style={{ fontFamily: 'Lexend, sans-serif' }}>
                        {translate('profitForecaster.title')}
                    </h1>
                    <p className="text-lg text-[#40493d] max-w-2xl font-medium">
                        {translate('profitForecaster.description')}
                    </p>
                </div>

                {/* Input Card Layer (Surface Container Low) */}
                <div className="bg-[#f2f4f0] rounded-[2rem] p-6 lg:p-10 shadow-[0_12px_24px_-10px_rgba(13,99,27,0.05)] border-none mx-4 md:mx-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                        {/* Crop Name */}
                        <div className="bg-[#e1e3df] rounded-2xl p-5 flex flex-col justify-end transition-colors focus-within:bg-[#d9dbd7]">
                            <label className="text-sm font-bold text-[#40493d] uppercase tracking-wider mb-2">{translate('profitForecaster.crop')}</label>
                            <input type="text" name="cropName" value={request.cropName} onChange={handleRequestChange} 
                                className="w-full bg-transparent border-0 focus:ring-0 text-2xl font-semibold text-[#191c1a] p-0 border-b-2 border-transparent focus:border-[#0d631b] transition-all" />
                        </div>

                        {/* Location */}
                        <div className="bg-[#e1e3df] rounded-2xl p-5 flex flex-col justify-end lg:col-span-2 transition-colors focus-within:bg-[#d9dbd7] relative overflow-hidden group">
                            <label className="text-sm font-bold text-[#40493d] uppercase tracking-wider mb-2">{translate('profitForecaster.location')}</label>
                            <div className="flex items-center">
                                <input type="text" name="location" value={request.location} onChange={handleRequestChange} placeholder={translate('planting.form.location.placeholder')} 
                                    className="w-full bg-transparent border-0 focus:ring-0 text-2xl font-semibold text-[#191c1a] p-0 border-b-2 border-transparent focus:border-[#0d631b] transition-all relative z-10" />
                            </div>
                            <button onClick={handleLocationDetect} 
                                className="absolute right-0 top-0 bottom-0 px-6 flex items-center justify-center bg-[#7a5649] text-white transition-all hover:bg-[#603f33] z-20 group-hover:px-8"
                                title="Detect Location">
                                <Icon name="location" className="h-7 w-7" />
                            </button>
                        </div>

                        {/* Expected Yield */}
                        <div className="bg-[#e1e3df] rounded-2xl p-5 flex flex-col justify-end transition-colors focus-within:bg-[#d9dbd7]">
                            <label className="text-sm font-bold text-[#40493d] uppercase tracking-wider mb-2">{translate('profitForecaster.yield')}</label>
                            <div className="flex gap-3">
                                <input type="number" name="expectedYield" value={request.expectedYield} onChange={handleRequestChange} 
                                    className="w-2/3 bg-transparent border-0 focus:ring-0 text-2xl font-semibold text-[#191c1a] p-0 border-b-2 border-transparent focus:border-[#0d631b] transition-all" />
                                <input type="text" name="yieldUnit" value={request.yieldUnit} onChange={handleRequestChange} 
                                    className="w-1/3 bg-transparent border-0 focus:ring-0 text-xl font-medium text-[#40493d] p-0 border-b-2 border-transparent focus:border-[#0d631b] transition-all text-right" />
                            </div>
                        </div>

                        {/* Cultivation Area */}
                        <div className="bg-[#e1e3df] rounded-2xl p-5 flex flex-col justify-end transition-colors focus-within:bg-[#d9dbd7]">
                            <label className="text-sm font-bold text-[#40493d] uppercase tracking-wider mb-2">{translate('profitForecaster.area')}</label>
                            <div className="flex gap-3">
                                <input type="number" name="cultivationArea" value={request.cultivationArea} onChange={handleRequestChange} 
                                    className="w-1/2 bg-transparent border-0 focus:ring-0 text-2xl font-semibold text-[#191c1a] p-0 border-b-2 border-transparent focus:border-[#0d631b] transition-all" />
                                <select name="areaUnit" value={request.areaUnit} onChange={handleRequestChange} 
                                    className="w-1/2 bg-transparent border-0 focus:ring-0 text-xl font-medium text-[#40493d] p-0 border-b-2 border-transparent focus:border-[#0d631b] transition-all cursor-pointer">
                                    <option value="acres">{translate('cropYield.acres')}</option>
                                    <option value="hectares">{translate('cropYield.hectares')}</option>
                                </select>
                            </div>
                        </div>

                        {/* Total Costs */}
                        <div className="bg-[#e1e3df] rounded-2xl p-5 flex flex-col justify-end md:col-span-2 lg:col-span-1 transition-colors focus-within:bg-[#d9dbd7]">
                            <label className="text-sm font-bold text-[#40493d] uppercase tracking-wider mb-2">{translate('profitForecaster.costs')}</label>
                            <div className="flex gap-3 items-end">
                                <input type="number" name="totalCosts" value={request.totalCosts} onChange={handleRequestChange} 
                                    className="w-2/3 bg-transparent border-0 focus:ring-0 text-2xl font-semibold text-[#191c1a] p-0 border-b-2 border-transparent focus:border-[#0d631b] transition-all" />
                                <select name="currency" value={request.currency} onChange={handleRequestChange} 
                                    className="w-1/3 bg-transparent border-0 focus:ring-0 text-xl font-medium text-[#40493d] p-0 border-b-2 border-transparent focus:border-[#0d631b] transition-all cursor-pointer text-right">
                                    {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-start">
                        <button 
                            onClick={getPrediction} 
                            disabled={loading} 
                            style={{ fontFamily: 'Lexend, sans-serif' }}
                            className="bg-gradient-to-br from-[#0d631b] to-[#2e7d32] text-white text-xl font-bold py-5 px-10 rounded-2xl w-full sm:w-auto shadow-[0_8px_20px_-6px_rgba(13,99,27,0.4)] hover:shadow-[0_12px_24px_-6px_rgba(13,99,27,0.5)] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-4">
                            {loading ? (
                                <Spinner />
                            ) : (
                                <><Icon name="calculator" className="w-7 h-7" /> {translate('profitForecaster.calculate')}</>
                            )}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="bg-[#ffdad6] text-[#93000a] p-6 rounded-2xl mx-4 md:mx-6 font-medium shadow-sm">
                        {error}
                    </div>
                )}

                {/* Results Section */}
                {forecast && (
                    <div className="animate-fade-in space-y-10 mx-4 md:mx-6 mt-12 pb-20">
                        {/* Summary Cards Layer - Organic Layout */}
                        <div className="bg-[#e7e9e5] p-8 md:p-12 rounded-[2.5rem] relative overflow-hidden shadow-lg border-0">
                            {/* Decorative Background Elements */}
                            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[#a3f69c] to-transparent rounded-full opacity-30 blur-3xl mix-blend-multiply pointer-events-none"></div>

                            <h3 className="text-3xl md:text-4xl font-black text-[#191c1a] mb-8 relative z-10" style={{ fontFamily: 'Lexend, sans-serif' }}>
                                Forecast: {request.cropName}
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                                <div className="bg-[#f8faf6] bg-opacity-90 backdrop-blur-md p-6 rounded-2xl flex flex-col justify-between shadow-sm">
                                    <p className="text-sm font-bold text-[#7a5649] tracking-wider uppercase mb-2">{translate('profitForecaster.results.predictedPrice')}</p>
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-4xl font-black text-[#191c1a]">{forecast.predictedMarketPrice.toFixed(0)}</p>
                                        <p className="text-sm font-bold text-[#40493d] uppercase">{forecast.priceUnit}</p>
                                    </div>
                                </div>
                                
                                <div className="bg-[#f8faf6] bg-opacity-90 backdrop-blur-md p-6 rounded-2xl flex flex-col justify-between shadow-sm">
                                    <p className="text-sm font-bold text-[#7a5649] tracking-wider uppercase mb-2">{translate('profitForecaster.results.revenue')}</p>
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-4xl font-black text-[#191c1a]">{forecast.totalRevenue.toFixed(0)}</p>
                                        <p className="text-sm font-bold text-[#40493d] uppercase">{request.currency}</p>
                                    </div>
                                </div>

                                {/* Profit / Loss Highlight Container */}
                                <div className={`p-6 rounded-2xl flex flex-col justify-between shadow-md ${forecast.netProfitOrLoss >= 0 ? 'bg-gradient-to-br from-[#cbffc2] to-[#a3f69c]' : 'bg-gradient-to-br from-[#ffdad6] to-[#fdcdbc]'}`}>
                                    <p className={`text-sm font-black tracking-wider uppercase mb-2 ${forecast.netProfitOrLoss >= 0 ? 'text-[#005312]' : 'text-[#93000a]'}`}>
                                        {translate('profitForecaster.results.profit')}
                                    </p>
                                    <div className="flex items-baseline gap-2">
                                        <p className={`text-4xl font-black ${forecast.netProfitOrLoss >= 0 ? 'text-[#002204]' : 'text-[#410002]'}`}>
                                            {forecast.netProfitOrLoss > 0 ? '+' : ''}{forecast.netProfitOrLoss.toFixed(0)}
                                        </p>
                                        <p className={`text-sm font-bold uppercase ${forecast.netProfitOrLoss >= 0 ? 'text-[#005312]' : 'text-[#93000a]'}`}>{request.currency}</p>
                                    </div>
                                </div>

                                <div className="bg-[#191c1a] text-[#f8faf6] p-6 rounded-2xl flex flex-col justify-between shadow-md">
                                    <p className="text-sm font-bold text-[#88d982] tracking-wider uppercase mb-2">{translate('profitForecaster.results.roi')}</p>
                                    <p className="text-5xl font-black text-white">{forecast.returnOnInvestment.toFixed(1)}%</p>
                                </div>
                            </div>

                            <div className="mt-8 bg-[#ffffff] bg-opacity-80 p-8 rounded-2xl shadow-sm border-l-8 border-[#0d631b] relative z-10">
                                <h4 className="text-sm font-bold text-[#7a5649] uppercase tracking-wider mb-2">{translate('profitForecaster.results.analysis')}</h4>
                                <p className="text-[#191c1a] text-lg leading-relaxed font-medium">{forecast.analysis}</p>
                            </div>
                        </div>
                        
                        {/* Alternative Crops Section - Stacked organic layers */}
                        <div className="pt-8 md:pl-6 border-l-4 border-transparent lg:border-l-[#e1e3df]">
                            <h3 className="text-3xl font-black text-[#191c1a] mb-2" style={{ fontFamily: 'Lexend, sans-serif' }}>
                                Better Crop Options
                            </h3>
                            <p className="text-[#40493d] font-medium text-lg mb-8">{translate('profitForecaster.results.alternativesDesc')}</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {forecast.alternativeCrops.map((alt, index) => (
                                    <div key={index} className="bg-[#f2f4f0] p-8 rounded-3xl transition-transform hover:-translate-y-2 hover:shadow-xl duration-300 relative group overflow-hidden">
                                        {/* Hover accent */}
                                        <div className="absolute inset-x-0 bottom-0 h-2 bg-[#0d631b] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        
                                        <div className="flex justify-between items-start mb-6">
                                            <h4 className="font-black text-3xl text-[#191c1a]" style={{ fontFamily: 'Lexend, sans-serif' }}>{alt.cropName}</h4>
                                            <span className="font-extrabold text-[#002204] bg-[#a3f69c] px-4 py-2 rounded-xl text-lg shadow-sm">
                                                {alt.profitMarginChange}
                                            </span>
                                        </div>
                                        <p className="text-[#40493d] font-medium text-lg leading-relaxed">{alt.reasoning}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Data Sources Layer */}
                        {forecast.sources && forecast.sources.length > 0 && (
                            <div className="bg-[#e1e3df] p-6 lg:p-8 rounded-[2rem] mt-16 shadow-inner">
                                <h4 className="text-sm font-bold tracking-wider uppercase text-[#7a5649] mb-4">{translate('profitForecaster.results.sources')}</h4>
                                <div className="flex flex-wrap gap-3">
                                    {forecast.sources.map((source, index) => (
                                        <a key={index} href={source.uri} target="_blank" rel="noopener noreferrer" 
                                           className="bg-[#f8faf6] hover:bg-[#ffffff] text-[#191c1a] px-5 py-3 rounded-xl text-sm font-bold transition-colors shadow-sm inline-flex items-center gap-2 group">
                                            {source.title}
                                            <Icon name="external-link" className="w-4 h-4 text-[#707a6c] group-hover:text-[#0d631b]" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfitForecaster;
