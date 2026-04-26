/* ===== AI CV Analyzer - Frontend Script ===== */

const API_BASE = "http://localhost:8000";

// DOM refs
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const filePreview = document.getElementById("filePreview");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const fileTypeIcon = document.getElementById("fileTypeIcon");
const removeFile = document.getElementById("removeFile");
const analyzeBtn = document.getElementById("analyzeBtn");
const errorMsg = document.getElementById("errorMsg");
const uploadSection = document.getElementById("uploadSection");
const loadingSection = document.getElementById("loadingSection");
const resultsSection = document.getElementById("resultsSection");
const newAnalysisBtn = document.getElementById("newAnalysisBtn");
const downloadBtn = document.getElementById("downloadBtn");
const themeToggle = document.getElementById("themeToggle");

let selectedFile = null;
let lastResult = null;
let lastFileName = "";

// ===== Theme =====
const savedTheme = localStorage.getItem("cvlens-theme") || "light";
if (savedTheme === "dark") document.documentElement.setAttribute("data-theme", "dark");
updateThemeIcon();

themeToggle.addEventListener("click", () => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  document.documentElement.setAttribute("data-theme", isDark ? "light" : "dark");
  localStorage.setItem("cvlens-theme", isDark ? "light" : "dark");
  updateThemeIcon();
});

function updateThemeIcon() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  document.querySelector(".theme-icon").textContent = isDark ? "☀️" : "🌙";
}

// ===== File Upload - Click =====
dropZone.addEventListener("click", (e) => {
  if (!e.target.closest(".btn-upload")) fileInput.click();
});
document.querySelector(".btn-upload").addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

// ===== Drag & Drop =====
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

// ===== Handle File =====
function handleFile(file) {
  hideError();
  const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  const ext = file.name.split(".").pop().toLowerCase();

  if (!allowed.includes(file.type) && !["pdf", "docx"].includes(ext)) {
    showError("❌ Only PDF and DOCX files are accepted.");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showError("❌ File size must be under 10MB.");
    return;
  }

  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  fileTypeIcon.textContent = ext === "pdf" ? "📕" : "📘";
  filePreview.hidden = false;
}

removeFile.addEventListener("click", () => {
  selectedFile = null;
  fileInput.value = "";
  filePreview.hidden = true;
  hideError();
});

// ===== Analyze =====
analyzeBtn.addEventListener("click", async () => {
  if (!selectedFile) return;
  lastFileName = selectedFile.name;

  showSection("loading");
  animateSteps();

  const formData = new FormData();
  formData.append("file", selectedFile);

  try {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Server error" }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    lastResult = data;
    renderResults(data);
    showSection("results");
  } catch (err) {
    showSection("upload");
    showError(`❌ Analysis failed: ${err.message}`);
  }
});

// ===== Step Animation =====
function animateSteps() {
  const steps = ["step1", "step2", "step3"];
  const delays = [0, 2200, 4400];
  steps.forEach((id, i) => {
    const el = document.getElementById(id);
    el.className = "loader-step";
    setTimeout(() => {
      if (i > 0) document.getElementById(steps[i - 1]).className = "loader-step done";
      el.className = "loader-step active";
    }, delays[i]);
  });
}

