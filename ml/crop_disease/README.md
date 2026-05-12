# 🌿 Crop Disease Detection — ML Pipeline

A complete machine learning pipeline that trains a **MobileNetV2 CNN** on the **PlantVillage dataset** (54K+ images, 38 classes) and deploys it for **in-browser inference** via TensorFlow.js.

## Architecture

```
PlantVillage Dataset (54K images)
        ↓
  Data Augmentation (flip, rotate, zoom, contrast)
        ↓
  MobileNetV2 (ImageNet pre-trained, frozen backbone)
        ↓
  Global Average Pooling → Dense(256, ReLU) → Dropout(0.5) → Softmax(38)
        ↓
  Phase 1: Transfer Learning (lr=1e-3, ~25 epochs)
        ↓
  Phase 2: Fine-Tuning (unfreeze top 30 layers, lr=1e-5, ~10 epochs)
        ↓
  Evaluation (Accuracy, F1, Confusion Matrix)
        ↓
  Convert to TensorFlow.js → Deploy in browser
```

## Quick Start

### 1. Install Python dependencies

```bash
cd ml/crop_disease
pip install -r requirements.txt
```

### 2. Train the model

```bash
# Full training (auto-downloads PlantVillage via kagglehub)
python train.py

# Quick test (small subset, ~5 min)
python train.py --epochs 3 --fine_tune_epochs 2 --quick

# With custom data directory
python train.py --data_dir /path/to/PlantVillage
```

### 3. Convert to TensorFlow.js

```bash
python convert_to_tfjs.py              # Full precision
python convert_to_tfjs.py --quantize   # Uint8 quantization (smaller)
```

This copies the model to `public/models/crop_disease/` automatically.

### 4. Run the web app

```bash
npm run dev
```

The Disease Detection page will auto-detect the model and show the **ML Model (CNN)** toggle.

## Output Files

After training:
```
ml/crop_disease/output/
├── saved_model/
│   ├── crop_disease_model.keras    # Trained Keras model
│   ├── saved_model/                # TF SavedModel format
│   └── class_names.json            # Class label mapping
├── tfjs_model/                     # TF.js converted model
│   ├── model.json
│   ├── group1-shard*.bin
│   ├── class_names.json
│   └── class_labels.json
├── plots/
│   ├── training_history.png        # Accuracy/loss curves
│   ├── confusion_matrix.png        # 38x38 confusion matrix
│   ├── classification_report.json  # Per-class precision/recall/F1
│   └── metrics.json                # Summary metrics
└── best_model.keras                # Best checkpoint
```

## 38 Disease Classes

| Crop | Diseases |
|------|----------|
| Apple | Scab, Black Rot, Cedar Rust, Healthy |
| Blueberry | Healthy |
| Cherry | Powdery Mildew, Healthy |
| Corn/Maize | Cercospora (Gray Leaf Spot), Common Rust, Northern Leaf Blight, Healthy |
| Grape | Black Rot, Esca, Leaf Blight, Healthy |
| Orange | Huanglongbing (Citrus Greening) |
| Peach | Bacterial Spot, Healthy |
| Bell Pepper | Bacterial Spot, Healthy |
| Potato | Early Blight, Late Blight, Healthy |
| Raspberry | Healthy |
| Soybean | Healthy |
| Squash | Powdery Mildew |
| Strawberry | Leaf Scorch, Healthy |
| Tomato | Bacterial Spot, Early Blight, Late Blight, Leaf Mold, Septoria, Spider Mites, Target Spot, TYLCV, Mosaic Virus, Healthy |

## Model Details

- **Base**: MobileNetV2 (pre-trained on ImageNet)
- **Input**: 224×224×3 RGB images
- **Training**: Transfer learning + fine-tuning
- **Dataset**: PlantVillage (54,305 images)
- **Expected accuracy**: ~95-97% on test set
