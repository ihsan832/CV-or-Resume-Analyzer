# 🧠 CVLens — AI CV Analyzer

> Upload your CV and get an instant ATS score, skill map, and career insights powered by LangChain + LangGraph.

---

## 📁 Project Structure

```
project/
├── frontend/
│   ├── index.html       # UI markup
│   ├── style.css        # Styles + dark mode
│   └── script.js        # Fetch API + dynamic rendering
├── backend/
│   ├── main.py          # FastAPI app + /analyze endpoint
│   ├── graph.py         # LangGraph pipeline (4 nodes)
│   ├── utils.py         # PDF/DOCX text extraction
│   ├── requirements.txt
│   └── .env.example
├── Dockerfile           # Optional Docker support
└── README.md
```

---

## ⚡ Quick Start (VS Code)

### 1. Clone / Download the project

```bash
cd your-workspace-folder
```

### 2. Set up the Backend

```bash
cd backend

# Create a virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure your API Key

```bash
# Copy the example env file
cp .env.example .env

# Open .env and add your key:
# For Anthropic Claude (recommended):
ANTHROPIC_API_KEY=sk-ant-...

# OR for OpenAI GPT:
OPENAI_API_KEY=sk-...
```

> **Get API Keys:**
> - Anthropic: https://console.anthropic.com
> - OpenAI: https://platform.openai.com

### 4. Start the Backend Server

```bash
uvicorn main:app --reload
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

Test it: open http://127.0.0.1:8000 in your browser.

### 5. Open the Frontend

In VS Code, right-click `frontend/index.html` and choose **"Open with Live Server"**

> If you don't have Live Server: install the [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) in VS Code.

**Or** just open `frontend/index.html` directly in your browser (double-click).

---

## 🐳 Docker (Optional)

```bash
# Build image
docker build -t cvlens .

# Run container (pass your API key)
docker run -p 8000:8000 -e ANTHROPIC_API_KEY=sk-ant-... cvlens
```

Then open `frontend/index.html` in your browser.

---

## 🔌 API Reference

### `POST /analyze`

Upload a CV file for analysis.

**Request:** `multipart/form-data`
- `file`: PDF or DOCX file (max 10 MB)

**Response:**
```json
{
  "ats_score": 74,
  "skills": ["Python", "Machine Learning", "FastAPI", "SQL"],
  "strengths": ["Clear work history", "Quantified achievements"],
  "weaknesses": ["No LinkedIn URL", "Missing summary section"],
  "suggestions": ["Add a professional summary", "Include GitHub profile"],
  "job_matches": ["Data Scientist", "ML Engineer", "Backend Developer"]
}
```

---

## 🔄 LangGraph Pipeline

```
cv_text
   │
   ▼
input_node          (pass-through)
   │
   ▼
preprocess_node     (clean whitespace, truncate to 4k words)
   │
   ▼
llm_analyzer_node   (Claude / GPT with strict JSON prompt)
   │
   ▼
output_formatter_node  (parse + validate JSON, fallback on error)
   │
   ▼
analysis dict
```

---

## 🌗 Features

- ✅ PDF & DOCX support
- ✅ Drag & drop upload
- ✅ ATS score with animated circle
- ✅ Skill tags
- ✅ Strengths & Weaknesses
- ✅ Improvement suggestions
- ✅ Job role matches
- ✅ Download report as .txt
- ✅ Dark mode
- ✅ Fully responsive (mobile)
- ✅ Works with Claude or OpenAI

---

## 🛠 Troubleshooting

| Problem | Fix |
|---|---|
| `No API key found` | Copy `.env.example` → `.env` and add your key |
| `CORS error` in browser | Make sure backend is running on port 8000 |
| `pdfplumber` import error | Run `pip install pdfplumber` inside your venv |
| Empty text extracted | Your PDF may be image-only (scanned). Use a text-based PDF. |
| Port 8000 in use | Run `uvicorn main:app --reload --port 8001` and update `API_BASE` in `script.js` |

---

## 📄 License

MIT — free to use and modify.