// ===== Render Results =====
function renderResults(data) {
  document.getElementById("resultsFileName").textContent = lastFileName;

  // ATS Score
  const score = Math.round(data.ats_score || 0);
  animateNumber("atsValue", score);
  const circumference = 314;
  const offset = circumference - (score / 100) * circumference;
  const circle = document.getElementById("atsCircle");
  const fill = document.getElementById("atsBarFill");
  const pct = document.getElementById("atsBarPct");
  const badge = document.getElementById("atsBadge");
  const tip = document.getElementById("atsTip");

  setTimeout(() => {
    circle.style.strokeDashoffset = offset;
    fill.style.width = score + "%";
    pct.textContent = score + "%";

    // Color by score
    if (score >= 80) {
      circle.style.stroke = "var(--accent2)";
      badge.textContent = "Excellent";
      badge.className = "ats-badge great";
      tip.textContent = "Your CV is well-optimized for ATS systems!";
    } else if (score >= 60) {
      circle.style.stroke = "var(--accent3)";
      badge.textContent = "Good";
      badge.className = "ats-badge good";
      tip.textContent = "A few tweaks will make your CV stand out more.";
    } else if (score >= 40) {
      badge.textContent = "Fair";
      badge.className = "ats-badge";
      tip.textContent = "Your CV needs improvement to pass ATS filters.";
    } else {
      badge.textContent = "Needs Work";
      badge.className = "ats-badge";
      tip.textContent = "Significant improvements needed for ATS compatibility.";
    }
  }, 100);

  // Skills
  const skillsEl = document.getElementById("skillsTags");
  skillsEl.innerHTML = "";
  (data.skills || []).forEach((s, i) => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = s;
    tag.style.animationDelay = i * 40 + "ms";
    skillsEl.appendChild(tag);
  });

  // Strengths
  renderList("strengthsList", data.strengths || []);

  // Weaknesses
  renderList("weaknessesList", data.weaknesses || []);

  // Suggestions
  const sugEl = document.getElementById("suggestionsList");
  sugEl.innerHTML = "";
  (data.suggestions || []).forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    sugEl.appendChild(li);
  });

  // Job Matches
  const jobsEl = document.getElementById("jobsGrid");
  jobsEl.innerHTML = "";
  const jobIcons = ["💼", "🧠", "💻", "📊", "🔬", "🎨", "📈", "🛠️", "🌐", "📱"];
  (data.job_matches || []).forEach((job, i) => {
    const card = document.createElement("div");
    card.className = "job-card";
    card.style.animationDelay = i * 60 + "ms";
    card.innerHTML = `
      <div class="job-card-icon">${jobIcons[i % jobIcons.length]}</div>
      <div class="job-card-title">${escapeHtml(job)}</div>
      <div class="job-card-match">Match</div>
    `;
    jobsEl.appendChild(card);
  });
}

function renderList(id, items) {
  const el = document.getElementById(id);
  el.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    el.appendChild(li);
  });
}

function animateNumber(id, target) {
  const el = document.getElementById(id);
  let current = 0;
  const duration = 1000;
  const step = target / (duration / 16);
  const interval = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = Math.round(current);
    if (current >= target) clearInterval(interval);
  }, 16);
}

// ===== New Analysis =====
newAnalysisBtn.addEventListener("click", () => {
  selectedFile = null;
  lastResult = null;
  fileInput.value = "";
  filePreview.hidden = true;
  hideError();
  showSection("upload");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ===== Download Report =====
downloadBtn.addEventListener("click", () => {
  if (!lastResult) return;
  const report = generateTextReport(lastResult, lastFileName);
  const blob = new Blob([report], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `CV_Report_${lastFileName.replace(/\.[^.]+$/, "")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

function generateTextReport(data, fname) {
  const line = "─".repeat(60);
  return `
AI CV ANALYZER — REPORT
${line}
File: ${fname}
ATS Score: ${data.ats_score}/100

${line}
SKILLS
${line}
${(data.skills || []).join(", ")}

${line}
STRENGTHS
${line}
${(data.strengths || []).map((s, i) => `${i + 1}. ${s}`).join("\n")}

${line}
WEAKNESSES
${line}
${(data.weaknesses || []).map((s, i) => `${i + 1}. ${s}`).join("\n")}

${line}
IMPROVEMENT SUGGESTIONS
${line}
${(data.suggestions || []).map((s, i) => `${i + 1}. ${s}`).join("\n")}

${line}
JOB ROLE MATCHES
${line}
${(data.job_matches || []).join(", ")}

${line}
Generated by CVLens — AI CV Analyzer
`.trim();
}

// ===== Helpers =====
function showSection(name) {
  uploadSection.hidden = name !== "upload";
  loadingSection.hidden = name !== "loading";
  resultsSection.hidden = name !== "results";
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
}

function hideError() {
  errorMsg.hidden = true;
  errorMsg.textContent = "";
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
