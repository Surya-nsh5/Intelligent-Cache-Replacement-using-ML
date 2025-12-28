import os
import traceback
from flask import Flask, send_from_directory, request, jsonify
import joblib
import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# keep your project structure unchanged
app = Flask(__name__)

MODEL_PATH = os.path.join(BASE_DIR, "Models", "random_forest_cache.pkl")
model = None

# --- Load ML Model ---
try:
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
        print(f"Loaded model from {MODEL_PATH}")
    else:
        print(f"No model found at {MODEL_PATH}. Server ML will fallback to heuristic.")
except Exception as e:
    print("Could not load model:", e)
    model = None


# --- Serve Frontend ---
@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "cache.html")


# serve your existing CSS and JS folders without moving them
@app.route("/CSS/<path:filename>")
def serve_css(filename):
    return send_from_directory(os.path.join(BASE_DIR, "CSS"), filename)

@app.route("/JavaScript/<path:filename>")
def serve_js(filename):
    return send_from_directory(os.path.join(BASE_DIR, "JavaScript"), filename)


# --- ML Eviction Endpoint ---
@app.route("/predict-evict", methods=["POST"])
def predict_evict():
    try:
        data = request.get_json(force=True)
        pages = data.get("pages", [])
        page_ids = data.get("pageIds", [])

        if not model:
            return jsonify({"error": "ML model not loaded! Cannot predict eviction."}), 500

        if not pages or not page_ids:
            return jsonify({"error": "Invalid input data for prediction."}), 400

        feature_vectors = []
        for p in pages:
            vec = [
                p.get("last_access_time", 0),
                p.get("access_count", 0),
                p.get("recency_rank", 0),
                p.get("access_type", 0),
                p.get("cache_item", 0),
            ]
            feature_vectors.append(vec)

        feature_names = [
            "last_access_time",
            "access_count",
            "recency_rank",
            "access_type",
            "cache_item",
        ]
        feature_df = pd.DataFrame(feature_vectors, columns=feature_names)

        probs = model.predict_proba(feature_df)
        evict_scores = [p[1] for p in probs]
        evict_index = int(np.argmax(evict_scores))
        evict_page = page_ids[evict_index]

        return jsonify({"evict": evict_page})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 400
