"""
Crop Disease Detection — Model Training Pipeline
=================================================
Fine-tunes MobileNetV2 on the PlantVillage dataset (38 classes).
Produces a SavedModel ready for TensorFlow.js conversion.

Usage:
    python train.py                       # Full training
    python train.py --epochs 5 --quick    # Quick test run (subset)
"""

import os
import json
import argparse
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for saving plots
import matplotlib.pyplot as plt
import seaborn as sns

import tensorflow as tf
from tensorflow.keras import layers, Model
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.callbacks import (
    EarlyStopping,
    ReduceLROnPlateau,
    ModelCheckpoint,
    TensorBoard,
)
from sklearn.metrics import classification_report, confusion_matrix

# ──────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────
IMG_SIZE = 224
BATCH_SIZE = 32
DEFAULT_EPOCHS = 25
AUTOTUNE = tf.data.AUTOTUNE
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")
MODEL_DIR = os.path.join(OUTPUT_DIR, "saved_model")
PLOTS_DIR = os.path.join(OUTPUT_DIR, "plots")


def download_dataset():
    """Download PlantVillage dataset via kagglehub."""
    print("\n   Downloading PlantVillage dataset via kagglehub...")
    try:
        import kagglehub
        path = kagglehub.dataset_download("emmarex/plantdisease")
        print(f"   Dataset downloaded to: {path}")
        
        # Navigate to the actual image directory
        # kagglehub typically downloads to a versioned folder
        for root, dirs, files in os.walk(path):
            if "PlantVillage" in dirs:
                return os.path.join(root, "PlantVillage")
            # Some versions have different folder names
            for d in dirs:
                subdir = os.path.join(root, d)
                # Check if this directory contains class folders
                subdirs = [x for x in os.listdir(subdir) if os.path.isdir(os.path.join(subdir, x))]
                if len(subdirs) >= 30:  # PlantVillage has 38 classes
                    return subdir
        
        # Fallback: return the downloaded path itself
        return path
    except ImportError:
        print("X  kagglehub not installed. Install with: pip install kagglehub")
        print("   Or download manually from: https://www.kaggle.com/datasets/emmarex/plantdisease")
        raise
    except Exception as e:
        print(f"X  Download failed: {e}")
        print("   You can download manually from: https://www.kaggle.com/datasets/emmarex/plantdisease")
        print("   Then run: python train.py --data_dir <path_to_PlantVillage_folder>")
        raise


