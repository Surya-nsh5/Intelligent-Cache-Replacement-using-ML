# 🧠 Intelligent Cache Replacement using Machine Learning

This project implements an **Intelligent Cache Replacement System** using **Machine Learning** to optimize cache performance. The system predicts which cache item should be replaced based on access patterns, improving hit ratios and reducing latency.  

Two machine learning models are implemented: **Naive Bayes** and **Random Forest**.

---

## 📌 Overview

Caches improve system performance by storing frequently accessed data. Traditional cache replacement policies like LRU or FIFO do not always account for complex access patterns.  

This project uses machine learning to analyze cache access behavior and predict the best candidate for replacement. It simulates cache operations and continuously learns from historical access patterns.

---

## 🧩 Dataset

The dataset contains the following **features**:

| Feature Name       | Description |
|--------------------|-------------|
| `last_access_time` | Timestamp of last access |
| `access_count`     | Number of times the item has been accessed |
| `recency_rank`     | Rank based on recency of access |
| `access_type`      | Type of access (read/write) |
| `cache_item`       | Unique identifier for the cache item |
| `label`            | Target label indicating whether the item is replaced or retained |
| `other_features`   | Additional computed metrics (optional) |

> The `label` column is used to train the model to predict replacement decisions.

---

## 🧰 Requirements

Install the required Python libraries before running the project:

```bash
pip install pandas scikit-learn flask joblib numpy
