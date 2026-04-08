/* ============================================================
   CUE — app.js
   State · Canvas · Upload · URL · Clipboard · Controls · Export · Session
   ============================================================ */

"use strict";

/* ── State ──────────────────────────────────────────────────── */

const state = {
  image: null,        // HTMLImageElement currently displayed
  imageDataURL: null, // compressed data URL persisted to localStorage
  settings: {
    bgColor:     "#ffffff", // solid background colour
    noise:       false,     // subtle grain overlay
    canvasRatio: "free",    // "free" | "16:9" | "1:1" | "9:16" | "3:4"
    padding:     60,        // px — 0–120
    radius:      18,        // px — 0–60
    shadow:      40,        // 0–100 intensity
  },
};

/* ── Canvas size presets ────────────────────────────────────── */

// Logical pixel dimensions for the canvas at 1× (exported at 2×)
const CANVAS_PRESETS = {
  "16:9": { cW: 640, cH: 360  },
  "1:1":  { cW: 560, cH: 560  },
  "9:16": { cW: 338, cH: 600  },
  "3:4":  { cW: 450, cH: 600  },
};

/* ── Shadow ─────────────────────────────────────────────────── */

function computeShadow(intensity) {
  if (intensity <= 0) return null;
  const t = intensity / 100;
  return {
    color:   `rgba(0,0,0,${(t * 0.35).toFixed(3)})`,
    blur:    t * 72,
    offsetY: t * 30,
  };
}

/* ── Noise ──────────────────────────────────────────────────── */

function paintNoise(ctx, w, h) {
  const imageData = ctx.createImageData(w, h);
  const buf = imageData.data;
  for (let i = 0; i < buf.length; i += 4) {
    const v = Math.random() * 255;
    buf[i] = buf[i + 1] = buf[i + 2] = v;
    buf[i + 3] = 28; // ~11% opacity — subtle grain
  }
  ctx.putImageData(imageData, 0, 0);
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
  ratioPicker:   $("ratioPicker"),
  bgColorInput:  $("bgColorInput"),
  noisePicker:   $("noisePicker"),
  paddingSlider: $("paddingSlider"),
  paddingVal:    $("paddingVal"),
  radiusSlider:  $("radiusSlider"),
  radiusVal:     $("radiusVal"),
  shadowSlider:  $("shadowSlider"),
  shadowVal:     $("shadowVal"),
};

const ctx = els.canvas.getContext("2d");

/* ── Canvas render ──────────────────────────────────────────── */

const SCALE = 2; // 2× backing store → retina-sharp export

function render() {
  if (!state.image) return;

  const img     = state.image;
  const pad     = state.settings.padding;
  const r       = state.settings.radius;
  const bgColor = state.settings.bgColor;

  const imgW   = img.naturalWidth;
  const imgH   = img.naturalHeight;
  const aspect = imgW / imgH;

  let cW, cH, dW, dH, ix, iy;

  const preset = CANVAS_PRESETS[state.settings.canvasRatio];

  if (!preset) {
    // ── Free: canvas sized to image + padding ──────────────
    const maxW = 700;
    const maxH = 580;

    dW = imgW;
    dH = imgH;
    if (dW > maxW - pad * 2) { dW = maxW - pad * 2; dH = dW / aspect; }
    if (dH > maxH - pad * 2) { dH = maxH - pad * 2; dW = dH * aspect; }

    dW = Math.max(1, Math.round(dW));
    dH = Math.max(1, Math.round(dH));

    cW = dW + pad * 2;
    cH = dH + pad * 2;
    ix = pad;
    iy = pad;
  } else {
    // ── Preset ratio: fixed canvas, image centered ─────────
    cW = preset.cW;
    cH = preset.cH;

    const availW = Math.max(1, cW - pad * 2);
    const availH = Math.max(1, cH - pad * 2);

    if (aspect > availW / availH) {
      dW = availW;
      dH = Math.max(1, Math.round(availW / aspect));
    } else {
      dH = availH;
      dW = Math.max(1, Math.round(availH * aspect));
    }

    // Center image in canvas
    ix = Math.round((cW - dW) / 2);
    iy = Math.round((cH - dH) / 2);
  }

  // Size the pixel buffer at 2×
  els.canvas.width  = cW * SCALE;
  els.canvas.height = cH * SCALE;

  // Only set CSS width — height:auto prevents stretching on container resize
  els.canvas.style.width  = cW + "px";
  els.canvas.style.height = "";

  ctx.save();
  ctx.scale(SCALE, SCALE);

  // 1 — Solid background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, cW, cH);

  // 2 — Noise overlay (optional)
  if (state.settings.noise) {
    paintNoise(ctx, cW, cH);
  }

  // 3 — Shadow (fill a rounded rect to cast shadow beneath the image)
  const shadow = computeShadow(state.settings.shadow);
  if (shadow) {
    ctx.save();
    ctx.shadowColor   = shadow.color;
    ctx.shadowBlur    = shadow.blur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = shadow.offsetY;
    tracedRoundRect(ctx, ix, iy, dW, dH, r);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
  }

  // 4 — Image clipped to a rounded rect
  ctx.save();
  tracedRoundRect(ctx, ix, iy, dW, dH, r);
  ctx.clip();
  ctx.drawImage(img, ix, iy, dW, dH);
  ctx.restore();

  ctx.restore();
}

