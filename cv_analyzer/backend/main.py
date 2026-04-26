"""
AI CV Analyzer — FastAPI Backend
Entry point: uvicorn main:app --reload
"""

import os
import json
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from dotenv import load_dotenv

from utils import extract_text_from_file
from graph import build_graph

load_dotenv()

# ── Validate API key at startup ──────────────────────────────────────────────
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

if not GOOGLE_API_KEY:
    raise RuntimeError(
        "No API key found. Set GOOGLE_API_KEY in your .env file."
    )
# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AI CV Analyzer",
    description="Upload a CV (PDF/DOCX) and receive an AI-powered analysis.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Build LangGraph pipeline once at startup
graph = build_graph()

# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok", "message": "AI CV Analyzer API is running."}


@app.post("/analyze")
async def analyze_cv(file: UploadFile = File(...)):
    """
    Accepts a PDF or DOCX file and returns structured CV analysis JSON.
    """
    # 1. Validate file type
    allowed_types = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    allowed_extensions = {".pdf", ".docx"}
    ext = Path(file.filename).suffix.lower()

    if file.content_type not in allowed_types and ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX files are supported.",
        )

    # 2. Read file bytes
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be under 10 MB.")

    # 3. Extract text
    try:
        cv_text = extract_text_from_file(contents, ext)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Text extraction failed: {str(e)}")

    if not cv_text.strip():
        raise HTTPException(
            status_code=422,
            detail="Could not extract readable text from the file. Make sure it is not scanned/image-only.",
        )

    # 4. Run LangGraph pipeline
    try:
        result = graph.invoke({"cv_text": cv_text})
        analysis = result.get("analysis", {})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

    return JSONResponse(content=analysis)
