import React, { useState, useCallback, useEffect } from 'react';
import { fetchMarketPricePrediction } from '../services/apiClient';
import { analyzeMarketPredictionForAlerts } from '../services/geminiService';
import { createAlert } from '../services/alertService';
import { useAuth } from '../contexts/AuthContext';
import { onCustomAlertsSnapshot } from '../services/customAlertService';
import type { CropPricePrediction, PriceDataPoint, Alert, ActiveView, CustomAlert } from '../types';
import Card from './common/Card';
import Button from './common/Button';
import Spinner from './common/Spinner';
import Icon from './common/Icon';
import SetMarketAlertDialog from './modals/SetMarketAlertDialog';
import { useLanguage } from '../contexts/LanguageContext';

interface MarketPricesProps {
}

const AlertDisplay: React.FC<{ alert: Omit<Alert, 'id' | 'uid' | 'status' | 'createdAt' | 'relatedView' | 'relatedEntityId'> }> = ({ alert }) => {
    const severityClasses = {
        info: {
            bg: 'bg-blue-50',
            border: 'border-blue-200',
            icon: 'info',
            iconColor: 'text-blue-500'
        },
        warning: {
            bg: 'bg-yellow-50',
            border: 'border-yellow-200',
            icon: 'alert-triangle',
            iconColor: 'text-yellow-500'
        },
        danger: {
            bg: 'bg-red-50',
            border: 'border-red-200',
            icon: 'alert-octagon',
            iconColor: 'text-red-500'
        }
    };
    const classes = severityClasses[alert.severity] || severityClasses.info;

    return (
        <div className={`p-4 rounded-lg border ${classes.bg} ${classes.border} flex items-start gap-3`}>
            <Icon name={classes.icon} className={`h-6 w-6 ${classes.iconColor} flex-shrink-0 mt-0.5`} />
            <div>
                <h4 className="font-semibold text-gray-800 capitalize">{alert.severity}</h4>
                <p className="text-sm text-gray-600">{alert.message}</p>
            </div>
        </div>
    );
};

const PriceChart: React.FC<{ historicalData: PriceDataPoint[], predictedData: PriceDataPoint[] }> = ({ historicalData, predictedData }) => {
    historicalData = Array.isArray(historicalData) ? historicalData : [];
    predictedData = Array.isArray(predictedData) ? predictedData : [];
    const { translate } = useLanguage();
    const allData = [...historicalData, ...predictedData];
    if (allData.length === 0) return null;

    const prices = allData.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1; // Avoid division by zero

    const width = 500;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };

    const getX = (index: number) => padding.left + (index / (allData.length - 1)) * (width - padding.left - padding.right);
    const getY = (price: number) => height - padding.bottom - ((price - minPrice) / priceRange) * (height - padding.top - padding.bottom);

    const historicalPath = historicalData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.price)}`).join(' ');
    
    const lastHistoricalPoint = historicalData[historicalData.length - 1];
    const firstPredictedPoint = predictedData[0];
    const connectingPath = lastHistoricalPoint && firstPredictedPoint 
        ? `M ${getX(historicalData.length - 1)} ${getY(lastHistoricalPoint.price)} L ${getX(historicalData.length)} ${getY(firstPredictedPoint.price)}` 
        : '';

    const predictedPath = predictedData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(historicalData.length + i)} ${getY(d.price)}`).join(' ');

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" aria-labelledby="chart-title" role="img">
            <title id="chart-title">{translate('marketPrices.results.chartTitle')}</title>
            {/* Y-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map(tick => {
                const price = minPrice + tick * priceRange;
                const y = getY(price);
                return (
                    <g key={tick}>
                        <text x={padding.left - 5} y={y + 3} textAnchor="end" className="text-xs fill-current text-gray-500">{price.toFixed(2)}</text>
                        <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="stroke-current text-gray-200" strokeWidth="1" />
                    </g>
                );
            })}

            {/* X-axis labels */}
            {allData.map((d, i) => (
                <text key={i} x={getX(i)} y={height - padding.bottom + 15} textAnchor="middle" className="text-xs fill-current text-gray-500">{d.month.split(' ')[0]}</text>
            ))}

            {/* Historical data path */}
            <path d={historicalPath} stroke="#10B981" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            
            {/* Connecting dashed line */}
            {connectingPath && <path d={connectingPath} stroke="#F59E0B" fill="none" strokeWidth="2" strokeDasharray="4 4" />}
            
            {/* Predicted data path */}
            {predictedPath && <path d={predictedPath} stroke="#F59E0B" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
    );
};


