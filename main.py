"""
FAIR QUEUE — PYTHON SCORING BACKEND
FastAPI service exposing POST /score, which takes a raw eventLog
(same shape as src/capture/eventCapture.js produces) and returns
a humanness score from a trained IsolationForest.

Run locally:
    python train_model.py     # one-time, produces model.joblib
    uvicorn main:app --reload

Deploy: Render, root directory = python-backend/
    Build command: pip install -r requirements.txt && python train_model.py
    Start command:  uvicorn main:app --host 0.0.0.0 --port $PORT
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

from model import score_event_log

app = FastAPI(title="Fair Queue Scoring API")

# CORS: allow the deployed frontend (Vercel) and local dev to call this API.
# Tighten allow_origins to your exact Vercel URL once you have it, for a
# more "production" posture — wildcard is fine for the demo week.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Request schema (mirrors eventCapture.js output) ----------

class MovementPoint(BaseModel):
    x: float
    y: float
    t: float


class ClickEvent(BaseModel):
    t: float


class FormEvent(BaseModel):
    field: str
    focusT: float
    valueT: float


class EventLogPayload(BaseModel):
    sessionId: Optional[str] = None
    movements: List[MovementPoint] = []
    clicks: List[ClickEvent] = []
    formEvents: List[FormEvent] = []


@app.get("/")
def health_check():
    return {"status": "ok", "service": "fair-queue-scoring"}


@app.post("/score")
def score(payload: EventLogPayload):
    event_log = payload.model_dump()
    try:
        result = score_event_log(event_log)
    except RuntimeError as e:
        # model.joblib missing — surfaces as a clear 500, not a silent crash
        raise HTTPException(status_code=500, detail=str(e))
    return result
