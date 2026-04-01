import React, { useState, useCallback, useEffect } from 'react';
import { getCropYieldPrediction } from '../services/geminiService';
import { SoilType } from '../types';
import type { CropYieldRequest, CropYieldResponse } from '../types';
import Card from './common/Card';
import Button from './common/Button';
import Spinner from './common/Spinner';
import Icon from './common/Icon';
import { useLanguage } from '../contexts/LanguageContext';

const YieldChart: React.FC<{ response: CropYieldResponse }> = ({ response }) => {
    const { translate } = useLanguage();
    const { historicalYieldData, predictedYield, yieldUnit } = response;

    const parsePredictedYield = (yieldStr: string): number => {
        // Ensure input is a string before matching to prevent errors
        const numbers = String(yieldStr).match(/\d+(\.\d+)?/g);
        if (!numbers) return 0;
        const numericValues = numbers.map(parseFloat);
        // Average the numbers found (e.g., from a range like "150-160")
        return numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
    };
    
    const predictedValue = parsePredictedYield(predictedYield);

    // Robustness: Filter out any invalid historical data points from the AI
    const validHistoricalData = (historicalYieldData || []).filter(
        d => typeof d.year === 'number' && typeof d.yield === 'number' && !isNaN(d.yield)
    );

    const allData = [
        ...validHistoricalData,
        { year: new Date().getFullYear(), yield: predictedValue }
    ];
    
    // Final check for any valid data to plot
    const validYields = allData.map(d => d.yield).filter(y => !isNaN(y));
    if (validYields.length === 0) return null;
    
    const maxYield = Math.max(...validYields, 0); // Use 0 as a floor

    return (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="text-md font-semibold text-gray-800 mb-4">{translate('cropYield.results.vs')}</h4>
            <div className="flex justify-between items-end h-64 space-x-2">
                {allData.map((data, index) => {
                    const isPrediction = index === allData.length - 1;
                    const barHeight = maxYield > 0 ? (data.yield / maxYield) * 100 : 0;
                    return (
                        <div key={data.year} className="flex-1 flex flex-col justify-end items-center h-full" title={`${data.yield.toFixed(1)} ${yieldUnit}`}>
                            <p className="text-sm font-semibold mb-1">{data.yield.toFixed(1)}</p>
                            <div className="w-full flex-1 flex flex-col justify-end relative">
                                <div
                                    style={{ height: `${barHeight}%` }}
                                    className={`w-full rounded-t-md transition-all duration-500 absolute bottom-0 ${isPrediction ? 'bg-teal-500' : 'bg-green-500'}`}
                                ></div>
                            </div>
                            <p className="text-xs text-gray-600 mt-2 font-medium">{isPrediction ? translate('cropYield.results.predictedBar') : data.year}</p>
                        </div>
                    );
                })}
            </div>
             <div className="flex justify-center gap-6 text-sm mt-4">
                <div className="flex items-center"><span className="h-3 w-3 rounded-sm bg-green-500 mr-2"></span>{translate('cropYield.results.historical')}</div>
                <div className="flex items-center"><span className="h-3 w-3 rounded-sm bg-teal-500 mr-2"></span>{translate('cropYield.results.predictedBar')}</div>
            </div>
        </div>
    );
};

interface CropYieldPredictionProps {
}

