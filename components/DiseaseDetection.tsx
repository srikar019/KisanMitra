import React, { useState, useCallback, useRef, useEffect } from 'react';
import { detectCropDisease, analyzeSoilHealth } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';
import { useSharedState } from '../contexts/SharedStateContext';
import { useAuth } from '../contexts/AuthContext';
import type { DiseaseReport, SoilHealthReport } from '../types';
import Card from './common/Card';
import Button from './common/Button';
import Spinner from './common/Spinner';
import Icon from './common/Icon';
import { firestore } from '../services/firebase';
import firebase from 'firebase/compat/app';
import { predictDisease, isModelAvailable, loadModel, getModelStatus, type MLPrediction } from '../services/mlDiseaseService';

type AnalysisMode = 'disease' | 'soil';
type AIEngine = 'ml' | 'gemini';

const parsePhValue = (phString: string): number => {
    if (!phString) return 7.0;
    const numbers = phString.match(/\d+(\.\d+)?/g);
    if (!numbers) return 7.0; // Default to neutral if no number found
    const numericValues = numbers.map(parseFloat);
    const sum = numericValues.reduce((a, b) => a + b, 0);
    const average = sum / numericValues.length;
    // Clamp between 0 and 14 for safety
    return Math.max(0, Math.min(14, average));
};

