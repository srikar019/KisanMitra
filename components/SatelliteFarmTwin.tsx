import React, { useState, useCallback, useEffect, useRef } from 'react';
import Card from './common/Card';
import Button from './common/Button';
import Spinner from './common/Spinner';
import Icon from './common/Icon';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { getFullSatelliteAnalysis } from '../services/satelliteService';
import type { SatelliteAnalysis, NdviTimeSeriesPoint } from '../services/satelliteService';
import { firestore } from '../services/firebase';
import firebase from 'firebase/compat/app';

// ─── NDVI Time Series Chart (SVG) ───────────────────────────────────────────
const NdviChart: React.FC<{ data: NdviTimeSeriesPoint[] }> = ({ data }) => {
    if (data.length === 0) return <p className="text-sm text-gray-500 italic">No time series data available for this area.</p>;

    const width = 700;
    const height = 220;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const yMin = 0;
    const yMax = Math.max(0.8, ...data.map(d => d.max));
    const xScale = (i: number) => padding.left + (i / (data.length - 1 || 1)) * chartW;
    const yScale = (v: number) => padding.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

    const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(d.mean).toFixed(1)}`).join(' ');
    const areaPath = linePath + ` L${xScale(data.length - 1).toFixed(1)},${yScale(yMin).toFixed(1)} L${xScale(0).toFixed(1)},${yScale(yMin).toFixed(1)} Z`;

    const getNdviColor = (val: number) => {
        if (val < 0.2) return '#ef4444';
        if (val < 0.35) return '#f97316';
        if (val < 0.5) return '#eab308';
        if (val < 0.65) return '#84cc16';
        return '#22c55e';
    };

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 240 }}>
            <defs>
                <linearGradient id="ndviGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
                </linearGradient>
            </defs>
            {/* Grid lines */}
            {[0, 0.2, 0.4, 0.6, 0.8].filter(v => v <= yMax).map(v => (
                <g key={v}>
                    <line x1={padding.left} y1={yScale(v)} x2={width - padding.right} y2={yScale(v)} stroke="#e5e7eb" strokeDasharray="4 4" />
                    <text x={padding.left - 8} y={yScale(v) + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{v.toFixed(1)}</text>
                </g>
            ))}
            {/* Area */}
            <path d={areaPath} fill="url(#ndviGrad)" />
            {/* Line */}
            <path d={linePath} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinejoin="round" />
            {/* Min-Max range */}
            {data.map((d, i) => (
                <line key={i} x1={xScale(i)} y1={yScale(d.min)} x2={xScale(i)} y2={yScale(d.max)}
                    stroke={getNdviColor(d.mean)} strokeWidth="3" strokeLinecap="round" opacity="0.25" />
            ))}
            {/* Data points */}
            {data.map((d, i) => (
                <circle key={i} cx={xScale(i)} cy={yScale(d.mean)} r="4" fill={getNdviColor(d.mean)} stroke="white" strokeWidth="1.5" />
            ))}
            {/* X-axis labels */}
            {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0).map((d, _, arr) => {
                const idx = data.indexOf(d);
                const date = new Date(d.from);
                const label = date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                return (
                    <text key={idx} x={xScale(idx)} y={height - 8} textAnchor="middle" fontSize="9" fill="#9ca3af">{label}</text>
                );
            })}
            {/* Y-axis label */}
            <text x={14} y={height / 2} textAnchor="middle" fontSize="10" fill="#6b7280" transform={`rotate(-90, 14, ${height / 2})`}>NDVI</text>
        </svg>
    );
};

// ─── NDVI Legend ─────────────────────────────────────────────────────────────
const NdviLegend: React.FC = () => (
    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mt-2">
        <span className="font-semibold text-gray-700">NDVI Legend:</span>
        {[
            { color: '#1a3a12', label: 'Very Healthy (0.7+)' },
            { color: '#26a31a', label: 'Healthy (0.5-0.7)' },
            { color: '#e3d620', label: 'Moderate (0.3-0.5)' },
            { color: '#e06611', label: 'Stressed (0.1-0.3)' },
            { color: '#8b6633', label: 'Bare Soil (<0.1)' },
            { color: '#0d0d33', label: 'Water (<-0.1)' },
        ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block border border-gray-300" style={{ backgroundColor: color }} />
                {label}
            </span>
        ))}
    </div>
);


// ─── Main Component ──────────────────────────────────────────────────────────
const SatelliteFarmTwin: React.FC = () => {
    const { translate, language } = useLanguage();
    const { userProfile } = useAuth();

    const [lat, setLat] = useState('');
    const [lng, setLng] = useState('');
    const [locationName, setLocationName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<SatelliteAnalysis | null>(null);
    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [activeImageTab, setActiveImageTab] = useState<'ndvi' | 'truecolor'>('ndvi');
    const [geolocating, setGeolocating] = useState(false);

    // Pre-fill from user profile location
    useEffect(() => {
        if (userProfile?.location) {
            setLocationName(userProfile.location);
        }
    }, [userProfile]);

    const handleGeolocate = useCallback(() => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser.');
            return;
        }
        setGeolocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLat(pos.coords.latitude.toFixed(5));
                setLng(pos.coords.longitude.toFixed(5));
                setLocationName(`${pos.coords.latitude.toFixed(3)}°N, ${pos.coords.longitude.toFixed(3)}°E`);
                setGeolocating(false);
            },
            (err) => {
                setError(`Geolocation failed: ${err.message}`);
                setGeolocating(false);
            },
            { enableHighAccuracy: true }
        );
    }, []);

    const handleGeocodeLocation = useCallback(async () => {
        if (!locationName.trim()) return;
        setGeolocating(true);
        setError(null);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1`);
            const data = await res.json();
            if (data.length > 0) {
                setLat(parseFloat(data[0].lat).toFixed(5));
                setLng(parseFloat(data[0].lon).toFixed(5));
                setLocationName(data[0].display_name.split(',').slice(0, 3).join(', '));
            } else {
                setError('Location not found. Try a more specific name or use GPS.');
            }
        } catch {
            setError('Failed to geocode location.');
        } finally {
            setGeolocating(false);
        }
    }, [locationName]);

    const handleAnalyze = useCallback(async () => {
        const latNum = parseFloat(lat);
        const lngNum = parseFloat(lng);
        if (isNaN(latNum) || isNaN(lngNum)) {
            setError('Please enter valid coordinates or use the location search/GPS.');
            return;
        }
        setLoading(true);
        setError(null);
        setAnalysis(null);
        setAiInsight(null);
        try {
            const result = await getFullSatelliteAnalysis(latNum, lngNum);
            setAnalysis(result);

            // ── Save farm coordinates + latest NDVI for Health Passport ──
            if (userProfile?.uid) {
                const latestNdvi = result.timeSeries.length > 0
                    ? result.timeSeries[result.timeSeries.length - 1].mean
                    : null;
                firestore.collection('farmerVerifications').doc(userProfile.uid).set({
                    farmerUid: userProfile.uid,
                    phoneVerified: true,
                    farmCoordinates: { lat: latNum, lng: lngNum },
                    locationVerified: true,
                    ...(latestNdvi !== null ? { latestNdvi } : {}),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                }, { merge: true }).catch(err => console.warn('Failed to save farm coordinates:', err));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch satellite data.');
        } finally {
            setLoading(false);
        }
    }, [lat, lng, userProfile]);

    // AI Analysis of the NDVI image
    const handleAiAnalysis = useCallback(async () => {
        if (!analysis?.ndviImage) return;
        setAiLoading(true);
        try {
            const base64Data = analysis.ndviImage.replace(/^data:image\/png;base64,/, '');

            // Build context from time series
            let tsContext = '';
            if (analysis.timeSeries.length > 0) {
                const latest = analysis.timeSeries[analysis.timeSeries.length - 1];
                const earliest = analysis.timeSeries[0];
                tsContext = `\nTime series context: NDVI over last ${analysis.timeSeries.length * 10} days went from mean ${earliest.mean} to ${latest.mean}. ${latest.mean > earliest.mean ? 'Trend: IMPROVING' : latest.mean < earliest.mean ? 'Trend: DECLINING' : 'Trend: STABLE'}.`;
            }

            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gemini-3-flash-preview',
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                {
                                    inlineData: {
                                        data: base64Data,
                                        mimeType: 'image/png',
                                    },
                                },
                                {
                                    text: `You are an expert agronomist analyzing a Sentinel-2 satellite NDVI map of a farm near ${locationName || `${lat}°N, ${lng}°E`} in India.

Color key:
- Dark green (NDVI 0.7+) = Very healthy dense vegetation
- Light green (0.5-0.7) = Healthy crops
- Yellow-green (0.4-0.5) = Fair/moderate
- Yellow (0.3-0.4) = Moderate stress
- Orange (0.2-0.3) = Stressed vegetation
- Red (0.1-0.2) = Severely stressed
- Brown (<0.1) = Bare soil/fallow
- Dark blue (<-0.1) = Water bodies
${tsContext}

Provide a clear, actionable analysis FOR A FARMER in 4-5 bullet points:
1. Overall health assessment (% healthy vs stressed)
2. Problem areas identified (location description like "north-east corner")
3. Likely cause (water stress, nutrient deficiency, pest damage, etc.)
4. Specific action to take NOW
5. When to check again

Keep language simple and practical. Use Indian farming context (rabi/kharif seasons, common Indian crops).`,
                                },
                            ],
                        },
                    ],
                }),
            });

            if (!response.ok) throw new Error('AI analysis request failed');
            const result = await response.json();
            setAiInsight(result.text || 'Could not generate analysis.');
        } catch (err) {
            console.error('AI analysis error:', err);
            setAiInsight('Failed to generate AI analysis. Please try again.');
        } finally {
            setAiLoading(false);
        }
    }, [analysis, lat, lng, locationName]);

    // Auto-trigger AI analysis when satellite data loads
    useEffect(() => {
        if (analysis?.ndviImage && !aiInsight) {
            handleAiAnalysis();
        }
    }, [analysis]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Hero Header */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 p-8 text-white shadow-2xl">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4"></div>
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-xs font-mono tracking-wider text-emerald-300">
                            🛰️ SENTINEL-2 • 10m RESOLUTION
                        </span>
                        <span className="px-2.5 py-1 bg-purple-500/20 border border-purple-400/30 rounded-full text-xs font-mono tracking-wider text-purple-300">
                            POWERED BY COPERNICUS
                        </span>
                    </div>
                    <h2 className="text-3xl font-bold mb-2">Satellite Farm Twin</h2>
                    <p className="text-indigo-200 max-w-2xl text-sm leading-relaxed">
                        See your farm from space. Get AI-powered crop health analysis using real Sentinel-2 satellite imagery 
                        updated every 5 days — completely free with NDVI vegetation index mapping.
                    </p>
                </div>
            </div>

            {/* Location Input */}
            <Card className="p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Icon name="map-pin" className="w-6 h-6 text-indigo-600" />
                    Farm Location
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {/* Location search */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-600 mb-1">Search Location</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={locationName}
                                onChange={(e) => setLocationName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleGeocodeLocation()}
                                placeholder="e.g., Nashik, Maharashtra or Guntur, Andhra Pradesh"
                                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            />
                            <Button onClick={handleGeocodeLocation} disabled={geolocating || !locationName.trim()}
                                className="!bg-indigo-600 hover:!bg-indigo-700 text-white text-sm px-4">
                                {geolocating ? <Spinner /> : 'Search'}
                            </Button>
                        </div>
                    </div>

                    {/* GPS button */}
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Or Use GPS</label>
                        <Button onClick={handleGeolocate} disabled={geolocating}
                            className="w-full !bg-emerald-600 hover:!bg-emerald-700 text-white text-sm">
                            {geolocating ? <Spinner /> : '📍 Use My Location'}
                        </Button>
                    </div>
                </div>

                {/* Coordinate display */}
                <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Latitude</label>
                        <input type="text" value={lat} onChange={(e) => setLat(e.target.value)}
                            placeholder="e.g., 19.9975"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none font-mono" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Longitude</label>
                        <input type="text" value={lng} onChange={(e) => setLng(e.target.value)}
                            placeholder="e.g., 73.7898"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none font-mono" />
                    </div>
                </div>

                {/* Analyze button */}
                <Button onClick={handleAnalyze} disabled={loading || !lat || !lng}
                    className="!bg-gradient-to-r !from-indigo-600 !to-purple-600 hover:!from-indigo-700 hover:!to-purple-700 text-white font-semibold px-8 py-3 text-sm shadow-lg">
                    {loading ? (
                        <span className="flex items-center gap-2"><Spinner /> Scanning from orbit...</span>
                    ) : (
                        <span className="flex items-center gap-2">🛰️ Analyze Farm from Satellite</span>
                    )}
                </Button>

                {error && (
                    <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                        <Icon name="alert-triangle" className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}
            </Card>

            {/* Loading State */}
            {loading && (
                <Card className="p-12 text-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative w-20 h-20">
                            <div className="absolute inset-0 border-4 border-indigo-200 rounded-full animate-ping opacity-30"></div>
                            <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="absolute inset-0 flex items-center justify-center text-2xl">🛰️</span>
                        </div>
                        <div>
                            <p className="text-lg font-semibold text-gray-800">Fetching Satellite Imagery</p>
                            <p className="text-sm text-gray-500 mt-1">Processing Sentinel-2 bands (B04, B08) for NDVI analysis...</p>
                        </div>
                    </div>
                </Card>
            )}

            {/* Results */}
            {analysis && !loading && (
                <>
                    {/* Satellite Images */}
                    <Card className="p-6 overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Icon name="image" className="w-6 h-6 text-emerald-600" />
                                Satellite View
                            </h3>
                            <div className="flex bg-gray-100 rounded-lg p-0.5">
                                <button
                                    onClick={() => setActiveImageTab('ndvi')}
                                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${activeImageTab === 'ndvi' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    🌿 NDVI Health Map
                                </button>
                                <button
                                    onClick={() => setActiveImageTab('truecolor')}
                                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${activeImageTab === 'truecolor' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    🌍 True Color
                                </button>
                            </div>
                        </div>

                        <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-inner bg-black">
                            <img
                                src={activeImageTab === 'ndvi' ? analysis.ndviImage : analysis.trueColorImage}
                                alt={activeImageTab === 'ndvi' ? 'NDVI vegetation health map' : 'True color satellite view'}
                                className="w-full h-auto max-h-[500px] object-contain"
                            />
                            <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/70 backdrop-blur-sm rounded-md text-white text-xs font-mono">
                                {locationName || `${lat}°N, ${lng}°E`}
                            </div>
                            <div className="absolute top-3 right-3 px-2.5 py-1 bg-black/70 backdrop-blur-sm rounded-md text-emerald-300 text-xs font-mono">
                                {activeImageTab === 'ndvi' ? 'NDVI VEGETATION INDEX' : 'RGB TRUE COLOR'}
                            </div>
                            <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-black/70 backdrop-blur-sm rounded-md text-gray-300 text-xs font-mono">
                                Sentinel-2 L2A • 10m/px
                            </div>
                        </div>

                        {activeImageTab === 'ndvi' && <NdviLegend />}
                    </Card>

                    {/* AI Interpretation */}
                    <Card className="p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span className="text-xl">🤖</span>
                            AI Farm Health Analysis
                        </h3>
                        {aiLoading ? (
                            <div className="flex items-center gap-3 py-6 text-gray-500">
                                <Spinner />
                                <span className="text-sm">Gemini AI is analyzing your satellite imagery...</span>
                            </div>
                        ) : aiInsight ? (
                            <div className="prose prose-sm max-w-none">
                                <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl p-5 text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
                                    {aiInsight}
                                </div>
                                <button onClick={handleAiAnalysis}
                                    className="mt-3 text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                                    <Icon name="refresh-cw" className="w-3 h-3" /> Re-analyze
                                </button>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 italic">Analysis will appear here after satellite scan.</p>
                        )}
                    </Card>

                    {/* NDVI Time Series */}
                    <Card className="p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Icon name="trending-up" className="w-6 h-6 text-green-600" />
                            Crop Health Trend (Last 6 Months)
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">
                            Mean NDVI over 10-day intervals. Higher values (green) indicate denser, healthier vegetation.
                            Vertical bars show the min-max range within the area.
                        </p>
                        <NdviChart data={analysis.timeSeries} />

                        {/* Quick stats */}
                        {analysis.timeSeries.length > 0 && (() => {
                            const latest = analysis.timeSeries[analysis.timeSeries.length - 1];
                            const earliest = analysis.timeSeries[0];
                            const trend = latest.mean - earliest.mean;
                            const avgNdvi = analysis.timeSeries.reduce((s, d) => s + d.mean, 0) / analysis.timeSeries.length;
                            return (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                                        <p className="text-xs text-gray-500">Latest NDVI</p>
                                        <p className={`text-2xl font-bold ${latest.mean >= 0.5 ? 'text-emerald-600' : latest.mean >= 0.3 ? 'text-yellow-600' : 'text-red-600'}`}>
                                            {latest.mean.toFixed(2)}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                                        <p className="text-xs text-gray-500">6-Month Average</p>
                                        <p className="text-2xl font-bold text-gray-700">{avgNdvi.toFixed(2)}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                                        <p className="text-xs text-gray-500">Trend</p>
                                        <p className={`text-2xl font-bold ${trend > 0.02 ? 'text-emerald-600' : trend < -0.02 ? 'text-red-600' : 'text-gray-600'}`}>
                                            {trend > 0.02 ? '↑ Improving' : trend < -0.02 ? '↓ Declining' : '→ Stable'}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                                        <p className="text-xs text-gray-500">Data Points</p>
                                        <p className="text-2xl font-bold text-gray-700">{analysis.timeSeries.length}</p>
                                    </div>
                                </div>
                            );
                        })()}
                    </Card>
                </>
            )}

            {/* Info footer */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-xs text-indigo-700 leading-relaxed">
                <strong>About this feature:</strong> Uses <a href="https://dataspace.copernicus.eu/" target="_blank" rel="noopener noreferrer" className="underline">Copernicus Data Space Ecosystem</a> Sentinel-2 L2A data (10m resolution, revisit every 5 days).
                NDVI (Normalized Difference Vegetation Index) measures vegetation health using NIR and Red bands. Free under the Copernicus open data policy.
                AI analysis powered by Google Gemini.
            </div>
        </div>
    );
};

export default SatelliteFarmTwin;
