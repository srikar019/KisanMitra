import React, { useState, useCallback, useEffect, useRef } from 'react';
import { getWeatherForecast, getCoordinatesForLocation, getMicroclimateAnalysis, analyzeWeatherForAlerts } from '../services/geminiService';
import { createAlert } from '../services/alertService';
import { onCustomAlertsSnapshot, deleteCustomAlert } from '../services/customAlertService';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { WeatherData, MicroclimateAnalysis, Alert, ActiveView, CustomAlert } from '../types';
import Card from './common/Card';
import Icon from './common/Icon';
import Button from './common/Button';
import Spinner from './common/Spinner';
import SetWeatherAlertDialog from './modals/SetWeatherAlertDialog';

declare const L: any;

interface WeatherProps {
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


const Weather: React.FC<WeatherProps> = () => {
  const { currentUser } = useAuth();
  const { translate } = useLanguage();
  const [location, setLocation] = useState<string>('');
  const [displayLocation, setDisplayLocation] = useState<string>('');
  const [coordinates, setCoordinates] = useState<{lat: number, lng: number} | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [weatherClass, setWeatherClass] = useState<string>('sunny');
  const [activeAlert, setActiveAlert] = useState<Omit<Alert, 'id' | 'uid' | 'status' | 'createdAt' | 'relatedView' | 'relatedEntityId'> | null>(null);
  const [isCustomAlertModalOpen, setIsCustomAlertModalOpen] = useState(false);
  const [customAlerts, setCustomAlerts] = useState<CustomAlert[]>([]);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);


  const [microclimateData, setMicroclimateData] = useState<MicroclimateAnalysis | null>(null);
  const [microclimateLoading, setMicroclimateLoading] = useState<boolean>(false);
  const [microclimateError, setMicroclimateError] = useState<string | null>(null);
  
  const [animatedIconIndex, setAnimatedIconIndex] = useState(0);
  const animatedIcons = ['sun', 'cloud', 'cloud-rain'];

  const leafletMapRef = useRef<any | null>(null);
  const leafletMarkersRef = useRef<any[]>([]);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const fetchWeather = useCallback(async (loc: string) => {
    if (!loc.trim()) {
      setError(translate('weather.error.location'));
      return;
    }
    setLoading(true);
    setError(null);
    setActiveAlert(null);
    setMicroclimateData(null); // Reset microclimate data on new forecast
    setMicroclimateError(null);
    setAlertMessage(null);
    setIsSuggestionsOpen(false);
    try {
      const data = await getWeatherForecast(loc);
      setWeatherData(data);
      setDisplayLocation(loc);
      
      const latLngRegex = /^-?([1-8]?[1-9]|[1-9]0)\.{1}\d{1,6},\s*-?([1-8]?[1-9]|[1-9]0|[1]?[0-7]?[0-9])\.{1}\d{1,6}$/;
      if (latLngRegex.test(loc.replace(/\s/g, ''))) {
          const [lat, lng] = loc.split(',').map(Number);
          setCoordinates({ lat, lng });
      } else {
          const { lat, lng } = await getCoordinatesForLocation(loc);
          setCoordinates({ lat, lng });
      }
      
      if (currentUser) {
          try {
              const alertData = await analyzeWeatherForAlerts(data);
              if (alertData) {
                  setActiveAlert(alertData);
                  await createAlert(currentUser.uid, alertData, 'Weather' as ActiveView, loc.trim().toLowerCase());
              }
          } catch (aiAlertError) {
              console.error("Failed to run automatic AI alert analysis:", aiAlertError);
          }
      }


    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  }, [currentUser, translate]);

  useEffect(() => {
    // Cleanup function to run when the component unmounts
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);
  
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
                setIsSuggestionsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = onCustomAlertsSnapshot(currentUser.uid, (alerts) => {
        setCustomAlerts(alerts.filter(a => a.type === 'weather'));
    });
    return () => unsubscribe();
  }, [currentUser]);

