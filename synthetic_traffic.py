"""
FAIR QUEUE — SYNTHETIC TRAFFIC GENERATOR (Python)
Mirrors src/scoring/syntheticTraffic.js so the model trains on data
shaped like what the real capture pipeline produces.
"""

import random
import time
import math


def _rand_range(lo, hi):
    return lo + random.random() * (hi - lo)


def generate_human_like_event_log(start_time=None, overrides=None):
    overrides = overrides or {}
    start_time = start_time if start_time is not None else int(time.time() * 1000)

    movements = []
    t = start_time
    x = _rand_range(50, 150)
    y = _rand_range(50, 150)
    direction = _rand_range(0, math.pi * 2)

    steps = overrides.get("movementSteps", 40)
    for _ in range(steps):
        direction += _rand_range(-0.35, 0.35)
        speed = _rand_range(2, 9)
        x += math.cos(direction) * speed + _rand_range(-1.5, 1.5)
        y += math.sin(direction) * speed + _rand_range(-1.5, 1.5)
        dt = _rand_range(120, 400) if random.random() < 0.1 else _rand_range(12, 45)
        t += dt
        movements.append({"x": round(x), "y": round(y), "t": round(t)})

    clicks = []
    click_t = t + _rand_range(100, 300)
    num_clicks = overrides.get("numClicks", 4)
    for _ in range(num_clicks):
        clicks.append({"t": round(click_t)})
        click_t += _rand_range(400, 2200)

    form_events = []
    if overrides.get("includeForm", True):
        fields = overrides.get("fields", ["name", "email", "phone"])
        focus_t = click_t + _rand_range(200, 500)
        for field in fields:
            fill_delay = _rand_range(350, 1800)
            form_events.append(
                {"field": field, "focusT": round(focus_t), "valueT": round(focus_t + fill_delay)}
            )
            focus_t += fill_delay + _rand_range(150, 600)

    return {
        "sessionId": overrides.get("sessionId", f"human_{random.randint(100000, 999999)}"),
        "movements": movements,
        "clicks": clicks,
        "formEvents": form_events,
        "_label": "human",
    }


def generate_bot_like_event_log(start_time=None, overrides=None):
    overrides = overrides or {}
    start_time = start_time if start_time is not None else int(time.time() * 1000)

    movements = []
    t = start_time
    start_x = _rand_range(50, 150)
    start_y = _rand_range(50, 150)
    end_x = start_x + _rand_range(200, 400)
    end_y = start_y + _rand_range(-50, 50)

    steps = overrides.get("movementSteps", 40)
    fixed_dt = overrides.get("fixedDt", 16)

    for i in range(steps):
        frac = i / (steps - 1) if steps > 1 else 0
        x = start_x + (end_x - start_x) * frac
        y = start_y + (end_y - start_y) * frac
        t += fixed_dt
        movements.append({"x": round(x), "y": round(y), "t": round(t)})

    clicks = []
    click_t = t + 200
    num_clicks = overrides.get("numClicks", 4)
    fixed_click_gap = overrides.get("fixedClickGap", 500)
    for _ in range(num_clicks):
        clicks.append({"t": round(click_t)})
        click_t += fixed_click_gap

    form_events = []
    if overrides.get("includeForm", True):
        fields = overrides.get("fields", ["name", "email", "phone"])
        focus_t = click_t + 50
        for field in fields:
            fill_delay = _rand_range(20, 60)
            form_events.append(
                {"field": field, "focusT": round(focus_t), "valueT": round(focus_t + fill_delay)}
            )
            focus_t += fill_delay + 30

    return {
        "sessionId": overrides.get("sessionId", f"bot_{random.randint(100000, 999999)}"),
        "movements": movements,
        "clicks": clicks,
        "formEvents": form_events,
        "_label": "bot",
    }


def generate_sneaky_bot_event_log(start_time=None, overrides=None):
    overrides = dict(overrides or {})
    overrides["includeForm"] = False
    base = generate_bot_like_event_log(start_time, overrides)
    base["movements"] = [
        {
            "x": m["x"] + round(_rand_range(-2, 2)),
            "y": m["y"] + round(_rand_range(-2, 2)),
            "t": m["t"] + round(_rand_range(-3, 3)),
        }
        for m in base["movements"]
    ]
    base["_label"] = "sneaky_bot"
    return base
