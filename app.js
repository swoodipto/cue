/* ============================================================
   CUE — app.js
   State · Canvas · Upload · Clipboard · Controls · Export · Session
   ============================================================ */

"use strict";

/* ── Browser detection ──────────────────────────────────────── */

function isWebkitBrowser() {
  const ua = navigator.userAgent.toLowerCase();
  // Safari and WebKit-based browsers (but not Chrome/Edge which also have webkit in UA)
  return /safari/.test(ua) && !/chrome|edge|opera/.test(ua);
}

function getBrowserName() {
  return "WebKit-based browser";
}

/* ── State ──────────────────────────────────────────────────── */

const state = {
  image: null,        // HTMLImageElement currently displayed
  imageDataURL: null, // compressed data URL persisted to localStorage
  settings: {
    bgType:      "solid",   // "solid" | "blur"
    bgColor:     "#ffffff", // solid background colour
    blurAmount:  20,        // px — 4–80 (used when bgType === "blur")
    pattern:     "none",    // "none" | "noise" | "dots"
    patternScale: 10,       // 1–100 (multiplier /10 for actual scale)
    patternBlendMode: "normal", // "normal" | "overlay" | "screen"
    patternOpacity: 50,     // 1–100 ( /100 for actual opacity)
    canvasRatio: "free",    // "free" | "16:9" | "1:1" | "9:16" | "3:4"
    padding:     60,        // px — 0–120
    radius:      18,        // px — 0–60
    shadow:      40,        // 0–100 intensity
  },
};

/* ── Canvas size presets ────────────────────────────────────── */

const CANVAS_PRESETS = {
  "4:3":  { cW: 600, cH: 450 },
  "16:9": { cW: 640, cH: 360 },
  "1:1":  { cW: 560, cH: 560 },
  "9:16": { cW: 338, cH: 600 },
  "3:4":  { cW: 450, cH: 600 },
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

/* ── Pattern helpers ────────────────────────────────────────── */

/**
 * Return a semi-transparent colour that contrasts with the background —
 * dark on light backgrounds, light on dark ones.
 * Both noise and dots use this so the pattern always blends.
 * For blur backgrounds, use forBlur=true to get stronger contrast.
 */
function adaptivePatternColor(hexBg, forBlur = false) {
  if (!hexBg || hexBg.length < 7) return "rgba(0,0,0,0.2)";
  const r   = parseInt(hexBg.slice(1, 3), 16) / 255;
  const g   = parseInt(hexBg.slice(3, 5), 16) / 255;
  const b   = parseInt(hexBg.slice(5, 7), 16) / 255;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  // For blur backgrounds, use stronger opacity since the blurred content
  // can be variable. For solid backgrounds, use full opacity.
  if (forBlur) {
    return lum > 0.5
      ? `rgba(0,0,0,1.0)`
      : `rgba(255,255,255,1.0)`;
  }
  return lum > 0.5
    ? `rgba(0,0,0,1.0)`
    : `rgba(255,255,255,1.0)`;
}

/**
 * Noise: rendered on an offscreen canvas then composited with "overlay"
 * so it automatically picks up the hue of whatever colour is underneath.
 * drawImage (unlike putImageData) respects the current transform, so the
 * logical w×h fills the full 2× physical canvas correctly.
 */
function paintNoise(ctx, w, h, scale = 1, blendMode = "overlay", opacity = 1) {
  const off = document.createElement("canvas");
  off.width  = w;
  off.height = h;
  const oc = off.getContext("2d");
  const d  = oc.createImageData(w, h);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.random() * 255 | 0;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255; // fully opaque — overlay handles the tint
  }
  oc.putImageData(d, 0, 0);

  const prevOp    = ctx.globalCompositeOperation;
  const prevAlpha = ctx.globalAlpha;
  ctx.globalCompositeOperation = blendMode;
  ctx.globalAlpha = opacity * scale;
  ctx.drawImage(off, 0, 0, w, h);
  ctx.globalCompositeOperation = prevOp;
  ctx.globalAlpha = prevAlpha;
}

/**
 * Dot grid: evenly-spaced small circles whose colour is computed from
 * adaptivePatternColor so they always complement the background.
 */