  const relevantCustomAlerts = customAlerts.filter(
    alert => alert.type === 'weather' && alert.location.toLowerCase() === displayLocation.trim().toLowerCase()
  );


  const getWeatherClassForData = useCallback((data: WeatherData): string => {
    const condition = data.currentWeather.condition.toLowerCase();
    const season = data.seasonalContext.toLowerCase();

    if (condition.includes('snow') || condition.includes('sleet') || condition.includes('ice') || condition.includes('blizzard')) return 'snow';
    if (condition.includes('thunder') || condition.includes('storm')) return 'thunder';
    if (season.includes('monsoon')) return 'monsoon';
    if (condition.includes('rain') || condition.includes('drizzle') || condition.includes('shower')) return 'rain';
    if (condition.includes('fog') || condition.includes('mist') || condition.includes('haze')) return 'fog';
    if (condition.includes('wind') || condition.includes('squalls')) return 'wind';
    if (season.includes('autumn') || season.includes('fall')) return 'autumn';
    if (season.includes('spring')) return 'spring';
    if (season.includes('summer')) return 'sunny';
    if (condition.includes('sun') || condition.includes('clear')) return 'sunny';
    if (condition.includes('cloud') || condition.includes('overcast')) return 'cloudy';
    return 'sunny';
  }, []);

  const updateMarkers = useCallback(() => {
    if (!coordinates || !leafletMapRef.current) return;

    leafletMarkersRef.current.forEach(marker => marker.removeFrom(leafletMapRef.current));
    leafletMarkersRef.current = [];
    const newLeafletMarkers: any[] = [];

    const mainMarker = L.marker([coordinates.lat, coordinates.lng]);
    const popupContent = weatherData ? `<b>${displayLocation}</b><br>Temp: ${weatherData.currentWeather.temperature}°C` : `<b>${displayLocation}</b>`;
    mainMarker.bindPopup(popupContent).openPopup();
    newLeafletMarkers.push(mainMarker);

    microclimateData?.zones.forEach(zone => {
        const zoneIcon = L.divIcon({ html: `<div class="p-1 bg-white/80 rounded-full shadow-lg text-center"><b class="text-blue-700">${zone.temperatureDelta}</b></div>`, className: 'map-zone-icon', iconSize: [40, 40], iconAnchor: [20, 20] });
        const zoneMarker = L.marker([zone.coordinates.lat, zone.coordinates.lng], { icon: zoneIcon }).bindPopup(`<b>${zone.zoneName}</b><br>Risk: ${zone.risk}`);
        newLeafletMarkers.push(zoneMarker);
    });

    newLeafletMarkers.forEach(m => m.addTo(leafletMapRef.current));
    leafletMarkersRef.current = newLeafletMarkers;
    if (newLeafletMarkers.length > 1) {
        leafletMapRef.current.fitBounds(L.featureGroup(newLeafletMarkers).getBounds().pad(0.2));
    } else {
        leafletMapRef.current.setView([coordinates.lat, coordinates.lng], 10);
    }
}, [coordinates, weatherData, displayLocation, microclimateData]);

useEffect(() => {
    // Initialize map
    if (coordinates && mapContainerRef.current && !leafletMapRef.current) {
        const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' });
        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '&copy; Esri' });
        
        leafletMapRef.current = L.map(mapContainerRef.current, { 
            center: [coordinates.lat, coordinates.lng], 
            zoom: 10, 
            layers: [streetLayer] 
        });
        L.control.layers({ "Street": streetLayer, "Satellite": satelliteLayer }).addTo(leafletMapRef.current);
    }
    
