/**
 * ML Disease Detection Service
 * =============================
 * Loads the trained MobileNetV2 TensorFlow.js model and runs
 * crop disease classification inference directly in the browser.
 *
 * The model was trained on the PlantVillage dataset (38 classes)
 * and converted from Keras → TF.js using convert_to_tfjs.py.
 */

import * as tf from '@tensorflow/tfjs';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface MLPrediction {
  /** The predicted class label (e.g. "Tomato___Late_blight") */
  classLabel: string;
  /** Human-readable crop name */
  cropName: string;
  /** Human-readable disease name */
  diseaseName: string;
  /** Whether the plant is healthy */
  isHealthy: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Top-5 predictions with scores */
  topPredictions: Array<{
    label: string;
    cropName: string;
    diseaseName: string;
    confidence: number;
  }>;
  /** Disease description (from dataset) */
  description: string;
  /** Treatment steps (from dataset) */
  treatment: string[];
  /** Severity level */
  severity: string;
  /** Inference time in milliseconds */
  inferenceTimeMs: number;
}

interface ClassLabelInfo {
  crop: string;
  disease: string;
  healthy: boolean;
}

interface TreatmentInfo {
  description: string;
  treatment: string[];
  severity: string;
}

interface ClassLabelsData {
  labels: string[];
  num_classes: number;
  display_names: Record<string, ClassLabelInfo>;
  treatment_info: Record<string, TreatmentInfo>;
}

// ──────────────────────────────────────────────
// State
// ──────────────────────────────────────────────

let model: tf.GraphModel | tf.LayersModel | null = null;
let classLabels: ClassLabelsData | null = null;
let isLoading = false;
let loadError: string | null = null;

const MODEL_URL = '/models/crop_disease/model.json';
const CLASS_LABELS_URL = '/models/crop_disease/class_labels.json';
const IMG_SIZE = 224;

// ──────────────────────────────────────────────
// Model Loading
// ──────────────────────────────────────────────

/**
 * Check if the ML model files are available on the server.
 */
