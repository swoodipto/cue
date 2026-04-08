/* ============================================================
   CUE — app.js
   State · Canvas · Upload · URL load · Clipboard · Controls · Export · Session
   ============================================================ */

"use strict";

/* ── State ──────────────────────────────────────────────────── */

const state = {
  image: null,        // HTMLImageElement currently displayed
  imageDataURL: null, // compressed data URL persisted to localStorage
  settings: {
    bgColor: "#ffffff", // solid background colour
    padding: 60,        // px — range 0–120
    radius:  18,        // px — range 0–60
    shadow:  40,        // 0–100 intensity
  },
};

/* ── Shadow computation ─────────────────────────────────────── */

function computeShadow(intensity) {
  if (intensity <= 0) return null;
  const t = intensity / 100;
  return {
    color:   `rgba(0,0,0,${(t * 0.35).toFixed(3)})`,
    blur:    t * 72,
    offsetY: t * 30,
  };
}

/* ── DOM refs ───────────────────────────────────────────────── */

const $ = (id) => document.getElementById(id);

const els = {
  uploadZone:    $("uploadZone"),
  fileInput:     $("fileInput"),
  browseBtn:     $("browseBtn"),
  urlInput:      $("urlInput"),
  fetchBtn:      $("fetchBtn"),
  urlHint:       $("urlHint"),
  emptyState:    $("emptyState"),
  frameWrap:     $("frameWrap"),
  canvas:        $("previewCanvas"),
  exportBtn:     $("exportBtn"),
  copyBtn:       $("copyBtn"),
  toast:         $("toast"),
  sectionStyle:  $("section-style"),
  sectionExport: $("section-export"),
  // Appearance controls
  bgColorInput:  $("bgColorInput"),
  paddingSlider: $("paddingSlider"),
  paddingVal:    $("paddingVal"),
  radiusSlider:  $("radiusSlider"),
  radiusVal:     $("radiusVal"),
  shadowSlider:  $("shadowSlider"),
  shadowVal:     $("shadowVal"),
};

const ctx = els.canvas.getContext("2d");

/* ── Canvas render ──────────────────────────────────────────── */

const SCALE = 2; // 2× backing store for retina-sharp export

function render() {
  if (!state.image) return;

  const img     = state.image;
  const pad     = state.settings.padding;
  const r       = state.settings.radius;
  const bgColor = state.settings.bgColor;

  const imgW   = img.naturalWidth;
  const imgH   = img.naturalHeight;
  const aspect = imgW / imgH;

  // Cap display size to keep the preview reasonable
  const maxW = 700;
  const maxH = 580;

  let dW = imgW;
  let dH = imgH;

  if (dW > maxW - pad * 2) { dW = maxW - pad * 2; dH = dW / aspect; }
  if (dH > maxH - pad * 2) { dH = maxH - pad * 2; dW = dH * aspect; }

  dW = Math.max(1, Math.round(dW));
  dH = Math.max(1, Math.round(dH));

  const cW = dW + pad * 2;
  const cH = dH + pad * 2;

  // Set the pixel buffer at 2×
  els.canvas.width  = cW * SCALE;
  els.canvas.height = cH * SCALE;

  // Set only the CSS width — let CSS height:auto maintain aspect ratio
  // so the canvas scales correctly as the container resizes (no stretching).
  els.canvas.style.width  = cW + "px";
  els.canvas.style.height = ""; // clear any previously set inline height

  ctx.save();
  ctx.scale(SCALE, SCALE);

  // 1 — Solid background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, cW, cH);

  // 2 — Shadow (draw a filled rounded rect to cast the shadow beneath the image)
  const shadow = computeShadow(state.settings.shadow);
  if (shadow) {
    ctx.save();
    ctx.shadowColor   = shadow.color;
    ctx.shadowBlur    = shadow.blur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = shadow.offsetY;
    tracedRoundRect(ctx, pad, pad, dW, dH, r);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
  }

  // 3 — Image clipped to a rounded rect
  ctx.save();
  tracedRoundRect(ctx, pad, pad, dW, dH, r);
  ctx.clip();
  ctx.drawImage(img, pad, pad, dW, dH);
  ctx.restore();

  ctx.restore();
}

function tracedRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h,     x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y,         x + r, y);
  ctx.closePath();
}

/* ── Image loading ──────────────────────────────────────────── */

function loadImgElement(src, crossOrigin = null) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
  });
}

/**
 * Compress an HTMLImageElement to a data URL small enough for localStorage.
 * Caps the longest dimension at 1 200 px and prefers JPEG for large images.
 */
