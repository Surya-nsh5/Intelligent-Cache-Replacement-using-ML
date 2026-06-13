<div align="center">
  <h1>🧠 Intelligent Cache Replacement using Machine Learning</h1>
  <p>A real-time cache replacement engine utilizing live Machine Learning predictions alongside traditional heuristics (LRU, MRU) to dynamically optimize hit rates and memory management.</p>
  
  <img src="https://img.shields.io/badge/Python-3.x-blue.svg?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Flask-Backend-black.svg?logo=flask" alt="Flask" />
  <img src="https://img.shields.io/badge/TailwindCSS-Frontend-06B6D4.svg?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/scikit--learn-ML_Models-F7931E.svg?logo=scikit-learn&logoColor=white" alt="Scikit-Learn" />
</div>

<br />

## 📌 Overview

Caches significantly improve system performance by storing frequently accessed data, but traditional cache replacement policies like **LRU** (Least Recently Used) or **FIFO** (First-In-First-Out) rely on rigid heuristics that don't adapt to complex, non-linear access patterns.

This project introduces a **live, data-driven approach**. It uses trained Machine Learning models (Random Forest, Naive Bayes, Decision Tree) deployed via a Flask backend to actively analyze current cache access behavior and intelligently predict the optimal candidate for eviction in real-time.

## ✨ Key Features

* **🧠 Live ML Predictions:** The backend scores individual cache items based on 5 unique statistical features to make live eviction choices.
* **⚡ Modern Dashboard:** A completely overhauled, fully responsive, zero-build-step frontend built with Tailwind CSS.
* **🎛️ Dynamic Resizing:** Adjust your cache size on the fly (from 2 up to 32 slots) and watch the UI and ML engine adapt seamlessly.
* **📊 Real-time Analytics:** Watch cache hits, misses, and hit-rates update live with CSS micro-animations.
* **💻 Live Activity Log:** A terminal-like scrolling activity log capturing every hit, miss, and system eviction decision.

---

## 🏗️ Architecture

* **Backend:** Python / Flask
* **Machine Learning:** `scikit-learn`, `pandas`, `numpy`, `joblib`
* **Frontend:** Vanilla HTML5, JavaScript, and Tailwind CSS (via CDN)

---

## 🧩 Dataset & Model Features

The models are trained to predict the probability that a specific item should be evicted based on the following real-time computed features:

| Feature Name | Description |
| :--- | :--- |
| `last_access_time` | Time elapsed since the item was last accessed |
| `access_count` | Absolute frequency (number of times the item has been accessed) |
| `recency_rank` | The item's relative position when sorted by most recent usage |
| `access_type` | Encoded type of access (e.g., read vs write) |
| `cache_item` | Hashed/Encoded unique identifier for the specific cache item |

---

## 🚀 Getting Started

### 1. Requirements

Ensure you have Python 3.x installed. Install the required libraries:

```bash
pip install pandas scikit-learn flask joblib numpy
```

*(Or simply run `pip install -r requirements.txt` if available)*

### 2. Running the Live Engine

Navigate into the application folder and start the Flask server:

```bash
cd IntelligenceCacheReplacement
python app.py
```

Open your web browser and navigate to:
**👉 `http://localhost:5000`**

### 3. Training the Models (Optional)

If you wish to retrain the models or experiment with the algorithms, ensure you have the `cache_dataset.csv` file available in the root directory. You can run the training scripts located in the `Training Model` folder:

```bash
# Example: Retraining the Random Forest model
python "Training Model/random-forest.py"

# Example: Retraining the Naive Bayes model
python "Training Model/naive-bayes.py"
```

*Note: The newly trained `.pkl` models will be saved to the `Models/` directory, and `app.py` will automatically load them on its next restart.*