export async function isModelAvailable(): Promise<boolean> {
  try {
    const response = await fetch(MODEL_URL, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Load the TF.js model and class labels. Caches after first load.
 */
export async function loadModel(): Promise<void> {
  if (model) return; // Already loaded
  if (isLoading) return; // Loading in progress

  isLoading = true;
  loadError = null;

  try {
    console.log('🧠 Loading ML crop disease model...');
    const startTime = performance.now();

    // Load class labels first
    const labelsResponse = await fetch(CLASS_LABELS_URL);
    if (!labelsResponse.ok) {
      throw new Error(`Failed to load class labels: ${labelsResponse.statusText}`);
    }
    classLabels = await labelsResponse.json();

    // Load the TF.js model (Graph Model format from SavedModel conversion)
    model = await tf.loadGraphModel(MODEL_URL);

    const loadTime = (performance.now() - startTime).toFixed(0);
    console.log(`✅ ML model loaded in ${loadTime}ms`);
    console.log(`   Classes: ${classLabels?.num_classes}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error loading model';
    loadError = msg;
    console.error('❌ Failed to load ML model:', msg);
    throw err;
  } finally {
    isLoading = false;
  }
}

/**
 * Get the current model loading status.
 */
export function getModelStatus(): {
  loaded: boolean;
  loading: boolean;
  error: string | null;
} {
  return {
    loaded: model !== null,
    loading: isLoading,
    error: loadError,
  };
}

// ──────────────────────────────────────────────
// Preprocessing
// ──────────────────────────────────────────────

/**
 * Preprocess an image for MobileNetV2 inference.
 * Resizes to 224x224 and applies MobileNetV2 preprocessing (scale to [-1, 1]).
 */
function preprocessImage(imageElement: HTMLImageElement | HTMLCanvasElement): tf.Tensor4D {
  return tf.tidy(() => {
    // Convert image to tensor
    let tensor = tf.browser.fromPixels(imageElement);

    // Resize to 224x224
    tensor = tf.image.resizeBilinear(tensor as tf.Tensor3D, [IMG_SIZE, IMG_SIZE]);

    // Cast to float and apply MobileNetV2 preprocessing: scale [0, 255] → [-1, 1]
    const floatTensor = tensor.toFloat();
    const preprocessed = floatTensor.div(127.5).sub(1.0);

    // Add batch dimension: [224, 224, 3] → [1, 224, 224, 3]
    return preprocessed.expandDims(0) as tf.Tensor4D;
  });
}

/**
 * Create an HTMLImageElement from a base64 string.
 */
function base64ToImage(base64: string, mimeType: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

// ──────────────────────────────────────────────
// Inference
// ──────────────────────────────────────────────

/**
 * Run crop disease detection on a base64-encoded image.
 *
 * @param imageBase64 - Base64-encoded image string (without data: prefix)
 * @param mimeType - Image MIME type (e.g. "image/jpeg")
 * @returns MLPrediction with disease info, confidence, and treatment
 */
export async function predictDisease(
  imageBase64: string,
  mimeType: string
): Promise<MLPrediction> {
  // Ensure model is loaded
  if (!model || !classLabels) {
    await loadModel();
  }
  if (!model || !classLabels) {
    throw new Error('ML model is not available. Please ensure model files are in public/models/crop_disease/');
  }

  const startTime = performance.now();

  // Preprocess
  const imgElement = await base64ToImage(imageBase64, mimeType);
  const inputTensor = preprocessImage(imgElement);

  // Run inference
  const outputTensor = model.predict(inputTensor) as tf.Tensor;
  const probabilities = await outputTensor.data();

  // Clean up tensors
  inputTensor.dispose();
  outputTensor.dispose();

  const inferenceTimeMs = Math.round(performance.now() - startTime);

  // Get top-5 predictions
  const indexed = Array.from(probabilities).map((prob, idx) => ({ prob, idx }));
  indexed.sort((a, b) => b.prob - a.prob);
  const top5 = indexed.slice(0, 5);

  // Build the primary prediction
  const topIdx = top5[0].idx;
  const topLabel = classLabels.labels[topIdx];
  const displayInfo = classLabels.display_names[topLabel] || {
    crop: 'Unknown',
    disease: 'Unknown',
    healthy: false,
  };
  const treatmentInfo = classLabels.treatment_info[topLabel];

  // Build top-5 list
  const topPredictions = top5.map(({ prob, idx }) => {
    const label = classLabels!.labels[idx];
    const info = classLabels!.display_names[label] || {
      crop: 'Unknown',
      disease: 'Unknown',
      healthy: false,
    };
    return {
      label,
      cropName: info.crop,
      diseaseName: info.disease,
      confidence: parseFloat(prob.toFixed(4)),
    };
  });

  return {
    classLabel: topLabel,
    cropName: displayInfo.crop,
    diseaseName: displayInfo.disease,
    isHealthy: displayInfo.healthy,
    confidence: parseFloat(top5[0].prob.toFixed(4)),
    topPredictions,
    description: treatmentInfo?.description || (
      displayInfo.healthy
        ? 'The plant appears healthy with no visible signs of disease.'
        : 'Disease detected. Consult a local agricultural extension officer for treatment.'
    ),
    treatment: treatmentInfo?.treatment || (
      displayInfo.healthy
        ? ['Continue regular care and monitoring.']
        : ['Consult a local agricultural expert for specific treatment recommendations.']
    ),
    severity: treatmentInfo?.severity || (displayInfo.healthy ? 'none' : 'unknown'),
    inferenceTimeMs,
  };
}

/**
 * Warm up the model with a dummy prediction.
 * The first inference is always slower due to shader compilation.
 */
export async function warmUpModel(): Promise<void> {
  if (!model) return;

  console.log('🔥 Warming up ML model...');
  const dummyInput = tf.zeros([1, IMG_SIZE, IMG_SIZE, 3]) as tf.Tensor4D;
  const output = model.predict(dummyInput) as tf.Tensor;
  await output.data();
  dummyInput.dispose();
  output.dispose();
  console.log('✅ Model warm-up complete');
}