function paintDotGrid(ctx, w, h, dotColor, scale = 1, blendMode = "overlay", opacity = 1) {
  const spacing = 20 * scale;
  const radius  = 1.4 * scale;
  const prevOp    = ctx.globalCompositeOperation;
  const prevAlpha = ctx.globalAlpha;
  ctx.globalCompositeOperation = blendMode;
  ctx.globalAlpha = opacity;
  ctx.fillStyle = dotColor;
  ctx.beginPath();
  for (let x = spacing / 2; x < w; x += spacing) {
    for (let y = spacing / 2; y < h; y += spacing) {
      ctx.moveTo(x + radius, y);
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    }
  }
  ctx.fill();
  ctx.globalCompositeOperation = prevOp;
  ctx.globalAlpha = prevAlpha;
}

/**
 * Blurred image background: draws the source image scaled to cover the
 * entire canvas, blurred, on an oversized offscreen canvas so the Gaussian
 * kernel never bleeds to transparency at the edges.
 */
function paintBlurredBackground(ctx, img, cW, cH, blurPx) {
  const pad = Math.ceil(blurPx * 3); // enough margin so edge-fade is invisible

  // 1 — Draw the image (cover-scaled) onto a padded offscreen canvas
  const off = document.createElement("canvas");
  off.width  = cW + pad * 2;
  off.height = cH + pad * 2;
  const oc = off.getContext("2d");

  const imgAspect = img.naturalWidth / img.naturalHeight;
  const offAspect = off.width / off.height;
  let dW, dH;
  if (imgAspect > offAspect) {
    dH = off.height;
    dW = dH * imgAspect;
  } else {
    dW = off.width;
    dH = dW / imgAspect;
  }
  oc.drawImage(img, (off.width - dW) / 2, (off.height - dH) / 2, dW, dH);

  // 2 — Blur onto a second offscreen (filter on drawImage blurs the source pixels)
  const blurred = document.createElement("canvas");
  blurred.width  = off.width;
  blurred.height = off.height;
  const bc = blurred.getContext("2d");
  bc.filter = `blur(${blurPx}px)`;
  bc.drawImage(off, 0, 0);
  bc.filter = "none";

  // 3 — Stamp only the centre (non-faded) region onto the main canvas.
  //     ctx is inside scale(SCALE,SCALE) so the 1× source is upscaled correctly.
  ctx.drawImage(blurred, pad, pad, cW, cH, 0, 0, cW, cH);
}

/* ── DOM refs ───────────────────────────────────────────────── */

const $ = (id) => document.getElementById(id);

