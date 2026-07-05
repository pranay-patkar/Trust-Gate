"""
FAIR QUEUE — INFERENCE
Loads the trained IsolationForest and scores a live eventLog into the
same 0-100 humanness scale used by the JS scorer, for consistency
between the Python-authoritative score and the JS fallback.
"""

import os
import joblib
import numpy as np

from features import extract_features

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.joblib")

# Must match the bounds used in train_model.py's rescale_to_humanness
RAW_MIN = -0.16
RAW_MAX = 0.16

_model = None


def load_model():
    global _model
    if _model is None:
        if not os.path.exists(MODEL_PATH):
            raise RuntimeError(
                "model.joblib not found — run `python train_model.py` first "
                "to generate it before starting the server."
            )
        _model = joblib.load(MODEL_PATH)
    return _model


def _rescale(raw_score: float) -> float:
    clipped = max(RAW_MIN, min(RAW_MAX, raw_score))
    return (clipped - RAW_MIN) / (RAW_MAX - RAW_MIN) * 100


def score_event_log(event_log: dict) -> dict:
    model = load_model()
    features = extract_features(event_log)
    X = np.array([features])

    raw_score = float(model.decision_function(X)[0])
    humanness = _rescale(raw_score)

    return {
        "score": round(humanness),
        "raw_anomaly_score": round(raw_score, 4),
        "features": {
            name: round(val, 4)
            for name, val in zip(
                [
                    "avg_angle_change",
                    "velocity_cov",
                    "click_interval_cov",
                    "num_clicks",
                    "form_fill_avg_ms",
                    "form_fill_cov",
                    "num_movements",
                ],
                features,
            )
        },
    }
