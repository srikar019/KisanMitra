import React, { useState, useCallback, useEffect } from 'react';
import { getPlantingRecommendations } from '../services/geminiService';
import { SoilType, CropType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import type { PlantingRecommendationResponse, PlantingRequest } from '../types';
import Card from './common/Card';
import Button from './common/Button';
import Spinner from './common/Spinner';
import Icon from './common/Icon';
import SafeHTML from './common/SafeHTML';

interface PlantingRecommendationsProps {
}

const PlantingRecommendations: React.FC<PlantingRecommendationsProps> = () => {
  const { translate, language } = useLanguage();
  const [location, setLocation] = useState<string>('');
  const [previousCrop, setPreviousCrop] = useState<string>('');
  const [soilType, setSoilType] = useState<SoilType>(SoilType.Loam);
  const [cropType, setCropType] = useState<CropType>(CropType.Fruit);
  const [recommendationResponse, setRecommendationResponse] = useState<PlantingRecommendationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const getRecommendations = useCallback(async () => {
    if (!location.trim()) {
      setError(translate('planting.error.location'));
      return;
    }
    setLoading(true);
    setError(null);
    setRecommendationResponse(null);
    try {
      const request: PlantingRequest = {
        location,
        soilType,
        cropType,
        previousCrop,
      };
      const data = await getPlantingRecommendations(request, language);
      setRecommendationResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  }, [location, soilType, cropType, previousCrop, translate]);

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


  return (
    <Card>
      <div className="flex items-center mb-6">
          <Icon name="light-bulb" className="h-8 w-8 text-purple-500 mr-3"/>
          <h2 className="text-2xl font-bold text-gray-700">{translate('planting.title')}</h2>
      </div>
      <p className="text-gray-600 mb-6">
        {translate('planting.description')}
        {recommendationResponse && !loading && (
          <SafeHTML as="span" className="block text-sm mt-1 text-green-700" html={translate('planting.season', { location: location, season: recommendationResponse.season })} />
        )}
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">{translate('planting.form.location')}</label>
          <div className="relative">
            <input 
              type="text" 
              name="location" 
              id="location" 
              value={location} 
              onChange={(e) => setLocation(e.target.value)} 
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
          <label htmlFor="previousCrop" className="block text-sm font-medium text-gray-700 mb-1">{translate('planting.form.previousCrop')}</label>
          <input 
            type="text" 
            name="previousCrop" 
            id="previousCrop" 
            value={previousCrop} 
            onChange={(e) => setPreviousCrop(e.target.value)} 
            placeholder={translate('planting.form.previousCrop.placeholder')} 
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500" 
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="soilType" className="block text-sm font-medium text-gray-700 mb-1">{translate('planting.form.soilType')}</label>
          <select name="soilType" id="soilType" value={soilType} onChange={(e) => setSoilType(e.target.value as SoilType)} className="w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500" disabled={loading}>
            {Object.values(SoilType).map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cropType" className="block text-sm font-medium text-gray-700 mb-1">{translate('planting.form.cropType')}</label>
          <select name="cropType" id="cropType" value={cropType} onChange={(e) => setCropType(e.target.value as CropType)} className="w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500" disabled={loading}>
            {Object.values(CropType).map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
      </div>
      
      <div className="text-center mb-6">
        <Button onClick={getRecommendations} disabled={loading || !location.trim()} className="w-full sm:w-auto">
            {loading ? <Spinner /> : translate('planting.button.get')}
        </Button>
      </div>
      
      {error && <p className="text-red-500 text-center">{error}</p>}
      
      {recommendationResponse && (
        <div className="animate-fade-in space-y-4">
          <h3 className="text-xl font-semibold text-gray-700">{translate('planting.results.title')}</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {recommendationResponse.recommendations?.map((rec, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col sm:flex-row items-start gap-4">
                {rec.imageUrl ? (
                  <img src={rec.imageUrl || undefined} alt={rec.cropName} className="w-full sm:w-28 sm:h-28 h-40 object-cover rounded-md flex-shrink-0" />
                ) : (
                  <div className="w-full sm:w-28 sm:h-28 h-40 bg-gray-200 rounded-md flex items-center justify-center text-gray-500 flex-shrink-0">
                    <Icon name="leaf" className="h-10 w-10" />
                  </div>
                )}
                <div className="flex-grow">
                  <h4 className="font-bold text-lg text-green-800">{rec.cropName}</h4>
                  <p className="text-sm text-gray-600 mt-2"><span className="font-semibold text-gray-700">{translate('planting.results.reason')}</span> {rec.reason}</p>
                  <p className="text-sm text-gray-600 mt-2"><span className="font-semibold text-gray-700">{translate('planting.results.time')}</span> {rec.plantingTime}</p>
                  <p className="text-sm text-gray-600 mt-2"><span className="font-semibold text-gray-700">{translate('planting.results.harvest', { daysToHarvest: rec.daysToHarvest })}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export default PlantingRecommendations;