    // Update markers whenever dependencies change
    if (leafletMapRef.current) {
        leafletMapRef.current.invalidateSize();
        updateMarkers();
    }
}, [coordinates, updateMarkers]);

  
  useEffect(() => {
    if (weatherData) {
        const newClass = getWeatherClassForData(weatherData);
        setWeatherClass(newClass);
    } else {
        setWeatherClass('sunny');
    }
  }, [weatherData, getWeatherClassForData]);
  
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (loading) {
      interval = setInterval(() => {
        setAnimatedIconIndex(prevIndex => (prevIndex + 1) % animatedIcons.length);
      }, 700);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading, animatedIcons.length]);

  const fetchSuggestions = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      setIsSuggestionsOpen(false);
      return;
    }
    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
      if (!response.ok) {
        console.error("Failed to fetch suggestions");
        return;
      }
      const data = await response.json();
      if (data.results) {
        const formattedSuggestions = data.results.map((res: any) => {
          let locationParts = [res.name, res.admin1, res.country].filter(Boolean);
          return [...new Set(locationParts)].join(', ');
        });
        setSuggestions(formattedSuggestions);
        setIsSuggestionsOpen(formattedSuggestions.length > 0);
      } else {
        setSuggestions([]);
        setIsSuggestionsOpen(false);
      }
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      setSuggestions([]);
      setIsSuggestionsOpen(false);
    }
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLocation = e.target.value;
    setLocation(newLocation);

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      fetchSuggestions(newLocation);
    }, 300);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setLocation(suggestion);
    setSuggestions([]);
    setIsSuggestionsOpen(false);
    fetchWeather(suggestion);
  };


  const handleGetForecastClick = () => fetchWeather(location);

  const handleLocationDetect = () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const locationString = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          setLocation(locationString);
          fetchWeather(locationString);
        },
        (geoError) => {
          setError(translate('weather.error.geoError', { message: geoError.message }));
          setLoading(false);
        }
      );
    } else {
      setError(translate('weather.error.geo'));
    }
  };
  
  const handleAnalyzeMicroclimate = async () => {
    if (!weatherData || !coordinates) {
      setMicroclimateError("Please get a general weather forecast first.");
      return;
    }
    setMicroclimateLoading(true);
    setMicroclimateError(null);
    setMicroclimateData(null);
    try {
      const data = await getMicroclimateAnalysis(coordinates, weatherData);
      setMicroclimateData(data);
    } catch (err) {
      setMicroclimateError(err instanceof Error ? err.message : 'An unknown error occurred during analysis.');
    } finally {
      setMicroclimateLoading(false);
    }
  };

  const handleCustomAlertModalClose = (success: boolean) => {
    setIsCustomAlertModalOpen(false);
    if(success) {
        setAlertMessage(translate('weather.alert.success'));
    }
  };

  const getWeatherIcon = (condition: string) => {
    const lowerCondition = condition.toLowerCase();
    if (lowerCondition.includes('sun') || lowerCondition.includes('clear')) return 'sun';
    if (lowerCondition.includes('cloud')) return 'cloud';
    if (lowerCondition.includes('rain')) return 'cloud-rain';
    if (lowerCondition.includes('storm')) return 'cloud-lightning';
    if (lowerCondition.includes('snow')) return 'cloud-snow';
    return 'cloud';
  };

  return (
    <Card className="!max-w-7xl relative">
      {displayLocation && <SetWeatherAlertDialog isOpen={isCustomAlertModalOpen} onClose={handleCustomAlertModalClose} location={displayLocation} />}

      <div className="flex items-center mb-6">
          <Icon name="sun" className="h-8 w-8 text-blue-500 mr-3"/>
          <h2 className="text-2xl font-bold text-gray-700">{translate('weather.title')}</h2>
      </div>
      <p className="text-gray-600 mb-6">{translate('weather.description')}</p>
      
      <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl mb-6 shadow-md border border-gray-200/80">
        <div className="flex flex-col md:flex-row items-stretch w-full gap-2">
            <div className="relative w-full" ref={suggestionsRef}>
                <div className="flex items-center w-full border border-gray-300 rounded-lg shadow-sm bg-white focus-within:ring-2 focus-within:ring-green-500 focus-within:border-green-500 transition-all overflow-hidden h-full">
                    <div className="pl-3 text-gray-400 pointer-events-none shrink-0">
                        <Icon name="search" className="h-5 w-5" />
                    </div>
                    <input
                        type="text"
                        value={location}
                        onChange={handleLocationChange}
                        placeholder={translate('weather.placeholder')}
                        className="w-full p-3 border-0 bg-transparent focus:ring-0 focus:outline-none text-gray-800 placeholder-gray-500 min-w-0"
                        disabled={loading}
                        onKeyDown={(e) => e.key === 'Enter' && handleGetForecastClick()}
                    />
                    <button 
                        onClick={handleLocationDetect} 
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-green-700 bg-gray-50 hover:bg-gray-100 border-l border-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap h-full"
                        aria-label={translate('weather.myLocation')}
                    >
                        <Icon name="location" className="h-5 w-5"/>
                        <span className="hidden sm:inline">{translate('weather.myLocation')}</span>
                    </button>
                </div>
                {isSuggestionsOpen && (
                    <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-300 rounded-b-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                        <ul>
                            {suggestions.map((suggestion, index) => (
                                <li
                                    key={index}
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 cursor-pointer"
                                >
                                    {suggestion}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <button
                onClick={handleGetForecastClick}
                disabled={loading}
                className={`forecast-btn ${weatherClass} w-full md:w-auto flex-shrink-0`}
            >
                {loading ? (
                <div className="flex items-center justify-center">
                    <div className="relative h-5 w-5 mr-3 animate-pulse-icon flex items-center justify-center">
                        {animatedIcons.map((iconName, index) => (
                            <Icon
                                key={iconName}
                                name={iconName}
                                className={`h-5 w-5 text-white absolute transition-opacity duration-500 ${
                                    animatedIconIndex === index ? 'opacity-100' : 'opacity-0'
                                }`}
                            />
                        ))}
                    </div>
                    {translate('weather.forecasting')}
                </div>
                ) : translate('weather.getForecast')}
            </button>
        </div>
      </div>

      {error && <p className="text-red-600 bg-red-100 p-3 rounded-lg text-center border border-red-200 mb-4">{error}</p>}
      {alertMessage && <p className="text-blue-600 bg-blue-100 p-3 rounded-lg text-center border border-blue-200 mb-4">{alertMessage}</p>}
      {activeAlert && <div className="mb-4 animate-fade-in"><AlertDisplay alert={activeAlert} /></div>}
      
      <div className="mt-8">
        <div>
          {loading && !weatherData && (
            <div className="h-full flex flex-col items-center justify-center bg-gray-50/70 rounded-lg p-8 text-center border">
                <div className="w-12 h-12 border-4 border-green-500 border-dashed rounded-full animate-spin"></div>
                <p className="text-gray-500 mt-4">{translate('weather.forecasting')}</p>
            </div>
          )}
          {!loading && !weatherData && !error && (
             <div className="h-full flex flex-col items-center justify-center bg-gray-50/70 rounded-lg p-8 text-center border">
                <Icon name="sun" className="h-12 w-12 text-gray-400 mb-4"/>
                <h3 className="text-xl font-bold text-gray-700">{translate('weather.welcome.title')}</h3>
                <p className="text-gray-500 mt-2">{translate('weather.welcome.subtitle')}</p>
            </div>
          )}
          {weatherData && (
            <div className="space-y-6 animate-fade-in">
              <div className="p-6 rounded-lg border bg-white/70 border-gray-200">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">{translate('weather.currentConditions', { location: displayLocation })}</h3>
                {weatherData.seasonalContext && (
                    <p className="text-sm text-gray-600 italic mb-4">{weatherData.seasonalContext}</p>
                )}
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center">
                        <Icon name={getWeatherIcon(weatherData.currentWeather.condition)} className="h-16 w-16 text-blue-500 mr-4"/>
                        <div>
                            <p className="text-4xl font-bold text-gray-900">{weatherData.currentWeather.temperature}°C</p>
                            <p className="text-lg text-gray-600">{weatherData.currentWeather.condition}</p>
                        </div>
                    </div>
                    <div className="text-right text-gray-600">
                        <p>{translate('weather.humidity')}: {weatherData.currentWeather.humidity}%</p>
                        <p>{translate('weather.wind')}: {weatherData.currentWeather.windSpeed} km/h</p>
                    </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4">{translate('weather.forecast5day')}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  {weatherData.dailyForecast?.map((day, index) => (
                    <div key={index} className="bg-white/70 p-4 rounded-lg text-center border border-gray-200">
                      <p className="font-bold text-gray-800">{day.day}</p>
                      <Icon name={getWeatherIcon(day.condition)} className="h-10 w-10 text-blue-500/90 mx-auto my-2"/>
                      <p className="text-sm text-gray-500">{day.condition}</p>
                      <div className="mt-2">
                        <span className="font-semibold text-gray-800">{day.high}°</span>
                        <span className="text-gray-500"> / {day.low}°</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
               {relevantCustomAlerts.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg border">
                    <h4 className="font-semibold text-gray-700 mb-2">{translate('weather.activeAlerts')}</h4>
                    <ul className="space-y-1 text-sm text-gray-600">
                        {relevantCustomAlerts.map(alert => alert.type === 'weather' && (
                            <li key={alert.id}>• {translate('weather.alert.notifyWhen', {
                                condition: alert.condition,
                                operator: translate(alert.operator === 'lte' ? 'weather.alert.below' : 'weather.alert.above'),
                                value: alert.value
                            })}</li>
                        ))}
                    </ul>
                </div>
              )}

              {coordinates && (
                <div className="mt-8 animate-fade-in-up">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">{translate('weather.map')}</h3>
                    <div id="map" ref={mapContainerRef}></div>
                </div>
              )}

              <div className="text-center pt-4 flex justify-center flex-wrap gap-4">
                  <Button onClick={handleAnalyzeMicroclimate} disabled={!weatherData || loading || microclimateLoading}>
                      {microclimateLoading ? <Spinner /> : translate('weather.analyzeMicroclimate')}
                  </Button>
                  <Button onClick={() => setIsCustomAlertModalOpen(true)} disabled={!weatherData || loading} variant="secondary">
                      {translate('weather.setCustomAlert')}
                  </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {microclimateError && <p className="text-red-600 bg-red-100 p-3 mt-6 rounded-lg text-center border border-red-200">{microclimateError}</p>}
      
      {microclimateLoading && (
        <div className="mt-6 text-center">
          <div className="w-12 h-12 mx-auto border-4 border-blue-500 border-dashed rounded-full animate-spin"></div>
          <p className="text-gray-500 mt-4">{translate('weather.microclimate.analyzing')}</p>
        </div>
      )}
      
      {microclimateData && (
        <div className="mt-8 animate-fade-in">
            <div className="flex items-center mb-4">
                <Icon name="sparkles" className="h-8 w-8 text-blue-500 mr-3"/>
                <h3 className="text-2xl font-bold text-gray-700">{translate('weather.microclimate.title')}</h3>
            </div>
            <p className="text-gray-600 mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                <strong>{translate('weather.microclimate.topography')}</strong> {microclimateData.inferredTopography}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {microclimateData.zones?.map((zone, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-start">
                             <h4 className="font-bold text-lg text-blue-800">{zone.zoneName}</h4>
                             <span className="font-bold text-xl text-blue-700 bg-blue-100 px-3 py-1 rounded-full">{zone.temperatureDelta}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">{zone.description}</p>
                        <p className="text-sm font-semibold text-red-600 mt-3 p-2 bg-red-50 rounded-md border border-red-100">
                            <strong>Risk:</strong> {zone.risk}
                        </p>
                    </div>
                ))}
            </div>
        </div>
      )}

    </Card>
  );
};

export default Weather;
