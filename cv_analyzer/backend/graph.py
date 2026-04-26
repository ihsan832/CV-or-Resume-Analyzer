"""
LangGraph pipeline for CV analysis.

Flow:
  input_node → preprocess_node → llm_analyzer_node → output_formatter_node
"""

import os
import re
import json
from typing import TypedDict, Any

from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, SystemMessage


# ── State schema ──────────────────────────────────────────────────────────────

class CVState(TypedDict):
    cv_text: str          # raw input
    cleaned_text: str     # after preprocessing
    raw_response: str     # LLM output string
    analysis: dict        # final parsed JSON


# ── LLM factory ──────────────────────────────────────────────────────────────

import os
from langchain_google_genai import ChatGoogleGenerativeAI

def get_llm():
    api_key = os.getenv("GOOGLE_API_KEY", "")

    if not api_key:
        raise RuntimeError("Missing GOOGLE_API_KEY in .env")

    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=api_key,
        temperature=0,
    )

# ── Node 1: Input ─────────────────────────────────────────────────────────────

def input_node(state: CVState) -> CVState:
    """Pass-through — raw cv_text is already in state."""
    return state


# ── Node 2: Preprocessing ─────────────────────────────────────────────────────

def preprocess_node(state: CVState) -> CVState:
    """Clean and normalize the extracted CV text."""
    text = state["cv_text"]

    # Remove excessive whitespace / blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = text.strip()

    # Truncate to ~4000 words to stay within token limits
    words = text.split()
    if len(words) > 4000:
        text = " ".join(words[:4000]) + "\n[...truncated]"

    return {**state, "cleaned_text": text}


# ── Node 3: LLM Analyzer ──────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a senior Applicant Tracking System (ATS) expert and HR consultant with 15+ years of experience reviewing resumes across all industries.

Analyze the provided CV text and return ONLY a valid JSON object — no markdown, no explanation, no extra text.

The JSON must follow this exact schema:
{
  "ats_score": <integer 0-100>,
  "skills": [<string>, ...],
  "strengths": [<string>, ...],
  "weaknesses": [<string>, ...],
  "suggestions": [<string>, ...],
  "job_matches": [<string>, ...]
}

Guidelines:
- ats_score: Realistic ATS compatibility score (formatting, keywords, structure, measurable achievements). Be strict.
- skills: Up to 20 concrete skills found in the CV (technical + soft).
- strengths: 4–6 genuine strengths with brief reasoning.
- weaknesses: 4–6 specific weaknesses or gaps found.
- suggestions: 5–7 actionable, prioritized improvement recommendations.
- job_matches: 6–8 specific job role titles that best match the candidate's profile.

Be accurate, realistic, and concise. Do NOT hallucinate information not found in the CV.
Return ONLY the JSON object."""

USER_PROMPT_TEMPLATE = """Here is the CV text to analyze:

---
{cv_text}
---

Return only the JSON analysis."""


def llm_analyzer_node(state: CVState) -> CVState:
    """Send cleaned CV text to the LLM and capture the raw response."""
    llm = get_llm()

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=USER_PROMPT_TEMPLATE.format(cv_text=state["cleaned_text"])),
    ]

    response = llm.invoke(messages)
    raw = response.content if hasattr(response, "content") else str(response)

    return {**state, "raw_response": raw}


# ── Node 4: Output Formatter ──────────────────────────────────────────────────

FALLBACK = {
    "ats_score": 0,
    "skills": [],
    "strengths": [],
    "weaknesses": [],
    "suggestions": [],
    "job_matches": [],
}


def output_formatter_node(state: CVState) -> CVState:
    """Parse the LLM response into a validated Python dict."""
    raw = state.get("raw_response", "")

    # Try direct parse first
    try:
        analysis = json.loads(raw)
        return {**state, "analysis": _validate(analysis)}
    except json.JSONDecodeError:
        pass

    # Try extracting JSON block from the response
    match = re.search(r"\{[\s\S]*\}", raw)
    if match:
        try:
            analysis = json.loads(match.group())
            return {**state, "analysis": _validate(analysis)}
        except json.JSONDecodeError:
            pass

    # Fallback: return empty structure rather than crash
    return {**state, "analysis": FALLBACK}


def _validate(data: dict) -> dict:
    """Ensure all required keys are present with correct types."""
    def to_int(val, default=0):
        try:
            return max(0, min(100, int(val)))
        except (TypeError, ValueError):
            return default

    def to_list(val):
        if isinstance(val, list):
            return [str(item) for item in val if item]
        return []

    return {
        "ats_score": to_int(data.get("ats_score")),
        "skills": to_list(data.get("skills")),
        "strengths": to_list(data.get("strengths")),
        "weaknesses": to_list(data.get("weaknesses")),
        "suggestions": to_list(data.get("suggestions")),
        "job_matches": to_list(data.get("job_matches")),
    }


# ── Build Graph ───────────────────────────────────────────────────────────────

def build_graph():
    """Assemble and compile the LangGraph state machine."""
    workflow = StateGraph(CVState)

    workflow.add_node("input_node", input_node)
    workflow.add_node("preprocess_node", preprocess_node)
    workflow.add_node("llm_analyzer_node", llm_analyzer_node)
    workflow.add_node("output_formatter_node", output_formatter_node)

    workflow.set_entry_point("input_node")
    workflow.add_edge("input_node", "preprocess_node")
    workflow.add_edge("preprocess_node", "llm_analyzer_node")
    workflow.add_edge("llm_analyzer_node", "output_formatter_node")
    workflow.add_edge("output_formatter_node", END)

    return workflow.compile()