const els = {
  uploadZone:    $("uploadZone"),
  fileInput:     $("fileInput"),
  browseBtn:     $("browseBtn"),
  emptyState:    $("emptyState"),
  previewArea:   $("previewArea"),
  frameWrap:     $("frameWrap"),
  canvas:        $("previewCanvas"),
  exportBtn:     $("exportBtn"),
  copyBtn:       $("copyBtn"),
  toast:         $("toast"),
  panel:         $("panel"),
  resetBtn:      $("resetBtn"),
  sectionStyle:  $("section-style"),
  sectionExport: $("section-export"),
  // Appearance controls
  ratioPicker:   $("ratioPicker"),
  bgTypePicker:  $("bgTypePicker"),
  bgColorInput:  $("bgColorInput"),
  bgColorControl: $("bgColorControl"),
  bgBlurControl:  $("bgBlurControl"),
  patternPicker: $("patternPicker"),
  patternScaleControl: $("patternScaleControl"),
  patternScaleSlider: $("patternScaleSlider"),
  patternScaleVal: $("patternScaleVal"),
  patternBlendControl: $("patternBlendControl"),
  patternBlendPicker: $("patternBlendPicker"),
  patternOpacityControl: $("patternOpacityControl"),
  patternOpacitySlider: $("patternOpacitySlider"),
  patternOpacityVal: $("patternOpacityVal"),
  blurControl:   $("blurControl"), // old, remove?
  blurSlider:    $("blurSlider"),
  blurVal:       $("blurVal"),
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
  const { bgType, bgColor, blurAmount, pattern, patternScale, patternBlendMode, patternOpacity } = state.settings;
  const scale = patternScale / 10;
  const opacity = patternOpacity / 100;

  const imgW   = img.naturalWidth;
  const imgH   = img.naturalHeight;
  const aspect = imgW / imgH;

  let cW, cH, dW, dH, ix, iy;

  const preset = CANVAS_PRESETS[state.settings.canvasRatio];

  if (!preset) {
    // ── Free: canvas sized to original image at full resolution ──
    // No downscaling — display at 1:1 for crisp text and details
    dW = imgW;
    dH = imgH;
    cW = dW + pad * 2;
    cH = dH + pad * 2;
    ix = pad;
    iy = pad;
  } else {
    // ── Preset ratio: scale up for large images to avoid blur ──
    cW = preset.cW;
    cH = preset.cH;

    // Scale preset based on image size to prevent downscaling blur
    const baseSize = 560; // reference preset size
    const maxImageDim = Math.max(imgW, imgH);
    const scale = Math.max(1, maxImageDim / baseSize);

    cW = Math.round(cW * scale);
    cH = Math.round(cH * scale);

    const availW = Math.max(1, cW - pad * 2);
    const availH = Math.max(1, cH - pad * 2);

    // Fit image into available space while preserving its aspect ratio
    if (aspect > availW / availH) {
      dW = availW;
      dH = Math.max(1, Math.round(availW / aspect));
    } else {
      dH = availH;
      dW = Math.max(1, Math.round(availH * aspect));
    }

    ix = Math.round((cW - dW) / 2);
    iy = Math.round((cH - dH) / 2);
  }

  // Size the pixel buffer at 2×
  els.canvas.width  = cW * SCALE;
  els.canvas.height = cH * SCALE;

  // Display the canvas with responsive scaling so it always fits in the
  // preview window, even for very tall or wide images.
  const previewW = Math.max(1, els.previewArea.clientWidth - 24);
  const previewH = Math.max(1, els.previewArea.clientHeight - 24);
  let displayW = cW;
  let displayH = cH;
  const displayRatio = cW / cH;

  if (displayW > previewW) {
    displayW = previewW;
    displayH = Math.round(displayW / displayRatio);
  }
  if (displayH > previewH) {
    displayH = previewH;
    displayW = Math.round(displayH * displayRatio);
  }

  els.canvas.style.width  = displayW + "px";
  els.canvas.style.height = displayH + "px";

  ctx.save();
  ctx.scale(SCALE, SCALE);

  // 1 — Background
  if (bgType === "solid") {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cW, cH);
  } else if (bgType === "blur") {
    paintBlurredBackground(ctx, img, cW, cH, blurAmount);
  }

  // 2 — Optional pattern (background-only)
  if (pattern === "noise") {
    paintNoise(ctx, cW, cH, scale, patternBlendMode, opacity);
  } else if (pattern === "dots") {
    paintDotGrid(ctx, cW, cH, adaptivePatternColor(bgColor, bgType === "blur"), scale, patternBlendMode, opacity);
  }

  // 3 — Composite image + shadow in one pass via an offscreen canvas.
  //
  //     Why offscreen?  ctx.clip() also clips the shadow, so an external
  //     shadow drawn with clip active is silently discarded.  By rendering
  //     the corner-clipped image into a small offscreen first and then
  //     stamping *that* onto the main canvas with the shadow, the shadow
  //     extends freely outside the rounded rect while the image itself
  //     stays cleanly clipped.
  //
  //     Why no white fill?  The offscreen is transparent where the source
  //     image is transparent, so the shadow follows the actual visible
  //     content.  Transparent PNGs no longer show a white bounding box.
  const imgOff = document.createElement("canvas");
  imgOff.width  = dW;
  imgOff.height = dH;
  const imgOc  = imgOff.getContext("2d");
  tracedRoundRect(imgOc, 0, 0, dW, dH, r);
  imgOc.clip();
  imgOc.drawImage(img, 0, 0, dW, dH);

  const shadow = computeShadow(state.settings.shadow);
  ctx.save();
  if (shadow) {
    ctx.shadowColor   = shadow.color;
    ctx.shadowBlur    = shadow.blur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = shadow.offsetY;
  }
  ctx.drawImage(imgOff, ix, iy, dW, dH);
  ctx.restore();

  ctx.restore();
}