function toStorageURL(img) {
  const MAX = 1200;
  let w = img.naturalWidth;
  let h = img.naturalHeight;

  if (w > MAX || h > MAX) {
    const ratio = Math.min(MAX / w, MAX / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const offscreen = document.createElement("canvas");
  offscreen.width  = w;
  offscreen.height = h;
  offscreen.getContext("2d").drawImage(img, 0, 0, w, h);

  // PNG preserves transparency; only fall back to JPEG when the PNG is large
  const png = offscreen.toDataURL("image/png");
  if (png.length <= 600_000) return png;
  return offscreen.toDataURL("image/jpeg", 0.88);
}

async function setImage(dataURL) {
  try {
    const img = await loadImgElement(dataURL);
    state.image = img;
    showPreview();
    render();
    // Compress before storing so large file-uploads don't exceed localStorage quota
    state.imageDataURL = toStorageURL(img);
    saveSession();
  } catch {
    showToast("Could not display image.");
  }
}

function handleFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Please use a PNG, JPG, or WEBP image.");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => setImage(e.target.result);
  reader.readAsDataURL(file);
}

/* ── URL loading ────────────────────────────────────────────── */

async function loadFromURL(raw) {
  const url = raw.trim();
  if (!url) return;

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    setHint("Please enter a full URL starting with https://", true);
    return;
  }

  setFetchLoading(true);
  setHint("Loading…", false);

  try {
    // Load with crossOrigin so we can call toDataURL() without tainting the canvas
    const img = await loadImgElement(url, "anonymous");

    // Rasterise to a data URL for persistence
    const offscreen   = document.createElement("canvas");
    offscreen.width   = img.naturalWidth;
    offscreen.height  = img.naturalHeight;
    offscreen.getContext("2d").drawImage(img, 0, 0);
    const dataURL = offscreen.toDataURL("image/png");

    await setImage(dataURL);
    setHint("");
    els.urlInput.value = "";
  } catch {
    setHint("Couldn't load that URL. Make sure it's a direct image link.", true);
  } finally {
    setFetchLoading(false);
  }
}

/* ── Show preview ───────────────────────────────────────────── */

function showPreview() {
  els.emptyState.classList.add("hidden");
  els.frameWrap.classList.remove("hidden");
  els.sectionStyle.classList.remove("hidden");
  els.sectionExport.classList.remove("hidden");

  // Re-trigger entrance animation on each new image
  els.frameWrap.style.animation = "none";
  requestAnimationFrame(() => {
    els.frameWrap.style.animation = "";
  });
}

/* ── Upload zone ────────────────────────────────────────────── */

function initUpload() {
  els.uploadZone.addEventListener("click", (e) => {
    if (e.target === els.browseBtn || e.target.closest(".link-btn")) return;
    els.fileInput.click();
  });

  els.browseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    els.fileInput.click();
  });

  els.fileInput.addEventListener("change", (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
    els.fileInput.value = "";
  });

  // Drag over upload zone
  els.uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    els.uploadZone.classList.add("drag-over");
  });
  els.uploadZone.addEventListener("dragleave", () => {
    els.uploadZone.classList.remove("drag-over");
  });
  els.uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    els.uploadZone.classList.remove("drag-over");
    handleFile(e.dataTransfer.files[0]);
  });

  // Global drop anywhere on the page
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  });
}

/* ── URL input ──────────────────────────────────────────────── */

function initURLInput() {
  els.fetchBtn.addEventListener("click", () => loadFromURL(els.urlInput.value));
  els.urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadFromURL(els.urlInput.value);
  });
  els.urlInput.addEventListener("input", () => {
    if (els.urlHint.classList.contains("error")) setHint("");
  });
}

function setFetchLoading(on) {
  els.fetchBtn.classList.toggle("loading", on);
  els.fetchBtn.innerHTML = on ? '<div class="spinner"></div>' : "→";
}

function setHint(text, isError = false) {
  els.urlHint.textContent = text;
  els.urlHint.className   = "url-hint" + (isError ? " error" : "");
}

/* ── Clipboard paste (⌘V / Ctrl+V anywhere) ─────────────────── */

function initClipboard() {
  document.addEventListener("paste", (e) => {
    // Let the browser handle paste when the user is typing in the URL field
    if (document.activeElement === els.urlInput) return;

    const items = Array.from(e.clipboardData.items);

    // Priority 1: raw image data (screenshot, copied image)
    const imageItem = items.find((it) => it.type.startsWith("image/"));
    if (imageItem) {
      e.preventDefault();
      handleFile(imageItem.getAsFile());
      return;
    }

    // Priority 2: plain text that looks like a URL
    const textItem = items.find((it) => it.type === "text/plain");
    if (textItem) {
      textItem.getAsString((text) => {
        const trimmed = text.trim();
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
          e.preventDefault();
          els.urlInput.value = trimmed;
          loadFromURL(trimmed);
        }
      });
    }
  });
}

