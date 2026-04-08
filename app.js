/* ============================================================
   CUE — app.js
   State · Canvas · Upload · URL load · Clipboard · Controls · Export · Session
   ============================================================ */

"use strict";

/* ── State ──────────────────────────────────────────────────── */

const state = {
  image: null,         // HTMLImageElement currently displayed
  imageDataURL: null,  // base64 data URL for session persistence
  settings: {
    bg: "white",
    padding: "medium",
    radius: "medium",
    shadow: "soft",
    customGradient: null, // [colorA, colorB] set by shuffle
  },
};

/* ── Config maps ────────────────────────────────────────────── */

const PADDING_MAP = { tight: 28, medium: 60, wide: 96 };
const RADIUS_MAP  = { small: 8,  medium: 18, large: 32 };

const SHADOW_MAP = {
  off:    null,
  soft:   { color: "rgba(0,0,0,0.13)", blur: 40, offsetY: 16 },
  strong: { color: "rgba(0,0,0,0.30)", blur: 72, offsetY: 28 },
};

/* Return a function (ctx, w, h) => void that fills the background */
function getBgPainter(settings) {
  const { bg, customGradient } = settings;

  if (bg === "custom" && customGradient) {
    return (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, customGradient[0]);
      g.addColorStop(1, customGradient[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };
  }

  const painters = {
    white(ctx, w, h) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    },
    warm(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#fdf6ec");
      g.addColorStop(1, "#fce8d5");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    cool(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#eef2ff");
      g.addColorStop(1, "#dbeafe");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    gradient(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0,   "#f0fdf4");
      g.addColorStop(0.5, "#fdf4ff");
      g.addColorStop(1,   "#fff7ed");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      paintNoise(ctx, w, h, 0.025);
    },
    dark(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#1a1a2e");
      g.addColorStop(1, "#0f0f1a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  };

  return painters[bg] || painters.white;
}

function paintNoise(ctx, w, h, alpha) {
  const data = ctx.createImageData(w, h);
  const buf  = data.data;
  for (let i = 0; i < buf.length; i += 4) {
    const v = Math.random() * 255;
    buf[i] = buf[i + 1] = buf[i + 2] = v;
    buf[i + 3] = alpha * 255;
  }
  ctx.putImageData(data, 0, 0);
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
  bgPicker:      $("bgPicker"),
  paddingPicker: $("paddingPicker"),
  radiusPicker:  $("radiusPicker"),
  shadowPicker:  $("shadowPicker"),
  shuffleBtn:    $("shuffleBtn"),
};

const ctx = els.canvas.getContext("2d");

/* ── Canvas render ──────────────────────────────────────────── */

const SCALE = 2; // export at 2× for retina sharpness

function render() {
  if (!state.image) return;

  const img  = state.image;
  const pad  = PADDING_MAP[state.settings.padding];
  const r    = RADIUS_MAP[state.settings.radius];

  const imgW   = img.naturalWidth;
  const imgH   = img.naturalHeight;
  const aspect = imgW / imgH;

  // Compute display dimensions, capped at a sensible max
  const maxW = 700;
  const maxH = 580;

  let dW = imgW;
  let dH = imgH;

  if (dW > maxW - pad * 2) { dW = maxW - pad * 2; dH = dW / aspect; }
  if (dH > maxH - pad * 2) { dH = maxH - pad * 2; dW = dH * aspect; }

  dW = Math.round(dW);
  dH = Math.round(dH);

  const cW = dW + pad * 2;
  const cH = dH + pad * 2;

  // Size the canvas (2× backing store)
  els.canvas.width        = cW * SCALE;
  els.canvas.height       = cH * SCALE;
  els.canvas.style.width  = cW + "px";
  els.canvas.style.height = cH + "px";

  ctx.save();
  ctx.scale(SCALE, SCALE);

  // 1 — Background
  getBgPainter(state.settings)(ctx, cW, cH);

  // 2 — Shadow (draw a filled rounded rect to cast it)
  const shadow = SHADOW_MAP[state.settings.shadow];
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

  // 3 — Image clipped to rounded rect
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

async function setImage(dataURL) {
  try {
    const img = await loadImgElement(dataURL);
    state.image       = img;
    state.imageDataURL = dataURL;
    showPreview();
    render();
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
    // Load with crossOrigin so we can draw to canvas without tainting it
    const img = await loadImgElement(url, "anonymous");

    // Rasterise to data URL so it can be persisted in localStorage
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

/* ── Show / hide preview ────────────────────────────────────── */

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
  // Click zone → open picker (but not if they clicked the browse button itself)
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

  // Global drag-and-drop (drop anywhere on the page)
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

  // Clear hint while user is typing a new URL
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
    // If the user is actively typing in the URL input, let the browser handle it
    if (document.activeElement === els.urlInput) return;

    const items = Array.from(e.clipboardData.items);

    // Priority 1: raw image data (screenshot, copied image)
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (imageItem) {
      e.preventDefault();
      handleFile(imageItem.getAsFile());
      return;
    }

    // Priority 2: plain text that looks like a URL
    const textItem = items.find((item) => item.type === "text/plain");
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

/* ── Controls ───────────────────────────────────────────────── */

function initControls() {
  // Generic chip-picker factory: clicking a chip updates state and re-renders
  function initPicker(containerId, stateKey) {
    const container = $(containerId);
    container.addEventListener("click", (e) => {
      const chip = e.target.closest(`.chip[data-${stateKey}]`);
      if (!chip) return;

      container.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");

      state.settings[stateKey]        = chip.dataset[stateKey];
      state.settings.customGradient   = null; // clear random gradient on preset pick
      render();
      saveSession();
    });
  }

  initPicker("bgPicker",      "bg");
  initPicker("paddingPicker", "padding");
  initPicker("radiusPicker",  "radius");
  initPicker("shadowPicker",  "shadow");

  // Shuffle button — generate a random pastel gradient
  els.shuffleBtn.addEventListener("click", () => {
    const a = randomPastel();
    const b = randomPastel();

    state.settings.bg             = "custom";
    state.settings.customGradient = [a, b];

    // Deactivate all bg preset chips so none appears selected
    els.bgPicker.querySelectorAll(".chip[data-bg]").forEach((c) =>
      c.classList.remove("active")
    );

    render();
    saveSession();
  });
}

function randomPastel() {
  const h = Math.floor(Math.random() * 360);
  const s = 35 + Math.floor(Math.random() * 30); // 35–65 %
  const l = 82 + Math.floor(Math.random() * 12); // 82–94 %
  return `hsl(${h},${s}%,${l}%)`;
}

function applySettingsToUI() {
  const { bg, padding, radius, shadow } = state.settings;
  syncPicker("bgPicker",      "bg",      bg);
  syncPicker("paddingPicker", "padding", padding);
  syncPicker("radiusPicker",  "radius",  radius);
  syncPicker("shadowPicker",  "shadow",  shadow);
}

function syncPicker(containerId, dataKey, value) {
  const container = $(containerId);
  if (!container) return;
  container.querySelectorAll(`.chip[data-${dataKey}]`).forEach((c) => {
    c.classList.toggle("active", c.dataset[dataKey] === value);
  });
}

/* ── Export ─────────────────────────────────────────────────── */

function initExport() {
  els.exportBtn.addEventListener("click", () => {
    if (!state.image) return;
    const link      = document.createElement("a");
    link.download   = "cue-export.png";
    link.href       = els.canvas.toDataURL("image/png");
    link.click();
    showToast("Downloaded ✓");
  });

  els.copyBtn.addEventListener("click", async () => {
    if (!state.image) return;
    try {
      const blob = await new Promise((resolve) =>
        els.canvas.toBlob(resolve, "image/png")
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

const SESSION_KEY = "cue_v1";

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
    // Storage quota exceeded — fail silently
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
  initUpload();
  initURLInput();
  initClipboard();
  initControls();
  initExport();
  restoreSession();
}

document.addEventListener("DOMContentLoaded", init);