const MarketPrices: React.FC<MarketPricesProps> = () => {
  const { currentUser } = useAuth();
  const { translate, language } = useLanguage();
  const [crop, setCrop] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  
  const formatDateForInput = (date: Date): string => date.toISOString().split('T')[0];

  const getInitialDates = () => {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    const threeMonthsHence = new Date();
    threeMonthsHence.setMonth(today.getMonth() + 3);
    return {
        start: formatDateForInput(sixMonthsAgo),
        end: formatDateForInput(threeMonthsHence),
    };
  };

  const [startDate, setStartDate] = useState<string>(getInitialDates().start);
  const [endDate, setEndDate] = useState<string>(getInitialDates().end);

  const [prediction, setPrediction] = useState<CropPricePrediction | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeAlert, setActiveAlert] = useState<Omit<Alert, 'id' | 'uid' | 'status' | 'createdAt' | 'relatedView' | 'relatedEntityId'> | null>(null);
  const [isCustomAlertModalOpen, setIsCustomAlertModalOpen] = useState(false);
  const [customAlerts, setCustomAlerts] = useState<CustomAlert[]>([]);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = onCustomAlertsSnapshot(currentUser.uid, (alerts) => {
        setCustomAlerts(alerts.filter(a => a.type === 'market'));
    });
    return () => unsubscribe();
  }, [currentUser]);

  const relevantCustomAlerts = prediction ? customAlerts.filter(
    alert => alert.type === 'market' &&
    alert.crop.toLowerCase() === (prediction.cropName || '').trim().toLowerCase() &&
    alert.location.toLowerCase() === (prediction.location || '').trim().toLowerCase()
  ) : [];

  const getPrediction = useCallback(async () => {
    if (!crop.trim() || !location.trim()) {
      setError('Please enter a crop and location.');
      return;
    }
    setLoading(true);
    setError(null);
    setPrediction(null);
    setActiveAlert(null);
    setAlertMessage(null);
    try {
      const data = await fetchMarketPricePrediction(crop, location, startDate, endDate, language);
      setPrediction(data);
       // Automatic AI alert analysis
       if (currentUser) {
          try {
              const alertData = await analyzeMarketPredictionForAlerts(data, language);
              if (alertData) {
                  setActiveAlert(alertData);
                  const entityId = `${(data.cropName || crop).trim()}_${(data.location || location).trim()}`.toLowerCase();
                  await createAlert(currentUser.uid, alertData, 'Market Prices' as ActiveView, entityId);
              }
          } catch (aiAlertError) {
              console.error("Failed to run automatic AI market alert analysis:", aiAlertError);
          }
       }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  }, [crop, location, startDate, endDate, currentUser]);

  const handleCustomAlertModalClose = (success: boolean) => {
    setIsCustomAlertModalOpen(false);
    if(success) {
        setAlertMessage(translate('marketPrices.alert.success'));
    }
  };


  const handleLocationDetect = () => {
    if (navigator.geolocation) {
      setLoading(true);
      setError(null);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
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
  
  const TrendIndicator: React.FC<{ trend: 'up' | 'down' | 'stable' }> = ({ trend }) => {
    const { translate } = useLanguage();
    const trendInfo = {
        up: { icon: '▲', color: 'text-green-500', text: translate('marketPrices.results.trendingUp') },
        down: { icon: '▼', color: 'text-red-500', text: translate('marketPrices.results.trendingDown') },
        stable: { icon: '▬', color: 'text-gray-500', text: translate('marketPrices.results.stable') },
    };
    const { icon, color, text } = trendInfo[trend] || trendInfo.stable;
    return <span className={`font-semibold ${color}`}>{icon} {text}</span>;
  };
  
  const HistoricalAnalysis: React.FC<{ data: PriceDataPoint[] }> = ({ data }) => {
    if (!data || data.length === 0) return null;

    const prices = data.map(d => d.price).filter((p): p is number => typeof p === 'number' && !isNaN(p));
    if (prices.length === 0) return null;

    const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const highestPrice = Math.max(...prices);
    const lowestPrice = Math.min(...prices);
    
    const mean = averagePrice;
    const variance = prices.map(p => (p - mean) ** 2).reduce((sum, sq) => sum + sq, 0) / prices.length;
    const volatility = Math.sqrt(variance);

    return (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="text-md font-semibold text-gray-800 mb-3">{translate('marketPrices.results.historicalAnalysis')}</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                    <p className="text-sm text-gray-500">{translate('marketPrices.results.avgPrice')}</p>
                    <p className="text-lg font-bold text-gray-800">{averagePrice.toFixed(2)}</p>
                </div>
                <div>
                    <p className="text-sm text-gray-500">{translate('marketPrices.results.highPrice')}</p>
                    <p className="text-lg font-bold text-green-600">{highestPrice.toFixed(2)}</p>
                </div>
                <div>
                    <p className="text-sm text-gray-500">{translate('marketPrices.results.lowPrice')}</p>
                    <p className="text-lg font-bold text-red-600">{lowestPrice.toFixed(2)}</p>
                </div>
                <div>
                    <p className="text-sm text-gray-500">{translate('marketPrices.results.volatility')}</p>
                    <p className="text-lg font-bold text-gray-800">{volatility.toFixed(2)}</p>
                </div>
            </div>
        </div>
    );
  };

  return (
    <Card>
      {prediction && <SetMarketAlertDialog isOpen={isCustomAlertModalOpen} onClose={handleCustomAlertModalClose} crop={prediction.cropName} location={prediction.location} priceUnit={prediction.priceUnit} />}
      <div className="flex items-center mb-6">
          <Icon name="chart-bar" className="h-8 w-8 text-indigo-500 mr-3"/>
          <h2 className="text-2xl font-bold text-gray-700">{translate('marketPrices.title')}</h2>
      </div>
      <p className="text-gray-600 mb-6">{translate('marketPrices.description')}</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label htmlFor="crop" className="block text-sm font-medium text-gray-700 mb-1">{translate('marketPrices.crop')}</label>
          <input 
            type="text" 
            name="crop" 
            id="crop" 
            value={crop} 
            onChange={(e) => setCrop(e.target.value)} 
            placeholder={translate('marketPrices.cropPlaceholder')}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500" 
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">{translate('marketPrices.location')}</label>
          <div className="relative">
            <input 
              type="text" 
              name="location" 
              id="location" 
              value={location} 
              onChange={(e) => setLocation(e.target.value)} 
              placeholder={translate('marketPrices.locationPlaceholder')}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500 pr-10" 
              disabled={loading}
            />
            <button 
              onClick={handleLocationDetect} 
              disabled={loading} 
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-green-600 transition-colors disabled:opacity-50" 
              aria-label="Use current location"
            >
              <Icon name="location" className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">{translate('marketPrices.startDate')}</label>
            <input 
                type="date" 
                name="startDate" 
                id="startDate" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500" 
                disabled={loading}
            />
        </div>
        <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">{translate('marketPrices.endDate')}</label>
            <input 
                type="date" 
                name="endDate" 
                id="endDate" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500" 
                disabled={loading}
            />
        </div>
      </div>
      
      <div className="text-center mb-6">
        <Button onClick={getPrediction} disabled={loading || !crop.trim() || !location.trim()} className="w-full sm:w-auto">
            {loading ? <Spinner /> : translate('marketPrices.predict')}
        </Button>
      </div>
      
      {error && <p className="text-red-500 text-center mb-4">{error}</p>}
      {alertMessage && <p className="text-blue-600 bg-blue-100 p-3 rounded-lg text-center border border-blue-200 mb-4">{alertMessage}</p>}
      {activeAlert && <div className="mb-4 animate-fade-in"><AlertDisplay alert={activeAlert} /></div>}
      
      {prediction && (
        <div className="animate-fade-in space-y-6">
          <h3 className="text-xl font-semibold text-gray-700">{translate('marketPrices.results.title', { cropName: prediction.cropName, location: prediction.location })}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-800">{translate('marketPrices.results.current')}</h4>
                <p className="text-3xl font-bold text-blue-900">{(prediction.currentPrice || 0).toFixed(2)}</p>
                <p className="text-xs text-gray-500">{prediction.priceUnit}</p>
            </div>
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="text-sm font-medium text-yellow-800">{translate('marketPrices.results.predicted')}</h4>
                <p className="text-3xl font-bold text-yellow-900">{(prediction.predictedPriceNextMonth || 0).toFixed(2)}</p>
                <p className="text-xs text-gray-500">{prediction.priceUnit}</p>
            </div>
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-col justify-center">
                <h4 className="text-sm font-medium text-gray-800">{translate('marketPrices.results.trend')}</h4>
                <p className="text-xl"><TrendIndicator trend={prediction.trend} /></p>
            </div>
          </div>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex justify-between items-center">
                <h4 className="text-md font-semibold text-gray-800">{translate('marketPrices.results.analysis')}</h4>
                <Button onClick={() => setIsCustomAlertModalOpen(true)} disabled={loading} variant="secondary" className="!py-1 !px-3 !text-xs">
                    {translate('marketPrices.results.setAlert')}
                </Button>
            </div>
            <p className="text-sm text-gray-600 mt-1">{prediction.analysis}</p>
          </div>
          
           {relevantCustomAlerts.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg border">
                    <h4 className="font-semibold text-gray-700 mb-2">{translate('marketPrices.results.activeAlerts')}</h4>
                    <ul className="space-y-1 text-sm text-gray-600">
                        {relevantCustomAlerts.map(alert => alert.type === 'market' && (
                            <li key={alert.id}>• {translate('marketPrices.results.notifyWhen', { operator: translate(`marketPrices.results.${alert.operator === 'lte' ? 'below' : 'above'}`), value: alert.value })}</li>
                        ))}
                    </ul>
                </div>
            )}

          <HistoricalAnalysis data={prediction.historicalData} />

          <div>
            <h4 className="text-md font-semibold text-gray-800 mb-2">{translate('marketPrices.results.chartTitle')}</h4>
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
                <PriceChart historicalData={prediction.historicalData} predictedData={prediction.predictedData} />
                <div className="flex justify-center gap-6 text-sm mt-2">
                    <div className="flex items-center"><span className="h-3 w-3 rounded-sm bg-emerald-500 mr-2"></span>{translate('marketPrices.results.historical')}</div>
                    <div className="flex items-center"><span className="h-3 w-3 rounded-sm bg-amber-500 mr-2"></span>{translate('marketPrices.results.predictedBar')}</div>
                </div>
            </div>
          </div>
          {prediction.sources && prediction.sources.length > 0 && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-md font-semibold text-gray-800">{translate('marketPrices.results.sources')}</h4>
                <p className="text-xs text-gray-500 mb-2">{translate('marketPrices.results.sourcesDesc')}</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                    {prediction.sources.map((source, index) => (
                        <li key={index}>
                            <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" title={source.uri}>
                                {source.title || new URL(source.uri).hostname}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default MarketPrices;