const DiseaseDetection: React.FC = () => {
  const { translate, language } = useLanguage();
  const { userProfile } = useAuth();
  const [analysisMode, setAnalysisMode] = useSharedState<AnalysisMode>('disease_mode', 'disease');
  const [imagePreview, setImagePreview] = useSharedState<string | null>('disease_preview', null);
  const [imageBase64, setImageBase64] = useSharedState<string | null>('disease_base64', null);
  const [mimeType, setMimeType] = useSharedState<string>('disease_mimeType', '');
  const [diseaseReport, setDiseaseReport] = useSharedState<DiseaseReport | null>('disease_report', null);
  const [soilReport, setSoilReport] = useSharedState<SoilHealthReport | null>('soil_report', null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // ── ML Model State ──
  const [aiEngine, setAiEngine] = useState<AIEngine>('ml');
  const [mlPrediction, setMlPrediction] = useState<MLPrediction | null>(null);
  const [mlModelAvailable, setMlModelAvailable] = useState<boolean>(false);
  const [mlModelLoading, setMlModelLoading] = useState<boolean>(false);

  // Check if ML model is available on mount
  useEffect(() => {
    isModelAvailable().then(available => {
      setMlModelAvailable(available);
      if (available) {
        setMlModelLoading(true);
        loadModel().then(() => setMlModelLoading(false)).catch(() => {
          setMlModelLoading(false);
          setMlModelAvailable(false);
        });
      } else {
        setAiEngine('gemini'); // Fallback if model not deployed
      }
    });
  }, []);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const resetState = () => {
    setImagePreview(null);
    setImageBase64(null);
    setDiseaseReport(null);
    setSoilReport(null);
    setMlPrediction(null);
    setError(null);
  };
  
  const handleModeChange = (mode: AnalysisMode) => {
    if (loading) return;
    setAnalysisMode(mode);
    resetState();
  };

  const handleFile = (file: File | null) => {
    if (file) {
      if(file.size > 4 * 1024 * 1024) { // 4MB limit
          setError(translate('disease.error.size'));
          return;
      }
      resetState();
      setImagePreview(URL.createObjectURL(file));
      setMimeType(file.type);

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setImageBase64(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0] ?? null);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
        handleFile(file);
    } else {
        setError(translate('disease.error.type'));
    }
  };

  const openCamera = async () => {
    if (isCameraOpen) return;
    resetState();
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
        setIsCameraOpen(true);
    } catch (err) {
        console.error("Error accessing camera:", err);
        setError(translate('disease.error.camera'));
    }
  };

  const closeCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                if (blob) {
                    handleFile(new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' }));
                }
            }, 'image/jpeg');
        }
        closeCamera();
    }
  };

  const handleAnalysis = useCallback(async () => {
    if (!imageBase64) {
      setError(translate('disease.error.select'));
      return;
    }
    setLoading(true);
    setError(null);
    setDiseaseReport(null);
    setSoilReport(null);
    setMlPrediction(null);
    try {
        if(analysisMode === 'disease') {
            if (aiEngine === 'ml' && mlModelAvailable) {
                // ── ML Model Inference (in-browser CNN) ──
                const prediction = await predictDisease(imageBase64, mimeType);
                setMlPrediction(prediction);
                // Also set diseaseReport for compatibility
                setDiseaseReport({
                    isHealthy: prediction.isHealthy,
                    diseaseName: `${prediction.cropName} — ${prediction.diseaseName}`,
                    description: prediction.description,
                    treatment: prediction.treatment,
                });
                // Save to Firestore
                if (userProfile?.uid) {
                    firestore.collection('diseaseScans').add({
                        farmerUid: userProfile.uid,
                        isHealthy: prediction.isHealthy,
                        diseaseName: prediction.diseaseName,
                        description: prediction.description,
                        confidence: prediction.confidence,
                        engine: 'ml_model',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    }).catch(err => console.warn('Failed to save disease scan:', err));
                }
            } else {
                // ── Gemini AI Inference ──
                const data = await detectCropDisease(imageBase64, mimeType, language);
                setDiseaseReport(data);
                if (userProfile?.uid) {
                    firestore.collection('diseaseScans').add({
                        farmerUid: userProfile.uid,
                        isHealthy: data.isHealthy,
                        diseaseName: data.diseaseName || '',
                        description: data.description || '',
                        engine: 'gemini_ai',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    }).catch(err => console.warn('Failed to save disease scan:', err));
                }
            }
        } else {
            const data = await analyzeSoilHealth(imageBase64, mimeType, language);
            setSoilReport(data);
            // ── Save to Firestore for Health Passport system ──
            if (userProfile?.uid) {
                firestore.collection('soilAnalyses').doc(userProfile.uid).set({
                    farmerUid: userProfile.uid,
                    soilType: data.soilType,
                    texture: data.texture,
                    phLevel: data.phLevel,
                    organicMatter: data.organicMatter,
                    nutrientAnalysis: data.nutrientAnalysis,
                    recommendations: data.recommendations,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                }, { merge: true }).catch(err => console.warn('Failed to save soil analysis:', err));
            }
        }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  }, [imageBase64, mimeType, analysisMode, translate, userProfile, aiEngine, mlModelAvailable]);

  const triggerFileSelect = () => fileInputRef.current?.click();

  const isDiseaseMode = analysisMode === 'disease';

  return (
    <Card>
      <div className="flex items-center mb-4">
          <Icon name={isDiseaseMode ? "shield-check" : "beaker"} className={`h-8 w-8 mr-3 ${isDiseaseMode ? 'text-blue-500' : 'text-amber-600'}`}/>
          <h2 className="text-2xl font-bold text-gray-700">{translate('disease.title')}</h2>
      </div>

      <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-full mb-6 max-w-sm mx-auto">
        <button onClick={() => handleModeChange('disease')} disabled={loading} className={`w-1/2 px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-300 ${isDiseaseMode ? 'bg-green-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}>
            {translate('disease.mode.disease')}
        </button>
        <button onClick={() => handleModeChange('soil')} disabled={loading} className={`w-1/2 px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-300 ${!isDiseaseMode ? 'bg-green-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}>
            {translate('disease.mode.soil')}
        </button>
      </div>

      <p className="text-gray-600 mb-6 text-center">{isDiseaseMode ? translate('disease.description.disease') : translate('disease.description.soil')}</p>

      {isCameraOpen ? (
        <div className="mb-6 animate-fade-in">
          <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg mb-4 bg-gray-900" />
          <div className="flex justify-center gap-4">
            <Button onClick={takePhoto}>{translate('disease.camera.takePhoto')}</Button>
            <Button onClick={closeCamera} variant="secondary">{translate('disease.camera.cancel')}</Button>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      ) : (
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center bg-gray-50 mb-6 transition-colors duration-300 ${isDragging ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}
        >
          <input
            type="file"
            accept="image/jpeg, image/png"
            onChange={handleFileChange}
            className="hidden"
            ref={fileInputRef}
          />
          {!imagePreview ? (
            <div className="flex flex-col items-center">
              <Icon name="upload" className="h-12 w-12 text-gray-400 mb-4" />
              <p className="font-semibold text-gray-600 mb-4">{translate('disease.upload.drag')}</p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button onClick={triggerFileSelect} variant="secondary">{translate('disease.upload.select')}</Button>
                <Button onClick={openCamera} variant="secondary">{translate('disease.upload.camera')}</Button>
              </div>
              <p className="text-xs text-gray-500 mt-4">{translate('disease.upload.rules')}</p>
            </div>
          ) : (
            <div className="relative group">
              <img src={imagePreview || undefined} alt="Analysis preview" className="max-h-64 mx-auto rounded-lg shadow-md" />
              <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button onClick={triggerFileSelect} variant="secondary">{translate('disease.upload.change')}</Button>
                    <Button onClick={openCamera} variant="secondary">{translate('disease.upload.camera')}</Button>
                  </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Engine Toggle (only for disease mode) */}
      {isDiseaseMode && (
        <div className="mb-4">
          <div className="flex items-center justify-center space-x-2 bg-gray-100 p-1 rounded-full max-w-md mx-auto">
            <button
              onClick={() => setAiEngine('ml')}
              disabled={loading || !mlModelAvailable}
              className={`flex-1 px-4 py-2 text-xs font-semibold rounded-full transition-colors duration-300 flex items-center justify-center gap-1.5 ${
                aiEngine === 'ml'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-500 hover:bg-gray-200'
              } ${!mlModelAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Icon name="cpu-chip" className="w-3.5 h-3.5" />
              ML Model (CNN)
              {mlModelLoading && <Spinner />}
            </button>
            <button
              onClick={() => setAiEngine('gemini')}
              disabled={loading}
              className={`flex-1 px-4 py-2 text-xs font-semibold rounded-full transition-colors duration-300 flex items-center justify-center gap-1.5 ${
                aiEngine === 'gemini'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-500 hover:bg-gray-200'
              }`}
            >
              <Icon name="sparkles" className="w-3.5 h-3.5" />
              Gemini AI
            </button>
          </div>
          {aiEngine === 'ml' && mlModelAvailable && (
            <p className="text-xs text-center text-indigo-600 mt-2 font-medium">
              🧠 Using trained MobileNetV2 CNN — PlantVillage Dataset (38 classes)
            </p>
          )}
          {!mlModelAvailable && (
            <p className="text-xs text-center text-amber-600 mt-2">
              ML model not deployed yet. Using Gemini AI. Run the training pipeline to enable.
            </p>
          )}
        </div>
      )}

      <div className="text-center mb-6">
        <Button onClick={handleAnalysis} disabled={loading || !imagePreview || isCameraOpen} className="w-full sm:w-auto">
          {loading ? <Spinner /> : isDiseaseMode ? translate('disease.button.analyze.plant') : translate('disease.button.analyze.soil')}
        </Button>
      </div>

      {error && <p className="text-red-500 text-center">{error}</p>}
      
      {diseaseReport && isDiseaseMode && (
        <div className="animate-fade-in space-y-4">
          <h3 className="text-xl font-semibold text-gray-700">{translate('disease.report.plant.title')}</h3>

          {/* ML Model Confidence & Top Predictions */}
          {mlPrediction && aiEngine === 'ml' && (
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="cpu-chip" className="w-4 h-4" /> ML Model Prediction
                </span>
                <span className="text-xs text-gray-500">
                  ⚡ {mlPrediction.inferenceTimeMs}ms inference
                </span>
              </div>
              {/* Confidence Bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold text-gray-800">{mlPrediction.cropName} — {mlPrediction.diseaseName}</span>
                  <span className={`font-bold ${mlPrediction.confidence > 0.8 ? 'text-green-600' : mlPrediction.confidence > 0.5 ? 'text-amber-600' : 'text-red-600'}`}>
                    {(mlPrediction.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                      mlPrediction.confidence > 0.8 ? 'bg-green-500' : mlPrediction.confidence > 0.5 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${mlPrediction.confidence * 100}%` }}
                  />
                </div>
              </div>
              {/* Top-5 Predictions */}
              <div>
                <h5 className="text-xs font-semibold text-gray-600 mb-2">Top 5 Predictions</h5>
                <div className="space-y-1">
                  {mlPrediction.topPredictions.map((pred, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-4 text-gray-400 font-mono">#{i + 1}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-indigo-400 h-1.5 rounded-full" style={{ width: `${pred.confidence * 100}%` }} />
                      </div>
                      <span className="text-gray-700 min-w-[120px] truncate">{pred.cropName} — {pred.diseaseName}</span>
                      <span className="text-gray-500 font-mono w-12 text-right">{(pred.confidence * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-indigo-600 border-t border-indigo-100 pt-2">
                Severity: <span className="font-bold capitalize">{mlPrediction.severity}</span>
              </p>
            </div>
          )}

          {diseaseReport.isHealthy ? (
            <div className="p-4 rounded-lg bg-green-100 text-green-800 border border-green-200 flex items-center">
                <Icon name="check-circle" className="h-6 w-6 mr-3"/>
                <p className="font-semibold">{translate('disease.report.plant.healthy')}</p>
            </div>
          ) : (
            <div className="p-6 rounded-lg bg-orange-50 border border-orange-200 space-y-4">
                <div>
                    <h4 className="text-lg font-bold text-gray-800">{diseaseReport.diseaseName}</h4>
                </div>
                <div>
                    <h5 className="font-semibold text-gray-700">{translate('disease.report.plant.description')}</h5>
                    <p className="text-gray-600 text-sm">{diseaseReport.description}</p>
                </div>
                <div>
                    <h5 className="font-semibold text-gray-700">{translate('disease.report.plant.treatment')}</h5>
                    <ul className="list-disc list-inside text-gray-600 text-sm space-y-1">
                        {diseaseReport.treatment.map((step, index) => <li key={index}>{step}</li>)}
                    </ul>
                </div>
            </div>
          )}
        </div>
      )}

      {soilReport && !isDiseaseMode && (
         <div className="animate-fade-in space-y-4">
          <h3 className="text-xl font-semibold text-gray-700">{translate('disease.report.soil.title')}</h3>
           <div className="p-6 rounded-lg bg-amber-50 border border-amber-200 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                        <h5 className="font-semibold text-gray-700 text-sm">{translate('disease.report.soil.type')}</h5>
                        <p className="text-gray-800 font-bold">{soilReport.soilType}</p>
                    </div>
                     <div>
                        <h5 className="font-semibold text-gray-700 text-sm">{translate('disease.report.soil.texture')}</h5>
                        <p className="text-gray-800 font-bold">{soilReport.texture}</p>
                    </div>
                     <div>
                        <h5 className="font-semibold text-gray-700 text-sm">{translate('disease.report.soil.ph')}</h5>
                        {(() => {
                            const phValue = parsePhValue(soilReport.phLevel);
                            const phPercentage = (phValue / 14) * 100;
                            return (
                                <div className="px-2">
                                    <div className="relative w-full bg-gray-200 rounded-full h-2.5 my-1" aria-label={`pH scale bar indicating a value of ${phValue.toFixed(2)}`}>
                                        <div 
                                            className="bg-amber-500 h-2.5 rounded-full"
                                            style={{ width: `${phPercentage}%` }}
                                            role="presentation"
                                        ></div>
                                        <div 
                                            className="absolute top-0 left-1/2 -ml-px w-px h-full bg-gray-400"
                                            title="Neutral pH (7.0)"
                                            role="presentation"
                                        ></div>
                                    </div>
                                    <p className="text-gray-800 font-bold">{soilReport.phLevel}</p>
                                </div>
                            );
                        })()}
                    </div>
                     <div>
                        <h5 className="font-semibold text-gray-700 text-sm">{translate('disease.report.soil.organic')}</h5>
                        <p className="text-gray-800 font-bold">{soilReport.organicMatter}</p>
                    </div>
                </div>
                <div className="border-t border-amber-200 pt-4">
                    <h5 className="font-semibold text-gray-700">{translate('disease.report.soil.nutrients')}</h5>
                    <p className="text-gray-600 text-sm">{soilReport.nutrientAnalysis}</p>
                </div>
                <div className="border-t border-amber-200 pt-4">
                    <h5 className="font-semibold text-gray-700">{translate('disease.report.soil.recommendations')}</h5>
                    <ul className="list-disc list-inside text-gray-600 text-sm space-y-1">
                        {soilReport.recommendations?.map((step, index) => <li key={index}>{step}</li>) || <li>No recommendations provided.</li>}
                    </ul>
                </div>
            </div>
        </div>
      )}
    </Card>
  );
};

export default DiseaseDetection;