function tracedRoundRect(ctx, x, y, w, h, r) {
  const safe = Math.min(r, w / 2, h / 2);
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
 * Return the image as a compressed JPEG data URL for storage efficiency.
 * Large images get stored as JPEG at 85% quality to fit localStorage quota.
 */
function toStorageURL(img) {
  const off = document.createElement("canvas");
  off.width  = img.naturalWidth;
  off.height = img.naturalHeight;
  off.getContext("2d").drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
  return off.toDataURL("image/jpeg", 0.85);
}

async function setImage(dataURL) {
  try {
    const img = await loadImgElement(dataURL);
    state.image = img;
    showPreview();
    render();
    // Compress before storing so large uploads don't exceed quota silently
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

/* ── URL loading (clipboard-triggered, no dedicated input field) */

async function loadFromURL(url) {
  url = url.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) return;

  showToast("Loading image…");
  try {
    const img = await loadImgElement(url, "anonymous");
    // For URL-loaded images, use the URL directly as the source
    // This avoids creating huge data URLs for large images
    state.image = img;
    showPreview();
    render();
    // Still compress for storage, but the display uses the original
    state.imageDataURL = toStorageURL(img);
    saveSession();
  } catch {
    showToast("Couldn't load that URL — make sure it's a direct image link.");
  }
}

/* ── Show / hide preview ────────────────────────────────────── */

function showPreview() {
  els.emptyState.classList.add("hidden");
  els.frameWrap.classList.remove("hidden");
  els.panel.classList.remove("hidden");
  els.resetBtn.classList.remove("hidden");
  els.sectionStyle.classList.remove("hidden");
  els.sectionExport.classList.remove("hidden");

  // Re-trigger entrance animation on each new image load
  els.frameWrap.style.animation = "none";
  requestAnimationFrame(() => { els.frameWrap.style.animation = ""; });
}

function playPasteAnimation() {
  const target = state.image ? els.frameWrap : els.uploadZone;
  target.classList.remove("paste-animate");
  void target.offsetWidth;
  target.classList.add("paste-animate");
  target.addEventListener("animationend", () => {
    target.classList.remove("paste-animate");
  }, { once: true });
}

function resetCanvas() {
  state.image        = null;
  state.imageDataURL = null;

  els.frameWrap.classList.add("hidden");
  els.emptyState.classList.remove("hidden");
  els.panel.classList.add("hidden");
  els.resetBtn.classList.add("hidden");
  els.sectionStyle.classList.add("hidden");
  els.sectionExport.classList.add("hidden");

  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  saveSession();
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

/* ── Clipboard paste (⌘V / Ctrl+V anywhere) ─────────────────── */

function initClipboard() {
  document.addEventListener("paste", (e) => {
    const items = Array.from(e.clipboardData.items);

    // Priority 1: raw image data (screenshot, copied image)
    const imageItem = items.find((it) => it.type.startsWith("image/"));
    if (imageItem) {
      e.preventDefault();
      playPasteAnimation();
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
          loadFromURL(trimmed);
        }
      });
    }
  });
}

/* ── Slider helpers ─────────────────────────────────────────── */

/** Update the CSS --pct variable so the track fill matches the thumb. */
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
  slider.addEventListener("input",    () => apply(slider.value));
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

  // Background type
  els.bgTypePicker.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip[data-bg-type]");
    if (!chip) return;

    // Check if trying to select blur on webkit browser
    if (chip.dataset.bgType === "blur" && isWebkitBrowser()) {
      showToast(`Blur isn't supported in ${getBrowserName()}, please use Chrome or Firefox based browsers.`);
      return;
    }

    els.bgTypePicker.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    state.settings.bgType = chip.dataset.bgType;
    els.bgColorControl.classList.toggle("hidden", chip.dataset.bgType !== "solid");
    els.bgBlurControl.classList.toggle("hidden", chip.dataset.bgType !== "blur");
    render();
    saveSession();
  });

  // Background colour
  els.bgColorInput.addEventListener("input", () => {
    state.settings.bgColor = els.bgColorInput.value;
    render();
    saveSession();
  });

  // Pattern picker (none / noise / dots)
  els.patternPicker.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip[data-pattern]");
    if (!chip) return;
    els.patternPicker.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    state.settings.pattern = chip.dataset.pattern;
    const hasPattern = chip.dataset.pattern !== "none";
    els.patternScaleControl.classList.toggle("hidden", !hasPattern);
    els.patternBlendControl.classList.toggle("hidden", !hasPattern);
    els.patternOpacityControl.classList.toggle("hidden", !hasPattern);
    render();
    saveSession();
  });

  // Pattern blend mode picker
  els.patternBlendPicker.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip[data-blend]");
    if (!chip) return;
    els.patternBlendPicker.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    state.settings.patternBlendMode = chip.dataset.blend;
    render();
    saveSession();
  });

  // Blur amount slider (only visible when bgType === "blur")
  connectSlider(els.blurSlider, els.blurVal, "blurAmount", 4, 80);

  // Pattern scale slider (only visible when pattern !== "none")
  connectSlider(els.patternScaleSlider, els.patternScaleVal, "patternScale", 1, 100);

  // Pattern opacity slider (only visible when pattern !== "none")
  connectSlider(els.patternOpacitySlider, els.patternOpacityVal, "patternOpacity", 1, 100);

  // Sliders + number inputs
  connectSlider(els.paddingSlider, els.paddingVal, "padding", 0, 120);
  connectSlider(els.radiusSlider,  els.radiusVal,  "radius",  0,  60);
  connectSlider(els.shadowSlider,  els.shadowVal,  "shadow",  0, 100);

  // Reset button
  els.resetBtn.addEventListener("click", resetCanvas);
}

