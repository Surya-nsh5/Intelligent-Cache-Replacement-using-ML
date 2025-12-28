import os
import traceback
from flask import Flask, send_from_directory, request, jsonify
import joblib
import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)

MODEL_PATH = os.path.join(BASE_DIR, "Models", "random_forest_cache.pkl")
model = None

def get_model():
    global model
    if model is None:
        if os.path.exists(MODEL_PATH):
            model = joblib.load(MODEL_PATH)
        else:
            raise Exception("Model file missing")
    return model



@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "cache.html")


@app.route("/CSS/<path:filename>")
def serve_css(filename):
    return send_from_directory(os.path.join(BASE_DIR, "CSS"), filename)


@app.route("/JavaScript/<path:filename>")
def serve_js(filename):
    return send_from_directory(os.path.join(BASE_DIR, "JavaScript"), filename)


@app.route("/predict-evict", methods=["POST"])
def predict_evict():
    try:
        data = request.get_json(force=True)
        pages = data.get("pages", [])
        page_ids = data.get("pageIds", [])

        if not model:
            return jsonify({"error": "ML model not loaded"}), 500

        X = [[
            p.get("last_access_time", 0),
            p.get("access_count", 0),
            p.get("recency_rank", 0),
            p.get("access_type", 0),
            p.get("cache_item", 0)
        ] for p in pages]

        df = pd.DataFrame(X, columns=[
            "last_access_time","access_count","recency_rank","access_type","cache_item"
        ])

        probs = model.predict_proba(df)
        evict_page = page_ids[int(np.argmax(probs[:,1]))]
        return jsonify({"evict": evict_page})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 400

