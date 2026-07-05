"""
FAIR QUEUE — MODEL TRAINING
Generates synthetic human-like traffic, extracts features, fits an
IsolationForest to learn what "normal" (human) behavior looks like.

Run this locally or as a one-time build step:
    python train_model.py

Produces model.joblib, loaded by main.py at server startup.

Why IsolationForest trained ONLY on human data:
Anomaly detection here treats "human" as the normal class and scores
deviation from it — bots don't need to be labeled at training time,
which mirrors the real-world problem (you always have human traffic to
learn from; you don't always have every future bot pattern in advance).
We still generate bot/sneaky-bot data below, but only to VALIDATE
separation, not to train the model directly.
"""

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

from synthetic_traffic import (
    generate_human_like_event_log,
    generate_bot_like_event_log,
    generate_sneaky_bot_event_log,
)
from features import extract_features, FEATURE_NAMES

N_TRAIN_HUMAN = 400
N_VALIDATE_EACH = 60


def build_feature_matrix(generator_fn, n):
    rows = []
    for i in range(n):
        log = generator_fn(overrides={"sessionId": f"train_{i}"})
        rows.append(extract_features(log))
    return np.array(rows)


def main():
    print("Generating synthetic human-like training data...")
    X_train = build_feature_matrix(generate_human_like_event_log, N_TRAIN_HUMAN)
    print(f"  {X_train.shape[0]} samples, {X_train.shape[1]} features: {FEATURE_NAMES}")

    print("\nFitting IsolationForest on human-only data...")
    # contamination='auto' + fitting on clean human data means the forest
    # learns the shape of "normal" and flags deviation from it at inference
    model = IsolationForest(
        n_estimators=200,
        contamination=0.05,  # expect ~5% of even genuine human sessions to look borderline
        random_state=42,
    )
    model.fit(X_train)

    joblib.dump(model, "model.joblib")
    print("Saved model.joblib")

    # ---- Validation: confirm separation on held-out synthetic data ----
    print("\n=== VALIDATION ===")

    def score_batch(label, generator_fn, n):
        X = build_feature_matrix(generator_fn, n)
        # decision_function: higher = more "normal" (human-like), lower = more anomalous
        raw_scores = model.decision_function(X)
        # Rescale roughly to 0-100 for human-readability (calibrated empirically below)
        scaled = rescale_to_humanness(raw_scores)
        print(f"{label:14s} n={n:3d}  raw min/avg/max = {raw_scores.min():.3f}/{raw_scores.mean():.3f}/{raw_scores.max():.3f}"
              f"   scaled min/avg/max = {scaled.min():.1f}/{scaled.mean():.1f}/{scaled.max():.1f}")
        return raw_scores

    human_scores = score_batch("HUMAN", generate_human_like_event_log, N_VALIDATE_EACH)
    bot_scores = score_batch("BOT", generate_bot_like_event_log, N_VALIDATE_EACH)
    sneaky_scores = score_batch("SNEAKY_BOT", generate_sneaky_bot_event_log, N_VALIDATE_EACH)

    gap = human_scores.min() - bot_scores.max()
    print(f"\nSeparation gap (human min raw - bot max raw): {gap:.3f}")
    print("✅ Clean separation" if gap > 0 else "⚠️  Overlap detected — consider more training data or feature tuning")


def rescale_to_humanness(raw_scores, raw_min=-0.16, raw_max=0.16):
    """
    Maps IsolationForest's raw decision_function output to a 0-100 scale.
    Bounds calibrated from observed training distribution — see model.py
    for the same constants used at inference time.
    """
    clipped = np.clip(raw_scores, raw_min, raw_max)
    return (clipped - raw_min) / (raw_max - raw_min) * 100


if __name__ == "__main__":
    main()