/* ── Slider helpers ─────────────────────────────────────────── */

/**
 * Update the gradient fill on a range slider's track.
 * The CSS uses --pct to split the filled / unfilled portions.
 */
function refreshSlider(slider) {
  const min = parseFloat(slider.min);
  const max = parseFloat(slider.max);
  const val = parseFloat(slider.value);
  const pct = ((val - min) / (max - min)) * 100;
  slider.style.setProperty("--pct", pct.toFixed(1) + "%");
}

/* ── Controls ───────────────────────────────────────────────── */

function initControls() {
  // Background colour picker
  els.bgColorInput.addEventListener("input", () => {
    state.settings.bgColor = els.bgColorInput.value;
    render();
    saveSession();
  });

  // Padding slider
  els.paddingSlider.addEventListener("input", () => {
    const val = parseInt(els.paddingSlider.value, 10);
    state.settings.padding  = val;
    els.paddingVal.textContent = val + "px";
    refreshSlider(els.paddingSlider);
    render();
    saveSession();
  });

  // Corner radius slider
  els.radiusSlider.addEventListener("input", () => {
    const val = parseInt(els.radiusSlider.value, 10);
    state.settings.radius  = val;
    els.radiusVal.textContent = val + "px";
    refreshSlider(els.radiusSlider);
    render();
    saveSession();
  });

  // Shadow slider
  els.shadowSlider.addEventListener("input", () => {
    const val = parseInt(els.shadowSlider.value, 10);
    state.settings.shadow  = val;
    els.shadowVal.textContent = val + "%";
    refreshSlider(els.shadowSlider);
    render();
    saveSession();
  });
}

/** Push saved settings back into the UI controls. */
function applySettingsToUI() {
  const { bgColor, padding, radius, shadow } = state.settings;

  els.bgColorInput.value = bgColor;

  els.paddingSlider.value    = padding;
  els.paddingVal.textContent = padding + "px";
  refreshSlider(els.paddingSlider);

  els.radiusSlider.value    = radius;
  els.radiusVal.textContent = radius + "px";
  refreshSlider(els.radiusSlider);

  els.shadowSlider.value    = shadow;
  els.shadowVal.textContent = shadow + "%";
  refreshSlider(els.shadowSlider);
}

/* ── Export ─────────────────────────────────────────────────── */

function initExport() {
  els.exportBtn.addEventListener("click", () => {
    if (!state.image) return;
    const link    = document.createElement("a");
    link.download = "cue-export.png";
    link.href     = els.canvas.toDataURL("image/png");
    link.click();
    showToast("Downloaded ✓");
  });

  els.copyBtn.addEventListener("click", async () => {
    if (!state.image) return;
    try {
      const blob = await new Promise((res) =>
        els.canvas.toBlob(res, "image/png")
      );
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      showToast("Copied to clipboard ✓");
    } catch {
      showToast("Copy not supported in this browser.");
    }
  });
}

/* ── Toast ──────────────────────────────────────────────────── */

let toastTimer = null;

function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

/* ── Session persistence ────────────────────────────────────── */

const SESSION_KEY = "cue_v2";

function saveSession() {
  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        settings:     state.settings,
        imageDataURL: state.imageDataURL,
      })
    );
  } catch {
    // Silently ignore quota errors — the app still works, just won't persist
  }
}

async function restoreSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;

    const saved = JSON.parse(raw);

    if (saved.settings) {
      state.settings = { ...state.settings, ...saved.settings };
      applySettingsToUI();
    }

    if (saved.imageDataURL) {
      await setImage(saved.imageDataURL);
    }
  } catch {
    localStorage.removeItem(SESSION_KEY); // corrupted — start fresh
  }
}

/* ── Window resize — re-render ──────────────────────────────── */

let resizeTimer = null;

window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (state.image) render();
  }, 120);
});

/* ── Init ───────────────────────────────────────────────────── */

function init() {
  // Initialise slider track fills from their default HTML values
  refreshSlider(els.paddingSlider);
  refreshSlider(els.radiusSlider);
  refreshSlider(els.shadowSlider);

  initUpload();
  initURLInput();
  initClipboard();
  initControls();
  initExport();
  restoreSession();
}

document.addEventListener("DOMContentLoaded", init);