/** Push saved settings back into every UI control after session restore. */
function applySettingsToUI() {
  const { bgType, bgColor, pattern, canvasRatio, padding, radius, shadow, blurAmount, patternScale, patternBlendMode, patternOpacity } = state.settings;

  els.bgColorInput.value = bgColor;

  syncChipPicker(els.bgTypePicker,  "bg-type", bgType);
  syncChipPicker(els.ratioPicker,    "ratio",   canvasRatio);
  syncChipPicker(els.patternPicker,  "pattern", pattern);

  // Show controls based on selections
  els.bgColorControl.classList.toggle("hidden", bgType !== "solid");
  els.bgBlurControl.classList.toggle("hidden", bgType !== "blur");
  const hasPattern = pattern !== "none";
  els.patternScaleControl.classList.toggle("hidden", !hasPattern);
  els.patternBlendControl.classList.toggle("hidden", !hasPattern);
  els.patternOpacityControl.classList.toggle("hidden", !hasPattern);

  syncChipPicker(els.patternBlendPicker, "blend", patternBlendMode);

  els.blurSlider.value = blurAmount;
  els.blurVal.value    = blurAmount;
  refreshSlider(els.blurSlider);

  els.patternScaleSlider.value = patternScale;
  els.patternScaleVal.value    = patternScale;
  refreshSlider(els.patternScaleSlider);

  els.patternOpacitySlider.value = patternOpacity;
  els.patternOpacityVal.value    = patternOpacity;
  refreshSlider(els.patternOpacitySlider);

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

const SESSION_KEY = "cue_v5";

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
      // Migrate old blur pattern to new bgType
      if (saved.settings.pattern === "blur") {
        saved.settings.bgType = "blur";
        saved.settings.pattern = "none";
      }
      // Disable blur in webkit browsers
      if (saved.settings.bgType === "blur" && isWebkitBrowser()) {
        saved.settings.bgType = "solid";
      }
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

/* ── Resize — re-render on container size change ────────────── */

let resizeTimer = null;

window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (state.image) render(); }, 120);
});

/* ── Init ───────────────────────────────────────────────────── */

function init() {
  // Disable blur option in webkit browsers
  if (isWebkitBrowser()) {
    const blurChip = document.querySelector('.chip[data-bg-type="blur"]');
    if (blurChip) {
      blurChip.style.opacity = "0.5";
      blurChip.style.cursor = "not-allowed";
      blurChip.title = `Blur isn't supported in ${getBrowserName()}, please use Chrome or Firefox based browsers.`;
    }
  }

  // Initialise slider track fills from their default HTML values
  refreshSlider(els.paddingSlider);
  refreshSlider(els.radiusSlider);
  refreshSlider(els.shadowSlider);
  refreshSlider(els.blurSlider);
  refreshSlider(els.patternScaleSlider);
  refreshSlider(els.patternOpacitySlider);

  initUpload();
  initClipboard();
  initControls();
  initExport();
  restoreSession();
}

document.addEventListener("DOMContentLoaded", init);
