import React, { useState, useCallback, useRef } from 'react';
import { detectCropDisease, analyzeSoilHealth } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';
import type { DiseaseReport, SoilHealthReport } from '../types';
import Card from './common/Card';
import Button from './common/Button';
import Spinner from './common/Spinner';
import Icon from './common/Icon';

type AnalysisMode = 'disease' | 'soil';

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
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('disease');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [diseaseReport, setDiseaseReport] = useState<DiseaseReport | null>(null);
  const [soilReport, setSoilReport] = useState<SoilHealthReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const resetState = () => {
    setImagePreview(null);
    setImageBase64(null);
    setDiseaseReport(null);
    setSoilReport(null);
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
    try {
        if(analysisMode === 'disease') {
            const data = await detectCropDisease(imageBase64, mimeType, language);
            setDiseaseReport(data);
        } else {
            const data = await analyzeSoilHealth(imageBase64, mimeType, language);
            setSoilReport(data);
        }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  }, [imageBase64, mimeType, analysisMode, translate]);

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

      <div className="text-center mb-6">
        <Button onClick={handleAnalysis} disabled={loading || !imagePreview || isCameraOpen} className="w-full sm:w-auto">
          {loading ? <Spinner /> : isDiseaseMode ? translate('disease.button.analyze.plant') : translate('disease.button.analyze.soil')}
        </Button>
      </div>

      {error && <p className="text-red-500 text-center">{error}</p>}
      
      {diseaseReport && isDiseaseMode && (
        <div className="animate-fade-in space-y-4">
          <h3 className="text-xl font-semibold text-gray-700">{translate('disease.report.plant.title')}</h3>
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
