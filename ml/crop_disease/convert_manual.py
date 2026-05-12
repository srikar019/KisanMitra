"""
Convert trained Keras model to TF.js GRAPH MODEL format.
=========================================================
This approach completely bypasses the Keras 3 topology format issue:
  1. Load trained model
  2. Build clean inference model (no augmentation)
  3. Export as TF SavedModel (works because no seed_generators)
  4. Convert SavedModel -> TF.js Graph Model format
  5. Load in browser with tf.loadGraphModel()
"""
import os
import sys
import json
import shutil
import argparse
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")
MODEL_DIR = os.path.join(OUTPUT_DIR, "saved_model")
KERAS_MODEL = os.path.join(MODEL_DIR, "crop_disease_model.keras")
SAVED_MODEL_DIR = os.path.join(OUTPUT_DIR, "inference_savedmodel")
TFJS_OUTPUT = os.path.join(OUTPUT_DIR, "tfjs_model")
WEB_APP_MODEL_DIR = os.path.join(SCRIPT_DIR, "..", "..", "public", "models", "crop_disease")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--quantize", action="store_true")
    args = parser.parse_args()

    print("=" * 60)
    print("CONVERTING MODEL TO TENSORFLOW.JS GRAPH MODEL")
    print("=" * 60)

    if not os.path.exists(KERAS_MODEL):
        print(f"X Model not found: {KERAS_MODEL}")
        return

    # Forward-slash paths for embedded scripts
    keras_fwd = KERAS_MODEL.replace("\\", "/")
    sm_fwd = SAVED_MODEL_DIR.replace("\\", "/")
    tfjs_fwd = TFJS_OUTPUT.replace("\\", "/")

    # ── Step 1: Build clean inference model and export as SavedModel ──
    print("\n   Step 1: Building inference model + SavedModel export...")

    build_script = f'''
import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
import tensorflow as tf
from tensorflow.keras import layers, Model

# Load trained model
trained = tf.keras.models.load_model("{keras_fwd}")
num_classes = trained.output_shape[-1]
print(f"   Loaded: {{num_classes}} classes")

# Extract the actual trained layers (with their weights intact)
mobilenet = trained.get_layer("mobilenetv2_1.00_224")
dense1 = trained.get_layer("dense")
dense2 = trained.get_layer("dense_1")

print(f"   MobileNetV2 weights: {{len(mobilenet.get_weights())}} arrays")
print(f"   Dense1 weights: {{len(dense1.get_weights())}} arrays")
print(f"   Dense2 weights: {{len(dense2.get_weights())}} arrays")

# Build inference model REUSING trained layers (no augmentation, no preprocess)
# Preprocessing (scale [0,255] -> [-1,1]) is done in the browser JS
inputs = layers.Input(shape=(224, 224, 3), name="input_image")
x = mobilenet(inputs, training=False)
x = layers.GlobalAveragePooling2D()(x)
x = dense1(x)
x = layers.Dropout(0.5)(x, training=False)
x = dense2(x)
inference_model = Model(inputs, x, name="CropDiseaseDetector")

# Verify weights
total_w = sum(len(l.get_weights()) for l in inference_model.layers)
print(f"   Inference model total weight arrays: {{total_w}}")

# Export as TF SavedModel
import shutil
if os.path.exists("{sm_fwd}"):
    shutil.rmtree("{sm_fwd}")
tf.saved_model.save(inference_model, "{sm_fwd}")
print(f"   SavedModel exported to: {sm_fwd}")
print("STEP1_OK")
'''

    tmp1 = os.path.join(OUTPUT_DIR, "_step1.py")
    with open(tmp1, "w") as f:
        f.write(build_script)

    r1 = subprocess.run([sys.executable, tmp1], capture_output=True, text=True)
    try:
        os.remove(tmp1)
    except OSError:
        pass

    print(r1.stdout.strip())
    if "STEP1_OK" not in r1.stdout:
        print("\n   FAILED at Step 1!")
        if r1.stderr:
            for line in r1.stderr.strip().split("\n")[-10:]:
                print(f"   {line}")
        return

    # ── Step 2: Convert SavedModel -> TF.js Graph Model ──
    print("\n   Step 2: Converting SavedModel -> TF.js Graph Model...")

    if os.path.exists(TFJS_OUTPUT):
        shutil.rmtree(TFJS_OUTPUT)
    os.makedirs(TFJS_OUTPUT)

    quant_flag = ""
    if args.quantize:
        quant_flag = ', quantization_dtype_map={{"uint16": "*"}}'

    convert_script = f'''
import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
import tensorflowjs as tfjs

tfjs.converters.convert_tf_saved_model(
    "{sm_fwd}",
    "{tfjs_fwd}"{quant_flag}
)
print("STEP2_OK")
'''

    tmp2 = os.path.join(OUTPUT_DIR, "_step2.py")
    with open(tmp2, "w") as f:
        f.write(convert_script)

    r2 = subprocess.run([sys.executable, tmp2], capture_output=True, text=True)
    try:
        os.remove(tmp2)
    except OSError:
        pass

    if "STEP2_OK" not in r2.stdout:
        print("   FAILED at Step 2!")
        print(r2.stdout)
        if r2.stderr:
            for line in r2.stderr.strip().split("\n")[-10:]:
                print(f"   {line}")
        return

    print("   -> Graph Model conversion successful!")

    # ── Step 3: Copy to web app ──
    # Copy class_labels.json
    labels_src = os.path.join(SCRIPT_DIR, "..", "..", "public", "models", "crop_disease", "class_labels.json")
    if os.path.exists(labels_src):
        shutil.copy2(labels_src, os.path.join(TFJS_OUTPUT, "class_labels.json"))
    
    class_names_src = os.path.join(MODEL_DIR, "class_names.json")
    if os.path.exists(class_names_src):
        shutil.copy2(class_names_src, os.path.join(TFJS_OUTPUT, "class_names.json"))

    # List output files
    total = 0
    for f in sorted(os.listdir(TFJS_OUTPUT)):
        fpath = os.path.join(TFJS_OUTPUT, f)
        if os.path.isfile(fpath):
            sz = os.path.getsize(fpath)
            total += sz
            print(f"   - {f}: {sz/1024:.1f} KB")
    print(f"\n   Total: {total/(1024*1024):.2f} MB")

    # Copy to public/
    print(f"\n   Deploying to web app...")
    os.makedirs(WEB_APP_MODEL_DIR, exist_ok=True)
    
    # Remove old files first
    for f in os.listdir(WEB_APP_MODEL_DIR):
        fp = os.path.join(WEB_APP_MODEL_DIR, f)
        if os.path.isfile(fp) and f != "class_labels.json":
            os.remove(fp)
    
    for f in os.listdir(TFJS_OUTPUT):
        src = os.path.join(TFJS_OUTPUT, f)
        dst = os.path.join(WEB_APP_MODEL_DIR, f)
        if os.path.isfile(src):
            shutil.copy2(src, dst)

    print("\n" + "=" * 60)
    print("CONVERSION COMPLETE!")
    print("=" * 60)
    print("   Format: TF.js Graph Model")
    print("   Load with: tf.loadGraphModel('/models/crop_disease/model.json')")
    print("=" * 60)


if __name__ == "__main__":
    main()
