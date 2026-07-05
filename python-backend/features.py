"""
FAIR QUEUE — FEATURE EXTRACTION
Converts a raw eventLog (same shape produced by src/capture/eventCapture.js)
into a fixed-length numeric feature vector for the IsolationForest.

Feature order matters — this exact order must match between training
(train_model.py) and inference (model.py).
"""

import math
import statistics


FEATURE_NAMES = [
    "avg_angle_change",
    "velocity_cov",
    "click_interval_cov",
    "num_clicks",
    "form_fill_avg_ms",
    "form_fill_cov",
    "num_movements",
]


def _mean(values):
    return sum(values) / len(values) if values else 0.0


def _cov(values):
    """Coefficient of variation — stddev / mean. 0 if insufficient data."""
    if len(values) < 2:
        return 0.0
    m = _mean(values)
    if m == 0:
        return 0.0
    sd = statistics.pstdev(values)
    return sd / m


def extract_features(event_log: dict) -> list:
    movements = event_log.get("movements") or []
    clicks = event_log.get("clicks") or []
    form_events = event_log.get("formEvents") or []

    # ---- Movement features ----
    angle_changes = []
    velocities = []
    for i in range(1, len(movements)):
        prev = movements[i - 1]
        curr = movements[i]
        dx = curr["x"] - prev["x"]
        dy = curr["y"] - prev["y"]
        dt = max(1, curr["t"] - prev["t"])
        dist = math.sqrt(dx * dx + dy * dy)
        velocities.append(dist / dt)

        if i >= 2:
            prev2 = movements[i - 2]
            dx1 = prev["x"] - prev2["x"]
            dy1 = prev["y"] - prev2["y"]
            angle1 = math.atan2(dy1, dx1)
            angle2 = math.atan2(dy, dx)
            diff = abs(angle2 - angle1)
            if diff > math.pi:
                diff = 2 * math.pi - diff
            angle_changes.append(diff)

    avg_angle_change = _mean(angle_changes)
    velocity_cov = _cov(velocities)

    # ---- Click features ----
    intervals = [clicks[i]["t"] - clicks[i - 1]["t"] for i in range(1, len(clicks))]
    click_interval_cov = _cov(intervals)
    num_clicks = len(clicks)

    # ---- Form features ----
    fill_times = [max(0, f["valueT"] - f["focusT"]) for f in form_events]
    form_fill_avg_ms = _mean(fill_times)
    form_fill_cov = _cov(fill_times)

    return [
        avg_angle_change,
        velocity_cov,
        click_interval_cov,
        float(num_clicks),
        form_fill_avg_ms,
        form_fill_cov,
        float(len(movements)),
    ]