def create_datasets(data_dir: str, quick: bool = False):
    """
    Load images from directory structure and split into train/val/test.
    Expected structure: data_dir/ClassName/image.jpg

    Automatically filters out junk/metadata folders that have very few
    images (< 50) to avoid polluting the class list.
    """
    print(f"\n   Loading images from: {data_dir}")

    # Verify directory exists and has content
    if not os.path.isdir(data_dir):
        raise FileNotFoundError(f"Data directory not found: {data_dir}")

    # Find all class subdirectories and filter out junk folders
    MIN_IMAGES_PER_CLASS = 50
    all_dirs = sorted([
        d for d in os.listdir(data_dir)
        if os.path.isdir(os.path.join(data_dir, d))
    ])

    valid_classes = []
    skipped_classes = []
    for d in all_dirs:
        class_path = os.path.join(data_dir, d)
        num_images = len([
            f for f in os.listdir(class_path)
            if f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.gif'))
        ])
        if num_images >= MIN_IMAGES_PER_CLASS:
            valid_classes.append((d, num_images))
        else:
            skipped_classes.append((d, num_images))

    if skipped_classes:
        print(f"   Skipping {len(skipped_classes)} junk/small folders:")
        for name, count in skipped_classes:
            print(f"      - {name} ({count} images)")

    print(f"   Using {len(valid_classes)} disease classes:")
    for name, count in valid_classes:
        print(f"      - {name}: {count} images")

    if len(valid_classes) == 0:
        raise ValueError(f"No valid class subdirectories found in {data_dir}")

    # Create a clean temporary dataset directory with only valid classes
    # (symlinks to avoid copying gigabytes of images)
    import shutil
    clean_dir = os.path.join(OUTPUT_DIR, "_clean_dataset")
    if os.path.exists(clean_dir):
        shutil.rmtree(clean_dir)
    os.makedirs(clean_dir)

    for class_name, _ in valid_classes:
        src = os.path.join(data_dir, class_name)
        dst = os.path.join(clean_dir, class_name)
        # Use junction/symlink on Windows, or just use the path directly
        # For reliability, we'll just create a directory with symlinks to images
        os.makedirs(dst, exist_ok=True)
        for img_file in os.listdir(src):
            img_src = os.path.join(src, img_file)
            img_dst = os.path.join(dst, img_file)
            if os.path.isfile(img_src):
                # Hard link to avoid copying (much faster)
                try:
                    os.link(img_src, img_dst)
                except OSError:
                    # Fallback: copy if hard link fails
                    shutil.copy2(img_src, img_dst)

    print(f"   Clean dataset prepared: {clean_dir}")

    # Use Keras utility to load from the clean directory
    seed = 42

    train_ds = tf.keras.utils.image_dataset_from_directory(
        clean_dir,
        validation_split=0.2,
        subset="training",
        seed=seed,
        image_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        label_mode="int",
    )

    val_test_ds = tf.keras.utils.image_dataset_from_directory(
        clean_dir,
        validation_split=0.2,
        subset="validation",
        seed=seed,
        image_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        label_mode="int",
    )

    class_names = train_ds.class_names
    num_classes = len(class_names)
    print(f"   Final classes: {num_classes}")
    print(f"   Train batches: {tf.data.experimental.cardinality(train_ds).numpy()}")

    # Split val_test into val (50%) and test (50%)
    val_test_size = tf.data.experimental.cardinality(val_test_ds).numpy()
    val_size = val_test_size // 2
    val_ds = val_test_ds.take(val_size)
    test_ds = val_test_ds.skip(val_size)

    if quick:
        # Take a small subset for quick testing
        train_ds = train_ds.take(50)
        val_ds = val_ds.take(10)
        test_ds = test_ds.take(10)
        print("   QUICK MODE: using subset of data")

    # Performance optimizations
    train_ds = train_ds.cache().shuffle(1000).prefetch(AUTOTUNE)
    val_ds = val_ds.cache().prefetch(AUTOTUNE)
    test_ds = test_ds.cache().prefetch(AUTOTUNE)

    return train_ds, val_ds, test_ds, class_names, num_classes


def build_data_augmentation():
    """Create a data augmentation pipeline."""
    return tf.keras.Sequential([
        layers.RandomFlip("horizontal_and_vertical"),
        layers.RandomRotation(0.2),
        layers.RandomZoom(0.2),
        layers.RandomContrast(0.2),
    ], name="data_augmentation")