function tracedRoundRect(ctx, x, y, w, h, r) {
  const safe = Math.min(r, w / 2, h / 2); // clamp so it never exceeds half side
  ctx.beginPath();
  ctx.moveTo(x + safe, y);
  ctx.lineTo(x + w - safe, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + safe);
  ctx.lineTo(x + w, y + h - safe);
  ctx.quadraticCurveTo(x + w, y + h, x + w - safe, y + h);
  ctx.lineTo(x + safe, y + h);
  ctx.quadraticCurveTo(x, y + h,     x, y + h - safe);
  ctx.lineTo(x, y + safe);
  ctx.quadraticCurveTo(x, y,         x + safe, y);
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
 * Compress an HTMLImageElement down to a data URL that fits in localStorage.
 * Caps the longest dimension at 1 200 px; falls back from PNG to JPEG for
 * large images to stay under the ~5 MB localStorage quota.
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

  const off = document.createElement("canvas");
  off.width  = w;
  off.height = h;
  off.getContext("2d").drawImage(img, 0, 0, w, h);

  const png = off.toDataURL("image/png");
  if (png.length <= 600_000) return png;          // ≤ ~450 KB encoded — use PNG
  return off.toDataURL("image/jpeg", 0.88);       // fall back to JPEG
}

async function setImage(dataURL) {
  try {
    const img = await loadImgElement(dataURL);
    state.image = img;
    showPreview();
    render();
    // Compress before storing so large uploads don't silently exceed quota
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
    // crossOrigin = anonymous so we can call toDataURL() without tainting the canvas
    const img = await loadImgElement(url, "anonymous");

    // Rasterise to a data URL for persistence
    const off = document.createElement("canvas");
    off.width  = img.naturalWidth;
    off.height = img.naturalHeight;
    off.getContext("2d").drawImage(img, 0, 0);
    const dataURL = off.toDataURL("image/png");

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

  // Re-trigger entrance animation on each new image load
  els.frameWrap.style.animation = "none";
  requestAnimationFrame(() => { els.frameWrap.style.animation = ""; });
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
    els.fileInput.value = ""; // reset so same file can be re-selected
  });

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
    // Let the browser handle paste when typing in the URL field
    if (document.activeElement === els.urlInput) return;

    const items = Array.from(e.clipboardData.items);

    // Priority 1: raw image data (screenshot, copied image)
    const imageItem = items.find((it) => it.type.startsWith("image/"));
    if (imageItem) {
      e.preventDefault();
      handleFile(imageItem.getAsFile());
      return;
    }

    // Priority 2: plain text that looks like an image URL
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

/** Update the CSS --pct variable so the track fill matches the thumb position. */
function refreshSlider(slider) {
  const min = parseFloat(slider.min);
  const max = parseFloat(slider.max);
  const val = parseFloat(slider.value);
  const pct = ((val - min) / (max - min)) * 100;
  slider.style.setProperty("--pct", pct.toFixed(1) + "%");
}

/**
 * Wire a range slider and a number <input> together.
 * Either control updates state.settings[key], re-renders, and saves.
 */
function connectSlider(slider, numInput, key, min, max) {
  const apply = (raw) => {
    const val = Math.min(max, Math.max(min, Math.round(+raw)));
    if (!Number.isFinite(val)) return;
    state.settings[key] = val;
    slider.value         = val;
    numInput.value       = val;
    refreshSlider(slider);
    render();
    saveSession();
  };

  slider.addEventListener("input",   () => apply(slider.value));
  numInput.addEventListener("change", () => apply(numInput.value));
  numInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") numInput.blur();
  });
}

/* ── Controls ───────────────────────────────────────────────── */

function initControls() {
  // Canvas ratio
  els.ratioPicker.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip[data-ratio]");
    if (!chip) return;
    els.ratioPicker.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    state.settings.canvasRatio = chip.dataset.ratio;
    render();
    saveSession();
  });

  // Background colour
  els.bgColorInput.addEventListener("input", () => {
    state.settings.bgColor = els.bgColorInput.value;
    render();
    saveSession();
  });

  // Noise toggle
  els.noisePicker.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip[data-noise]");
    if (!chip) return;
    els.noisePicker.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    state.settings.noise = chip.dataset.noise === "true";
    render();
    saveSession();
  });

  // Sliders + number inputs
  connectSlider(els.paddingSlider, els.paddingVal, "padding", 0, 120);
  connectSlider(els.radiusSlider,  els.radiusVal,  "radius",  0,  60);
  connectSlider(els.shadowSlider,  els.shadowVal,  "shadow",  0, 100);
}

/** Push saved settings back into every UI control after session restore. */
function applySettingsToUI() {
  const { bgColor, noise, canvasRatio, padding, radius, shadow } = state.settings;

  els.bgColorInput.value = bgColor;

  syncChipPicker(els.ratioPicker, "ratio", canvasRatio);
  syncChipPicker(els.noisePicker, "noise", String(noise));

  els.paddingSlider.value = padding;
  els.paddingVal.value    = padding;
  refreshSlider(els.paddingSlider);

  els.radiusSlider.value = radius;
  els.radiusVal.value    = radius;
  refreshSlider(els.radiusSlider);

  els.shadowSlider.value = shadow;
  els.shadowVal.value    = shadow;
  refreshSlider(els.shadowSlider);
}

function syncChipPicker(container, dataKey, value) {
  container.querySelectorAll(`.chip[data-${dataKey}]`).forEach((c) => {
    c.classList.toggle("active", c.dataset[dataKey] === value);
  });
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
      const blob = await new Promise((res) => els.canvas.toBlob(res, "image/png"));
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

const SESSION_KEY = "cue_v3";

function saveSession() {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      settings:     state.settings,
      imageDataURL: state.imageDataURL,
    }));
  } catch { /* quota exceeded — fail silently */ }
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