import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from './common/Icon';
import Spinner from './common/Spinner';
import { useLanguage } from '../contexts/LanguageContext';
import { getLiveCommodityPrices } from '../services/geminiService';
import type { LiveCommodityData } from '../services/geminiService';

const POPULAR_COMMODITIES = [
    'Wheat', 'Rice', 'Soybean', 'Cotton', 'Mustard Seed',
    'Chana', 'Guar Seed', 'Turmeric', 'Jeera', 'Sugar',
    'Maize', 'Onion', 'Potato', 'Tomato', 'Coriander',
    'Cardamom', 'Black Pepper', 'Castor Seed', 'Mentha Oil', 'Barley',
];

const LiveCommoditiesMarket: React.FC = () => {
    const { translate, language } = useLanguage();
    const [commodities, setCommodities] = useState<LiveCommodityData[]>([]);
    const [selectedSymbol, setSelectedSymbol] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

    // Search / add state
    const [searchInput, setSearchInput] = useState('');
    const [targetDate, setTargetDate] = useState<string>(''); // YYYY-MM-DD
    const [trackedNames, setTrackedNames] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem('kisanmitra_tracked_commodities');
            return stored ? JSON.parse(stored) : ['Wheat', 'Soybean', 'Cotton', 'Mustard Seed', 'Chana', 'Guar Seed'];
        } catch {
            return ['Wheat', 'Soybean', 'Cotton', 'Mustard Seed', 'Chana', 'Guar Seed'];
        }
    });
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Persist tracked commodities
    useEffect(() => {
        localStorage.setItem('kisanmitra_tracked_commodities', JSON.stringify(trackedNames));
    }, [trackedNames]);

    // Close suggestions on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchPrices = useCallback(async () => {
        if (trackedNames.length === 0) return;
        setLoading(true);
        setError(null);
        try {
            const data = await getLiveCommodityPrices(trackedNames, language, targetDate || undefined);
            setCommodities(data);
            if (data.length > 0 && !selectedSymbol) {
                setSelectedSymbol(data[0].symbol);
            }
            setLastFetchTime(new Date());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch commodity prices.');
        } finally {
            setLoading(false);
        }
    }, [trackedNames, language, targetDate]);

    // Fetch on mount and when tracked list changes
    useEffect(() => {
        fetchPrices();
    }, [fetchPrices]);

    const addCommodity = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        if (trackedNames.some(n => n.toLowerCase() === trimmed.toLowerCase())) return;
        setTrackedNames(prev => [...prev, trimmed]);
        setSearchInput('');
        setShowSuggestions(false);
    };

    const removeCommodity = (name: string) => {
        setTrackedNames(prev => prev.filter(n => n.toLowerCase() !== name.toLowerCase()));
        setCommodities(prev => prev.filter(c => c.name.toLowerCase() !== name.toLowerCase()));
        if (commodities.find(c => c.symbol === selectedSymbol)?.name.toLowerCase() === name.toLowerCase()) {
            setSelectedSymbol(commodities.find(c => c.name.toLowerCase() !== name.toLowerCase())?.symbol || '');
        }
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addCommodity(searchInput);
    };

    const filteredSuggestions = POPULAR_COMMODITIES.filter(
        name => name.toLowerCase().includes(searchInput.toLowerCase()) &&
        !trackedNames.some(t => t.toLowerCase() === name.toLowerCase())
    );

    const selectedCommodity = commodities.find(c => c.symbol === selectedSymbol) || commodities[0];

    // SVG Sparkline — shows day range position visually
    const RangeBar = ({ low, high, current }: { low: number; high: number; current: number }) => {
        const range = high - low || 1;
        const position = Math.max(0, Math.min(100, ((current - low) / range) * 100));
        return (
            <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden shadow-inner relative">
                <div className="absolute top-0 bottom-0 w-0.5 bg-white z-10 shadow-[0_0_8px_white]"
                     style={{ left: `${position}%` }}>
                </div>
                <div
                    className="bg-gradient-to-r from-indigo-600 to-indigo-400 h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${position}%` }}
                ></div>
            </div>
        );
    };

    const getTrendColor = (trend: string) => {
        if (trend === 'up') return 'text-emerald-400';
        if (trend === 'down') return 'text-rose-400';
        return 'text-gray-400';
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active_futures': return { label: 'FUTURES', classes: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
            case 'spot_only': return { label: 'SPOT', classes: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
            case 'suspended': return { label: 'SUSPENDED', classes: 'bg-red-500/20 text-red-400 border-red-500/30' };
            default: return { label: 'SPOT', classes: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
        }
    };

    return (
        <div className="bg-gray-900 rounded-xl p-6 text-white shadow-2xl relative overflow-hidden animate-fade-in border border-gray-800">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                <h3 className="text-2xl font-bold text-gray-100 flex items-center">
                    <Icon name="activity" className="mr-3 text-emerald-400" />
                    Live Market Prices
                </h3>
                <div className="flex items-center gap-3 flex-wrap">
                    <input 
                        type="date" 
                        value={targetDate} 
                        onChange={(e) => setTargetDate(e.target.value)}
                        max={new Date().toISOString().split("T")[0]}
                        className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                    {lastFetchTime && (
                        <span className="text-xs text-gray-500 hidden sm:inline">
                            Updated: {lastFetchTime.toLocaleTimeString()}
                        </span>
                    )}
                    <button
                        onClick={fetchPrices}
                        disabled={loading}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                    >
                        <Icon name="refresh-cw" className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Info banner */}
            <div className="mb-5 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-start gap-2">
                <Icon name="info" className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-emerald-200/80 leading-relaxed">
                    Prices fetched from <strong>NCDEX, MCX, and mandi spot markets</strong> via web search + AI extraction.
                    Data may be delayed. For official real-time quotes, visit{' '}
                    <a href="https://www.ncdex.com" target="_blank" rel="noopener noreferrer" className="underline text-emerald-300 hover:text-emerald-200">ncdex.com</a> or{' '}
                    <a href="https://www.mcxindia.com" target="_blank" rel="noopener noreferrer" className="underline text-emerald-300 hover:text-emerald-200">mcxindia.com</a>.
                </p>
            </div>

            {/* Search & Add */}
            <div ref={searchRef} className="relative mb-6">
                <form onSubmit={handleSearchSubmit} className="flex gap-2">
                    <div className="relative flex-1">
                        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => { setSearchInput(e.target.value); setShowSuggestions(true); }}
                            onFocus={() => setShowSuggestions(true)}
                            placeholder="Search commodity to track (e.g. Rice, Turmeric, Jeera...)"
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!searchInput.trim()}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                        + Add
                    </button>
                </form>

                {/* Suggestions dropdown */}
                {showSuggestions && searchInput && filteredSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-30 max-h-48 overflow-y-auto">
                        {filteredSuggestions.map(name => (
                            <button
                                key={name}
                                onClick={() => addCommodity(name)}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors first:rounded-t-lg last:rounded-b-lg"
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Tracked tags */}
            {trackedNames.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                    {trackedNames.map(name => (
                        <span key={name} className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 border border-gray-700 rounded-full text-xs text-gray-300">
                            {name}
                            <button
                                onClick={() => removeCommodity(name)}
                                className="text-gray-500 hover:text-rose-400 transition-colors"
                                aria-label={`Remove ${name}`}
                            >
                                ✕
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Loading state */}
            {loading && commodities.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <Spinner />
                    <p className="text-gray-400 text-sm">Fetching live market prices...</p>
                </div>
            )}

            {/* Error state */}
            {error && (
                <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
                    <Icon name="alert-triangle" className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm text-red-300">{error}</p>
                        <button onClick={fetchPrices} className="text-xs text-red-400 underline mt-1 hover:text-red-300">Try again</button>
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!loading && !error && trackedNames.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
                    <Icon name="search" className="w-12 h-12 text-gray-700" />
                    <p className="text-sm">Search and add commodities to start tracking prices.</p>
                </div>
            )}

            {/* Main commodity grid */}
            {commodities.length > 0 && (
                <>
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
                        <div className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {commodities.map(cmd => {
                                const statusBadge = getStatusBadge(cmd.tradingStatus);
                                return (
                                    <div
                                        key={cmd.symbol}
                                        onClick={() => setSelectedSymbol(cmd.symbol)}
                                        className={`p-4 rounded-lg cursor-pointer transition-all duration-300 border backdrop-blur-sm
                                            ${selectedSymbol === cmd.symbol
                                                ? 'bg-gray-800 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                                                : 'bg-gray-800/40 border-gray-700/50 hover:bg-gray-800 hover:border-gray-500'}`}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h4 className="font-bold text-md text-gray-100 leading-tight">{cmd.symbol}</h4>
                                                <span className="text-xs text-gray-400">{cmd.name}</span>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <span className={`text-[10px] px-1.5 py-0 rounded border ${statusBadge.classes}`}>
                                                        {cmd.exchange}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeCommodity(cmd.name); }}
                                                className="text-gray-600 hover:text-rose-400 text-xs transition-colors p-1"
                                                aria-label={`Remove ${cmd.name}`}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <span className={`text-xl font-black transition-colors duration-300 ${getTrendColor(cmd.trend)}`}>
                                                    ₹{cmd.currentPrice.toLocaleString('en-IN')}
                                                </span>
                                                <span className="text-[10px] text-gray-500 ml-1">{cmd.unit.replace('₹/', '/')}</span>
                                            </div>
                                            <div className={`flex flex-col items-end text-xs font-bold ${cmd.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                <span>{cmd.change24h >= 0 ? '▲' : '▼'} {Math.abs(cmd.change24h).toFixed(1)}</span>
                                                <span>({Math.abs(cmd.changePercent24h).toFixed(2)}%)</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Featured Commodity Card */}
                        {selectedCommodity && (
                            <div className="bg-gradient-to-br from-indigo-950 via-gray-900 to-black rounded-xl p-6 border border-indigo-500/30 shadow-[inset_0_0_20px_rgba(99,102,241,0.1)] flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h3 className="text-xl font-bold text-indigo-300">{selectedCommodity.name}</h3>
                                            <span className="text-xs text-gray-400">{selectedCommodity.exchange}</span>
                                        </div>
                                        {(() => {
                                            const badge = getStatusBadge(selectedCommodity.tradingStatus);
                                            return (
                                                <span className={`px-2 py-1 text-xs rounded-md border font-mono tracking-widest ${badge.classes}`}>
                                                    {badge.label}
                                                </span>
                                            );
                                        })()}
                                    </div>

                                    <div className="text-5xl sm:text-6xl font-black text-white mb-1 drop-shadow-lg tabular-nums">
                                        ₹{selectedCommodity.currentPrice.toLocaleString('en-IN')}
                                    </div>
                                    <p className="text-xs text-gray-500 mb-2">{selectedCommodity.unit}</p>

                                    <div className={`text-xl font-bold flex items-center tabular-nums ${selectedCommodity.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {selectedCommodity.change24h >= 0 ? '+' : ''}{selectedCommodity.change24h.toFixed(2)}
                                        <span className="ml-2 px-2 py-0.5 rounded-full bg-black/30 border border-current text-sm">
                                            {selectedCommodity.change24h >= 0 ? '+' : ''}{selectedCommodity.changePercent24h.toFixed(2)}%
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-8 space-y-3">
                                    <div className="flex justify-between text-sm text-gray-400">
                                        <span>Day Range</span>
                                        <span className="font-mono">₹{selectedCommodity.dayLow.toLocaleString('en-IN')} — ₹{selectedCommodity.dayHigh.toLocaleString('en-IN')}</span>
                                    </div>
                                    <RangeBar low={selectedCommodity.dayLow} high={selectedCommodity.dayHigh} current={selectedCommodity.currentPrice} />
                                    <div className="flex justify-between text-xs text-gray-500 pt-1">
                                        <span>Last updated: {selectedCommodity.lastUpdated}</span>
                                        {selectedCommodity.sourceUrl && (
                                            <a href={selectedCommodity.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
                                                Source
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Marquee Ticker */}
                    <div className="w-[calc(100%+3rem)] -mx-6 bg-black/60 border-y border-gray-800 py-3 overflow-hidden flex whitespace-nowrap relative">
                        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-gray-900 to-transparent z-10"></div>
                        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-gray-900 to-transparent z-10"></div>
                        <div className="animate-[marquee_25s_linear_infinite] flex space-x-12 px-6">
                            {[...commodities, ...commodities, ...commodities].map((cmd, i) => (
                                <div key={`${cmd.symbol}-${i}`} className="flex items-center space-x-3 text-sm font-mono tracking-wide">
                                    <span className="text-gray-400 font-bold">{cmd.symbol}</span>
                                    <span className="text-white text-base">₹{cmd.currentPrice.toLocaleString('en-IN')}</span>
                                    <span className={`font-bold flex items-center ${cmd.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {cmd.change24h >= 0 ? <Icon name="trending-up" className="w-4 h-4 mr-1" /> : <Icon name="trending-down" className="w-4 h-4 mr-1" />}
                                        {Math.abs(cmd.changePercent24h).toFixed(2)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            <style>{`
                @keyframes marquee {
                    0% { transform: translateX(0%); }
                    100% { transform: translateX(-33.33%); }
                }
            `}</style>
        </div>
    );
};

export default LiveCommoditiesMarket;