def build_model(num_classes: int) -> Model:
    """
    Build a MobileNetV2-based model with transfer learning.
    
    Architecture:
        Input (224x224x3) 
        → Data Augmentation 
        → MobileNetV2 (frozen backbone) 
        → Global Average Pooling 
        → Dense(256, ReLU) + Dropout(0.5) 
        → Dense(num_classes, Softmax)
    """
    # Load pre-trained MobileNetV2 (without top classification layer)
    base_model = MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights="imagenet",
    )
    
    # Freeze the base model weights (transfer learning)
    base_model.trainable = False

    # Build the full model
    inputs = layers.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
    
    # MobileNetV2 expects pixel values in [-1, 1]
    x = tf.keras.applications.mobilenet_v2.preprocess_input(inputs)
    
    # Data augmentation (only during training)
    augmentation = build_data_augmentation()
    x = augmentation(x)
    
    # Feature extraction
    x = base_model(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    
    # Classification head
    x = layers.Dense(256, activation="relu")(x)
    x = layers.Dropout(0.5)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    model = Model(inputs, outputs, name="CropDiseaseDetector")
    return model, base_model


def fine_tune_model(model: Model, base_model, num_classes: int):
    """
    Unfreeze the top layers of MobileNetV2 for fine-tuning.
    This gives the model a chance to adapt pre-trained features
    to crop disease-specific patterns.
    """
    # Unfreeze the last 30 layers of MobileNetV2
    base_model.trainable = True
    for layer in base_model.layers[:-30]:
        layer.trainable = False

    # Recompile with a very low learning rate for fine-tuning
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def plot_training_history(history, history_ft, save_dir: str):
    """Plot training and validation accuracy/loss curves."""
    os.makedirs(save_dir, exist_ok=True)

    # Combine histories
    acc = history.history["accuracy"] + history_ft.history["accuracy"]
    val_acc = history.history["val_accuracy"] + history_ft.history["val_accuracy"]
    loss = history.history["loss"] + history_ft.history["loss"]
    val_loss = history.history["val_loss"] + history_ft.history["val_loss"]
    epochs_range = range(len(acc))
    ft_start = len(history.history["accuracy"])

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    # Accuracy
    ax1.plot(epochs_range, acc, label="Training Accuracy", color="#2E86AB")
    ax1.plot(epochs_range, val_acc, label="Validation Accuracy", color="#A23B72")
    ax1.axvline(x=ft_start, color="gray", linestyle="--", alpha=0.7, label="Fine-tuning starts")
    ax1.set_title("Model Accuracy", fontsize=14, fontweight="bold")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Accuracy")
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    # Loss
    ax2.plot(epochs_range, loss, label="Training Loss", color="#2E86AB")
    ax2.plot(epochs_range, val_loss, label="Validation Loss", color="#A23B72")
    ax2.axvline(x=ft_start, color="gray", linestyle="--", alpha=0.7, label="Fine-tuning starts")
    ax2.set_title("Model Loss", fontsize=14, fontweight="bold")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Loss")
    ax2.legend()
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    path = os.path.join(save_dir, "training_history.png")
    plt.savefig(path, dpi=150)
    plt.close()
    print(f"   Training history saved: {path}")


def evaluate_model(model, test_ds, class_names, save_dir: str):
    """Run full evaluation: accuracy, classification report, confusion matrix."""
    os.makedirs(save_dir, exist_ok=True)

    print("\n   Evaluating on test set...")
    test_loss, test_accuracy = model.evaluate(test_ds)
    print(f"   Test Accuracy: {test_accuracy:.4f}")
    print(f"   Test Loss:     {test_loss:.4f}")

    # Collect all predictions and true labels
    y_true = []
    y_pred = []
    for images, labels in test_ds:
        predictions = model.predict(images, verbose=0)
        y_true.extend(labels.numpy())
        y_pred.extend(np.argmax(predictions, axis=1))

    y_true = np.array(y_true)
    y_pred = np.array(y_pred)

    # Classification Report
    report = classification_report(
        y_true, y_pred,
        target_names=class_names,
        output_dict=True,
    )
    report_text = classification_report(
        y_true, y_pred,
        target_names=class_names,
    )

    print("\n   Classification Report:")
    print(report_text)

    # Save report as JSON
    report_path = os.path.join(save_dir, "classification_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"   Report saved: {report_path}")

    # Confusion Matrix
    cm = confusion_matrix(y_true, y_pred)
    fig, ax = plt.subplots(figsize=(20, 18))
    sns.heatmap(
        cm, annot=True, fmt="d", cmap="Blues",
        xticklabels=class_names, yticklabels=class_names,
        ax=ax,
    )
    ax.set_title("Confusion Matrix — Crop Disease Detection", fontsize=16, fontweight="bold")
    ax.set_xlabel("Predicted", fontsize=12)
    ax.set_ylabel("True", fontsize=12)
    plt.xticks(rotation=45, ha="right", fontsize=7)
    plt.yticks(fontsize=7)
    plt.tight_layout()

    cm_path = os.path.join(save_dir, "confusion_matrix.png")
    plt.savefig(cm_path, dpi=150)
    plt.close()
    print(f"   Confusion matrix saved: {cm_path}")

    # Save metrics summary
    metrics = {
        "test_accuracy": float(test_accuracy),
        "test_loss": float(test_loss),
        "num_classes": len(class_names),
        "total_test_samples": len(y_true),
        "per_class_accuracy": {
            name: float(report[name]["precision"])
            for name in class_names if name in report
        },
        "macro_avg_f1": float(report["macro avg"]["f1-score"]),
        "weighted_avg_f1": float(report["weighted avg"]["f1-score"]),
    }

    metrics_path = os.path.join(save_dir, "metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"   Metrics saved: {metrics_path}")

    return metrics


def save_model(model, class_names, save_dir: str):
    """Save the trained model in Keras format (.keras)."""
    os.makedirs(save_dir, exist_ok=True)

    # Save the Keras model (used directly by convert_to_tfjs.py)
    keras_path = os.path.join(save_dir, "crop_disease_model.keras")
    model.save(keras_path)
    print(f"\n   Keras model saved: {keras_path}")

    # NOTE: We skip tf.saved_model.save() because Keras 3 data-augmentation
    # layers (RandomFlip, RandomRotation, etc.) contain internal seed
    # generators that cannot be serialized to SavedModel format.
    # The .keras file is sufficient — convert_to_tfjs.py reads it directly.

    # Save class names mapping
    labels_path = os.path.join(save_dir, "class_names.json")
    with open(labels_path, "w") as f:
        json.dump(class_names, f, indent=2)
    print(f"   Class names saved: {labels_path}")

    return keras_path


def main():
    parser = argparse.ArgumentParser(description="Train Crop Disease Detection Model")
    parser.add_argument("--data_dir", type=str, default=None,
                        help="Path to PlantVillage dataset folder")
    parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS,
                        help=f"Number of training epochs (default: {DEFAULT_EPOCHS})")
    parser.add_argument("--fine_tune_epochs", type=int, default=10,
                        help="Number of fine-tuning epochs (default: 10)")
    parser.add_argument("--quick", action="store_true",
                        help="Quick mode: use small data subset for testing")
    args = parser.parse_args()

    print("=" * 60)
    print("CROP DISEASE DETECTION - MODEL TRAINING PIPELINE")
    print("=" * 60)
    print(f"   TensorFlow version: {tf.__version__}")
    print(f"   GPU available: {len(tf.config.list_physical_devices('GPU')) > 0}")
    
    gpus = tf.config.list_physical_devices('GPU')
    if gpus:
        print(f"   GPU devices: {[g.name for g in gpus]}")
        # Enable memory growth to avoid OOM
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)

    # ── Step 1: Get data ──
    if args.data_dir:
        data_dir = args.data_dir
    else:
        data_dir = download_dataset()

    # ── Step 2: Create datasets ──
    train_ds, val_ds, test_ds, class_names, num_classes = create_datasets(
        data_dir, quick=args.quick
    )

    # ── Step 3: Build model ──
    print("\n   Building MobileNetV2 model...")
    model, base_model = build_model(num_classes)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.summary()

    # ── Step 4: Train (transfer learning phase) ──
    print(f"\n>> Phase 1: Transfer Learning ({args.epochs} epochs)...")
    callbacks = [
        EarlyStopping(
            monitor="val_loss", patience=5,
            restore_best_weights=True, verbose=1
        ),
        ReduceLROnPlateau(
            monitor="val_loss", factor=0.5,
            patience=3, min_lr=1e-7, verbose=1
        ),
        ModelCheckpoint(
            os.path.join(OUTPUT_DIR, "best_model.keras"),
            monitor="val_accuracy", save_best_only=True, verbose=1
        ),
    ]

    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.epochs,
        callbacks=callbacks,
    )

    # ── Step 5: Fine-tuning phase ──
    print(f"\n>> Phase 2: Fine-Tuning ({args.fine_tune_epochs} epochs)...")
    model = fine_tune_model(model, base_model, num_classes)

    history_ft = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.fine_tune_epochs,
        callbacks=[
            EarlyStopping(
                monitor="val_loss", patience=3,
                restore_best_weights=True, verbose=1
            ),
            ReduceLROnPlateau(
                monitor="val_loss", factor=0.5,
                patience=2, min_lr=1e-8, verbose=1
            ),
        ],
    )

    # ── Step 6: Evaluate ──
    metrics = evaluate_model(model, test_ds, class_names, PLOTS_DIR)

    # ── Step 7: Plot training curves ──
    plot_training_history(history, history_ft, PLOTS_DIR)

    # ── Step 8: Save model ──
    save_model(model, class_names, MODEL_DIR)

    print("\n" + "=" * 60)
    print("TRAINING COMPLETE!")
    print("=" * 60)
    print(f"   Final Test Accuracy:   {metrics['test_accuracy']:.4f}")
    print(f"   Macro Avg F1-Score:    {metrics['macro_avg_f1']:.4f}")
    print(f"   Weighted Avg F1-Score: {metrics['weighted_avg_f1']:.4f}")
    print(f"\n   Model saved to:  {MODEL_DIR}")
    print(f"   Plots saved to:  {PLOTS_DIR}")
    print(f"\n   Next step: Run convert_to_tfjs.py to convert for browser use")
    print("=" * 60)


if __name__ == "__main__":
    main()