const CropYieldPrediction: React.FC<CropYieldPredictionProps> = () => {
  const { translate, language } = useLanguage();
  const [request, setRequest] = useState<CropYieldRequest>({
    crop: 'Corn',
    location: '',
    area: 100,
    areaUnit: 'acres',
    soilType: SoilType.Loam,
  });
  const [prediction, setPrediction] = useState<CropYieldResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setRequest(prev => ({ ...prev, [name]: name === 'area' ? parseFloat(value) : value }));
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
    if (!request.location.trim() || !request.crop.trim() || request.area <= 0) {
      setError('Please fill in all required fields: Crop, Location, and a valid Area.');
      return;
    }
    setLoading(true);
    setError(null);
    setPrediction(null);
    try {
      const data = await getCropYieldPrediction(request, language);
      setPrediction(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  }, [request]);

  return (
    <Card>
      <div className="flex items-center mb-6">
          <Icon name="trending-up" className="h-8 w-8 text-teal-500 mr-3"/>
          <h2 className="text-2xl font-bold text-gray-700">{translate('cropYield.title')}</h2>
      </div>
      <p className="text-gray-600 mb-6">{translate('cropYield.description')}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border">
         <div>
          <label htmlFor="crop" className="block text-sm font-medium text-gray-700 mb-1">{translate('cropYield.crop')}</label>
          <input 
            type="text" 
            name="crop" 
            id="crop" 
            value={request.crop} 
            onChange={handleRequestChange} 
            placeholder="e.g., Wheat" 
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500" 
            disabled={loading}
          />
        </div>
        <div className="lg:col-span-2">
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">{translate('cropYield.location')}</label>
          <div className="relative">
            <input 
              type="text" 
              name="location" 
              id="location" 
              value={request.location} 
              onChange={handleRequestChange} 
              placeholder={translate('planting.form.location.placeholder')}
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
          <label htmlFor="area" className="block text-sm font-medium text-gray-700 mb-1">{translate('cropYield.area')}</label>
          <input 
            type="number" 
            name="area" 
            id="area" 
            value={request.area} 
            onChange={handleRequestChange} 
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500" 
            disabled={loading}
            min="0"
          />
        </div>
        <div>
          <label htmlFor="areaUnit" className="block text-sm font-medium text-gray-700 mb-1">{translate('cropYield.areaUnit')}</label>
          <select name="areaUnit" id="areaUnit" value={request.areaUnit} onChange={handleRequestChange} className="w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500" disabled={loading}>
            <option value="acres">{translate('cropYield.acres')}</option>
            <option value="hectares">{translate('cropYield.hectares')}</option>
          </select>
        </div>
        <div>
          <label htmlFor="soilType" className="block text-sm font-medium text-gray-700 mb-1">{translate('cropYield.soilType')}</label>
          <select name="soilType" id="soilType" value={request.soilType} onChange={handleRequestChange} className="w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500" disabled={loading}>
            {Object.values(SoilType).map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
      </div>
      
      <div className="text-center mb-6">
        <Button onClick={getPrediction} disabled={loading} className="w-full sm:w-auto">
            {loading ? <Spinner /> : translate('cropYield.predict')}
        </Button>
      </div>
      
      {error && <p className="text-red-500 text-center">{error}</p>}
      
      {prediction && (
        <div className="animate-fade-in space-y-6">
            <div className="p-6 bg-teal-50 border border-teal-200 rounded-lg text-center">
                <h3 className="text-lg font-medium text-teal-800">{translate('cropYield.results.predicted')}</h3>
                <p className="text-4xl font-bold text-teal-900 my-2">{prediction.predictedYield}</p>
            </div>

            {prediction.historicalYieldData && <YieldChart response={prediction} />}

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-md font-semibold text-gray-800">{translate('cropYield.results.analysis')}</h4>
                <p className="text-sm text-gray-600 mt-1">{prediction.analysis}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="text-md font-semibold text-green-800 mb-2">{translate('cropYield.results.positive')}</h4>
                    <ul className="list-disc list-inside text-sm text-green-700 space-y-1">
                        {prediction.influencingFactors?.positive?.map((factor, i) => <li key={i}>{factor}</li>) || <li>No specific positive factors identified.</li>}
                    </ul>
                </div>
                 <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h4 className="text-md font-semibold text-red-800 mb-2">{translate('cropYield.results.negative')}</h4>
                    <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                        {prediction.influencingFactors?.negative?.map((factor, i) => <li key={i}>{factor}</li>) || <li>No specific negative factors identified.</li>}
                    </ul>
                </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-md font-semibold text-blue-800 mb-2">{translate('cropYield.results.recommendations')}</h4>
                <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                    {prediction.recommendations?.map((rec, i) => <li key={i}>{rec}</li>) || <li>No specific recommendations provided.</li>}
                </ul>
            </div>
        </div>
      )}
    </Card>
  );
};

export default CropYieldPrediction;
