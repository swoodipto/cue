import { definePatch, ensureReady, setMasterVolume } from "./vendor/web-kits-audio.js";
import minimalPatch from "./patches/minimal-patch.js";

/* ============================================================
   CUE — app.js
   State · Canvas · Upload · Clipboard · Controls · Export · Session
   ============================================================ */

"use strict";

/* ── State ──────────────────────────────────────────────────── */

const state = {
  image: null,        // HTMLImageElement currently displayed
  imageDataURL: null, // compressed data URL persisted to localStorage
  logoImage: null,
  logoDataURL: null,
  isDemo: true,
  imageLabel: "demo-image.png",
  settings: null,
  overlaySizeAutoFit: false,
  pendingLogoAutoFit: false,
  canvasBlurMode: "software", // "native" | "software"
  blurCache: null,
};

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

const DEFAULT_SETTINGS = {
  bgType:      "solid",   // "solid" | "gradient" | "blur"
  bgColor:     "#ffffff", // solid background colour
  bgGradientStartColor: "#d8e5f2",
  bgGradientEndColor: "#f7d8c3",
  bgGradientDirection: "to-bottom-right",
  blurAmount:  20,        // px — 4–80 (used when bgType === "blur")
  pattern:     "none",    // "none" | "noise" | "dots" | "grid"
  patternColor: adaptivePatternColor("#ffffff"),
  patternScale: 10,       // 1–100 (multiplier /10 for actual scale)
  patternBlendMode: "normal", // "normal" | "overlay" | "hard-light" | "screen"
  patternOpacity: 50,     // 1–100 ( /100 for actual opacity)
  canvasRatio: "free",    // "free" | "16:9" | "1:1" | "9:16" | "3:4"
  padding:     60,        // px — 0–120
  radius:      18,        // px — 0–60
  shadow:      40,        // 0–100 intensity
  shadowSpread: 0,        // px — code-only, supports negative values like CSS spread
  overlayType: "none",    // "none" | "text" | "logo"
  overlayText: "Your brand",
  overlayFont: "sans-serif",
  overlayColor: "#ffffff",
  overlayBlendMode: "none", // "none" | "overlay" | "screen"
  overlaySize: 18,        // percentage of canvas width
  overlayEdgeDistance: 0,  // px of extra inset from the canvas edge
  overlayOpacity: 70,     // 10–100
  overlayPosition: "bottom-right", // corners | edges
  soundEnabled: !prefersReducedMotion(),
};

state.settings = { ...DEFAULT_SETTINGS };

const DEMO_IMAGES = [
  {
    src: "./assets/demo-ios-icon.png",
    label: "demo-ios-icon.png",
    settings: {
      bgColor: "#f0efeb",
      canvasRatio: "1:1",
      padding: 78,
      radius: 26,
      shadow: 28,
    },
  },
  {
    src: "./assets/demo-zettel.png",
    label: "demo-screenshot.png",
    settings: {
      bgColor: "#d7dbe0",
      canvasRatio: "free",
      padding: 100,
      radius: 0,
      shadow: 60,
    },
  },
  {
    src: "./assets/tweet.png",
    label: "demo-tweet.png",
    settings: {
      bgColor: "#79BC1C",
      canvasRatio: "4:3",
      padding: 100,
      radius: 10,
      shadow: 100,
    },
  },
];

const OVERLAY_SIZE_LIMITS = {
  none: 30,
  text: 30,
  logo: 30,
};
const OVERLAY_FONT_STACKS = {
  "sans-serif": 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  handwritten: '"Bradley Hand", "Segoe Print", "Comic Sans MS", "Marker Felt", cursive',
  monospace: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
};
const OVERLAY_BLEND_MODES = new Set(["none", "overlay", "screen"]);
const OVERLAY_SIZE_MIN = 1;
const OVERLAY_EDGE_DISTANCE_MIN = 0;
const OVERLAY_AUTO_FILL = 0.92;
const OVERLAY_TEXT_LINE_HEIGHT = 1.15;
const OVERLAY_TEXT_KERNING_EM = -0.045; // Negative values tighten text; scales with font size.
const OVERLAY_TEXT_SEGMENTER = typeof Intl !== "undefined" && Intl.Segmenter
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
  : null;
const OVERLAY_FALLBACK_LOGO_ASPECT = 1;
const OVERLAY_AREA_INSET_RATIO = 0.14;

const BLUR_SOFTWARE_PIXEL_BUDGET = 360000;
const BLUR_SOFTWARE_MAX_SCALE = 8;

/* ── Canvas size presets ────────────────────────────────────── */

const CANVAS_PRESETS = {
  "4:3":  { cW: 600, cH: 450 },
  "16:9": { cW: 640, cH: 360 },
  "1:1":  { cW: 560, cH: 560 },
  "9:16": { cW: 338, cH: 600 },
  "3:4":  { cW: 450, cH: 600 },
};

/* ── Audio feedback ─────────────────────────────────────────── */

const SOUND_MASTER_VOLUME = 1;
const SLIDER_SOUND_INTERVAL_MS = 60;
const MANUAL_UNLOCK_AFTER_ATTEMPTS = 2;

function isAppleMobile() {
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const touchPoints = navigator.maxTouchPoints || 0;

  return /iPhone|iPad|iPod/i.test(userAgent)
    || (platform === "MacIntel" && touchPoints > 1);
}

const appleMobile = isAppleMobile();

const UI_SOUNDS = {
  chip: "tab-switch",
  slider: "tap",
  soundOn: "toggle-on",
  soundOff: "toggle-off",
  import: "page-enter",
  copy: "copy",
  download: "success",
  error: "error",
  reset: "undo",
};

const soundState = {
  patch: definePatch(minimalPatch),
  priming: null,
  ready: false,
  pending: null,
  unlockAttempts: 0,
  showManualUnlock: false,
};
const sliderSoundTimestamps = new WeakMap();

function removeAudioUnlockListeners(handler) {
  document.removeEventListener("pointerdown", handler, true);
  document.removeEventListener("pointerup", handler, true);
  document.removeEventListener("touchstart", handler, true);
  document.removeEventListener("touchend", handler, true);
  document.removeEventListener("click", handler, true);
  document.removeEventListener("keydown", handler, true);
}

function showManualUnlockFallback() {
  if (!appleMobile || soundState.ready) return;
  if (soundState.unlockAttempts < MANUAL_UNLOCK_AFTER_ATTEMPTS) return;
  if (soundState.showManualUnlock) return;
  soundState.showManualUnlock = true;
  updateSoundUI();
}

function unlockAudio() {
  if (soundState.ready) return Promise.resolve(true);
  if (!state.settings?.soundEnabled) return Promise.resolve(false);
  if (!soundState.priming) {
    setMasterVolume(SOUND_MASTER_VOLUME);
    updateSoundUI();
    soundState.priming = ensureReady()
      .then(() => {
        soundState.ready = true;
        soundState.showManualUnlock = false;

        // iOS can be picky even after resume; a near-silent warmup helps
        // establish the graph once within the trusted gesture.
        try {
          soundState.patch.play(UI_SOUNDS.slider, { volume: 0.0001 });
        } catch {
          // Ignore warmup failures and rely on the next real sound.
        }

        if (soundState.pending) {
          const { name, volume } = soundState.pending;
          soundState.pending = null;
          try {
            soundState.patch.play(name, { volume });
          } catch {
            // Ignore queued replay failures.
          }
        }

        updateSoundUI();
        return true;
      })
      .catch(() => {
        soundState.ready = false;
        showManualUnlockFallback();
        updateSoundUI();
        return false;
      })
      .finally(() => {
        if (!soundState.ready) {
          soundState.priming = null;
        }
        showManualUnlockFallback();
        updateSoundUI();
      });
  }
  return soundState.priming;
}

function primeAudioOnFirstGesture() {
  const handleFirstGesture = () => {
    if (!state.settings?.soundEnabled || soundState.ready) return;
    soundState.unlockAttempts += 1;

    if (appleMobile) {
      try {
        // Fire a nearly silent cue directly inside the first ordinary tap.
        // This keeps the unlock path automatic for iOS without adding a step.
        soundState.patch.play(UI_SOUNDS.slider, { volume: 0.0001 });
      } catch {
        // Ignore warmup failures and keep trying on later gestures.
      }
    }

    void unlockAudio();
  };

  const stopWhenReady = setInterval(() => {
    if (!soundState.ready) return;
    clearInterval(stopWhenReady);
    removeAudioUnlockListeners(handleFirstGesture);
  }, 500);

  document.addEventListener("pointerdown", handleFirstGesture, { passive: true, capture: true });
  document.addEventListener("pointerup", handleFirstGesture, { passive: true, capture: true });
  document.addEventListener("touchstart", handleFirstGesture, { passive: true, capture: true });
  document.addEventListener("touchend", handleFirstGesture, { passive: true, capture: true });
  document.addEventListener("click", handleFirstGesture, { passive: true, capture: true });
  document.addEventListener("keydown", handleFirstGesture, true);
}

function playSound(name, volume = 1) {
  if (!state.settings?.soundEnabled) return;
  if (soundState.ready) {
    try {
      soundState.patch.play(name, { volume });
    } catch {
      // Audio is additive UI polish, so failures should stay silent.
    }
    return;
  }

  soundState.pending = { name, volume };
  void unlockAudio()
    .then((isReady) => {
      if (!isReady) return;
      if (!soundState.pending) return;
      const next = soundState.pending;
      soundState.pending = null;
      soundState.patch.play(next.name, { volume: next.volume });
    })
    .catch(() => {
      // Audio is additive UI polish, so failures should stay silent.
    });
}

function updateSoundUI() {
  if (!els.soundUnlockControl || !els.soundUnlockBtn || !els.soundUnlockHint || !els.soundHelperText) {
    return;
  }

  const soundEnabled = !!state.settings?.soundEnabled;
  const needsUnlock = soundEnabled && !soundState.ready && soundState.showManualUnlock;

  els.soundUnlockControl.classList.toggle("hidden", !needsUnlock);
  els.soundUnlockBtn.disabled = !!soundState.priming;
  els.soundUnlockBtn.textContent = soundState.priming
    ? "Enabling Sound..."
    : "Enable Sound on This Device";

  if (!soundEnabled) {
    els.soundHelperText.textContent = "Sound effects are turned off.";
    els.soundUnlockHint.textContent = "Turn sounds on to enable UI feedback.";
    return;
  }

  if (soundState.ready) {
    els.soundHelperText.textContent = "Subtle cues for uploads, control changes, and export.";
    els.soundUnlockHint.textContent = "Sound is ready on this device.";
    return;
  }

  if (appleMobile && !soundState.showManualUnlock) {
    els.soundHelperText.textContent = "Subtle cues for uploads, control changes, and export. Sound should start automatically on your first tap.";
    els.soundUnlockHint.textContent = "If iPhone still blocks sound, the manual enable button will appear here.";
    return;
  }

  if (!appleMobile && !soundState.showManualUnlock) {
    els.soundHelperText.textContent = "Subtle cues for uploads, control changes, and export.";
    els.soundUnlockHint.textContent = "Sound is still getting ready on this device.";
    return;
  }

  if (soundState.priming) {
    els.soundHelperText.textContent = "Trying to enable sound for this device.";
    els.soundUnlockHint.textContent = "If nothing happens on iPhone, tap the button again.";
    return;
  }

  els.soundHelperText.textContent = "Subtle cues for uploads, control changes, and export.";
  els.soundUnlockHint.textContent = "Tap once on iPhone or iPad before UI sounds can play.";
}

async function enableSoundOnDevice() {
  if (!state.settings.soundEnabled) {
    state.settings.soundEnabled = true;
    syncChipPicker(els.soundPicker, "sound", "on");
    saveSession();
  }

  updateSoundUI();

  const unlockPromise = unlockAudio();

  try {
    soundState.patch.play(UI_SOUNDS.soundOn, { volume: 0.78 });
  } catch {
    // If iOS drops the immediate confirmation, we still wait for unlock.
  }

  const isReady = await unlockPromise;
  updateSoundUI();

  if (isReady) {
    showToast("Sounds enabled ✓");
  } else {
    showToast("Tap enable sound again.");
  }
}

function playSliderTick(slider) {
  const now = performance.now();
  const lastTick = sliderSoundTimestamps.get(slider) || 0;
  if (now - lastTick < SLIDER_SOUND_INTERVAL_MS) return;
  sliderSoundTimestamps.set(slider, now);
  playSound(UI_SOUNDS.slider, 0.72);
}

/* ── Shadow ─────────────────────────────────────────────────── */

function computeShadow(intensity, spread = 0) {
  if (intensity <= 0) return null;
  const t = intensity / 100;
  return {
    color:   `rgba(0,0,0,${(t * 0.25).toFixed(3)})`,
    blur:    t * 75,
    offsetY: t * 30,
    spread:  spread,
  };
}

function createShadowMask(sourceCanvas, spreadPx) {
  const spread = Math.round(spreadPx);
  const outset = Math.max(0, spread) + 2;
  const off = document.createElement("canvas");
  off.width = sourceCanvas.width + outset * 2;
  off.height = sourceCanvas.height + outset * 2;
  const oc = off.getContext("2d");
  if (!oc) {
    return { canvas: sourceCanvas, offsetX: 0, offsetY: 0 };
  }

  if (spread >= 0) {
    oc.drawImage(sourceCanvas, outset, outset);

    if (spread > 0) {
      // Positive spread grows the alpha footprint before blur.
      const rings = Math.max(1, Math.ceil(spread / 4));
      for (let ring = 1; ring <= rings; ring++) {
        const radius = spread * (ring / rings);
        const steps = Math.max(12, Math.ceil((Math.PI * 2 * radius) / 6));
        for (let step = 0; step < steps; step++) {
          const angle = (step / steps) * Math.PI * 2;
          const dx = Math.round(Math.cos(angle) * radius);
          const dy = Math.round(Math.sin(angle) * radius);
          oc.drawImage(sourceCanvas, outset + dx, outset + dy);
        }
      }
    }
  } else {
    // Negative spread contracts the silhouette inward before blur, which is
    // the canvas equivalent of CSS's negative spread radius.
    const inset = Math.min(
      Math.abs(spread),
      Math.floor((Math.min(sourceCanvas.width, sourceCanvas.height) - 1) / 2)
    );
    const drawW = Math.max(1, sourceCanvas.width - inset * 2);
    const drawH = Math.max(1, sourceCanvas.height - inset * 2);
    oc.drawImage(
      sourceCanvas,
      outset + inset,
      outset + inset,
      drawW,
      drawH
    );
  }

  oc.globalCompositeOperation = "source-in";
  oc.fillStyle = "#000000";
  oc.fillRect(0, 0, off.width, off.height);
  oc.globalCompositeOperation = "source-over";

  return { canvas: off, offsetX: outset, offsetY: outset };
}

function createShadowLayer(sourceCanvas, shadow) {
  const mask = createShadowMask(sourceCanvas, shadow.spread);
  const blurPad = Math.ceil(shadow.blur * 2.5);
  const padX = blurPad + 4;
  const padTop = blurPad + Math.max(0, -Math.round(shadow.offsetY)) + 4;
  const padBottom = blurPad + Math.max(0, Math.round(shadow.offsetY)) + 4;
  const off = document.createElement("canvas");
  off.width = mask.canvas.width + padX * 2;
  off.height = mask.canvas.height + padTop + padBottom;
  const oc = off.getContext("2d");
  if (!oc) {
    return {
      canvas: mask.canvas,
      offsetX: mask.offsetX,
      offsetY: mask.offsetY,
    };
  }

  oc.shadowColor = shadow.color;
  oc.shadowBlur = shadow.blur;
  oc.shadowOffsetX = 0;
  oc.shadowOffsetY = shadow.offsetY;
  oc.drawImage(mask.canvas, padX, padTop);

  // Remove the hard source mask so only the blurred shadow remains.
  oc.globalCompositeOperation = "destination-out";
  oc.shadowColor = "rgba(0,0,0,0)";
  oc.shadowBlur = 0;
  oc.shadowOffsetX = 0;
  oc.shadowOffsetY = 0;
  oc.drawImage(mask.canvas, padX, padTop);

  return {
    canvas: off,
    offsetX: padX + mask.offsetX,
    offsetY: padTop + mask.offsetY,
  };
}

/* ── Pattern helpers ────────────────────────────────────────── */

/**
 * Return a contrast-friendly hex colour for pattern controls.
 */
function adaptivePatternColor(hexBg, forBlur = false) {
  if (!hexBg || hexBg.length < 7) return "#000000";
  const r   = parseInt(hexBg.slice(1, 3), 16) / 255;
  const g   = parseInt(hexBg.slice(3, 5), 16) / 255;
  const b   = parseInt(hexBg.slice(5, 7), 16) / 255;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (forBlur) {
    return lum > 0.5 ? "#000000" : "#ffffff";
  }
  return lum > 0.5 ? "#000000" : "#ffffff";
}

function hexToRgb(hex) {
  if (!hex || hex.length < 7) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHex(r, g, b) {
  const toHex = (value) => Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixHexColors(colorA, colorB, weight = 0.5) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  const t = Math.max(0, Math.min(1, weight));
  return rgbToHex(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t
  );
}

function getBackgroundReferenceColor(settings) {
  if (settings.bgType === "gradient") {
    return mixHexColors(settings.bgGradientStartColor, settings.bgGradientEndColor);
  }
  return settings.bgColor;
}

function getGradientEndpoints(direction, width, height) {
  switch (direction) {
    case "to-top":
      return [width / 2, height, width / 2, 0];
    case "to-top-right":
      return [0, height, width, 0];
    case "to-right":
      return [0, height / 2, width, height / 2];
    case "to-bottom":
      return [width / 2, 0, width / 2, height];
    case "to-bottom-left":
      return [width, 0, 0, height];
    case "to-left":
      return [width, height / 2, 0, height / 2];
    case "to-top-left":
      return [width, height, 0, 0];
    case "to-bottom-right":
    default:
      return [0, 0, width, height];
  }
}

function invalidateBlurCache() {
  state.blurCache = null;
}

function drawImageCover(ctx, img, destW, destH) {
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const destAspect = destW / destH;
  let dW, dH;

  if (imgAspect > destAspect) {
    dH = destH;
    dW = dH * imgAspect;
  } else {
    dW = destW;
    dH = dW / imgAspect;
  }

  ctx.drawImage(img, (destW - dW) / 2, (destH - dH) / 2, dW, dH);
}

function detectNativeCanvasBlurSupport() {
  const src = document.createElement("canvas");
  const dst = document.createElement("canvas");
  src.width = src.height = 8;
  dst.width = dst.height = 8;

  const sc = src.getContext("2d");
  const dc = dst.getContext("2d", { willReadFrequently: true });
  if (!sc || !dc || !("filter" in dc)) return false;

  try {
    sc.fillStyle = "#ffffff";
    sc.fillRect(3, 3, 2, 2);

    dc.filter = "blur(2px)";
    if (!String(dc.filter).includes("blur")) return false;
    dc.drawImage(src, 0, 0);
    dc.filter = "none";

    const data = dc.getImageData(0, 0, 8, 8).data;
    const samplePixels = [
      (2 * 8 + 2) * 4 + 3,
      (2 * 8 + 5) * 4 + 3,
      (5 * 8 + 2) * 4 + 3,
      (5 * 8 + 5) * 4 + 3,
      (1 * 8 + 3) * 4 + 3,
      (3 * 8 + 1) * 4 + 3,
    ];
    return samplePixels.some((offset) => data[offset] > 0);
  } catch {
    return false;
  }
}

function getSoftwareBlurScale(width, height, blurPx) {
  const areaScale = Math.sqrt((width * height) / BLUR_SOFTWARE_PIXEL_BUDGET);
  const blurScale = blurPx / 12;
  return Math.max(1, Math.min(BLUR_SOFTWARE_MAX_SCALE, Math.ceil(Math.max(areaScale, blurScale))));
}

function boxBlurPass(src, dst, width, height, radius, horizontal) {
  const windowSize = radius * 2 + 1;

  if (horizontal) {
    for (let y = 0; y < height; y++) {
      const rowOffset = y * width * 4;
      let sumR = 0, sumG = 0, sumB = 0, sumA = 0;

      for (let i = -radius; i <= radius; i++) {
        const x = Math.max(0, Math.min(width - 1, i));
        const idx = rowOffset + x * 4;
        const alpha = src[idx + 3];
        sumR += src[idx] * alpha;
        sumG += src[idx + 1] * alpha;
        sumB += src[idx + 2] * alpha;
        sumA += alpha;
      }

      for (let x = 0; x < width; x++) {
        const idx = rowOffset + x * 4;
        const alpha = Math.round(sumA / windowSize);
        dst[idx + 3] = alpha;

        if (sumA > 0) {
          dst[idx]     = Math.round(sumR / sumA);
          dst[idx + 1] = Math.round(sumG / sumA);
          dst[idx + 2] = Math.round(sumB / sumA);
        } else {
          dst[idx] = 0;
          dst[idx + 1] = 0;
          dst[idx + 2] = 0;
        }

        const removeX = Math.max(0, x - radius);
        const addX = Math.min(width - 1, x + radius + 1);
        const removeIdx = rowOffset + removeX * 4;
        const addIdx = rowOffset + addX * 4;
        const removeAlpha = src[removeIdx + 3];
        const addAlpha = src[addIdx + 3];

        sumR += src[addIdx] * addAlpha - src[removeIdx] * removeAlpha;
        sumG += src[addIdx + 1] * addAlpha - src[removeIdx + 1] * removeAlpha;
        sumB += src[addIdx + 2] * addAlpha - src[removeIdx + 2] * removeAlpha;
        sumA += addAlpha - removeAlpha;
      }
    }
    return;
  }

  for (let x = 0; x < width; x++) {
    let sumR = 0, sumG = 0, sumB = 0, sumA = 0;

    for (let i = -radius; i <= radius; i++) {
      const y = Math.max(0, Math.min(height - 1, i));
      const idx = (y * width + x) * 4;
      const alpha = src[idx + 3];
      sumR += src[idx] * alpha;
      sumG += src[idx + 1] * alpha;
      sumB += src[idx + 2] * alpha;
      sumA += alpha;
    }

    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      const alpha = Math.round(sumA / windowSize);
      dst[idx + 3] = alpha;

      if (sumA > 0) {
        dst[idx]     = Math.round(sumR / sumA);
        dst[idx + 1] = Math.round(sumG / sumA);
        dst[idx + 2] = Math.round(sumB / sumA);
      } else {
        dst[idx] = 0;
        dst[idx + 1] = 0;
        dst[idx + 2] = 0;
      }

      const removeY = Math.max(0, y - radius);
      const addY = Math.min(height - 1, y + radius + 1);
      const removeIdx = (removeY * width + x) * 4;
      const addIdx = (addY * width + x) * 4;
      const removeAlpha = src[removeIdx + 3];
      const addAlpha = src[addIdx + 3];

      sumR += src[addIdx] * addAlpha - src[removeIdx] * removeAlpha;
      sumG += src[addIdx + 1] * addAlpha - src[removeIdx + 1] * removeAlpha;
      sumB += src[addIdx + 2] * addAlpha - src[removeIdx + 2] * removeAlpha;
      sumA += addAlpha - removeAlpha;
    }
  }
}

function applySoftwareBlurToCanvas(canvas, blurPx) {
  const width = canvas.width;
  const height = canvas.height;
  const scale = getSoftwareBlurScale(width, height, blurPx);
  const sampleW = Math.max(1, Math.ceil(width / scale));
  const sampleH = Math.max(1, Math.ceil(height / scale));
  const sample = document.createElement("canvas");
  sample.width = sampleW;
  sample.height = sampleH;

  const sampleCtx = sample.getContext("2d", { willReadFrequently: true });
  if (!sampleCtx) return canvas;

  sampleCtx.imageSmoothingEnabled = true;
  sampleCtx.imageSmoothingQuality = "high";
  sampleCtx.drawImage(canvas, 0, 0, sampleW, sampleH);

  const imageData = sampleCtx.getImageData(0, 0, sampleW, sampleH);
  const radius = Math.max(1, Math.round(blurPx / scale));
  let src = new Uint8ClampedArray(imageData.data);
  let dst = new Uint8ClampedArray(src.length);

  for (let pass = 0; pass < 3; pass++) {
    boxBlurPass(src, dst, sampleW, sampleH, radius, true);
    boxBlurPass(dst, src, sampleW, sampleH, radius, false);
  }

  imageData.data.set(src);
  sampleCtx.putImageData(imageData, 0, 0);

  const blurred = document.createElement("canvas");
  blurred.width = width;
  blurred.height = height;
  const bc = blurred.getContext("2d");
  if (!bc) return canvas;
  bc.imageSmoothingEnabled = true;
  bc.imageSmoothingQuality = "high";
  bc.drawImage(sample, 0, 0, width, height);
  return blurred;
}

function createBlurredBackgroundSurface(img, cW, cH, blurPx) {
  const pad = Math.ceil(blurPx * 3);
  const width = cW + pad * 2;
  const height = cH + pad * 2;
  const base = document.createElement("canvas");
  base.width = width;
  base.height = height;

  const baseCtx = base.getContext("2d");
  if (!baseCtx) {
    return { canvas: base, method: "software", pad };
  }

  drawImageCover(baseCtx, img, width, height);

  if (state.canvasBlurMode === "native") {
    try {
      const blurred = document.createElement("canvas");
      blurred.width = width;
      blurred.height = height;
      const bc = blurred.getContext("2d");
      if (bc) {
        bc.filter = `blur(${blurPx}px)`;
        bc.drawImage(base, 0, 0);
        bc.filter = "none";
        return { canvas: blurred, method: "native", pad };
      }
    } catch {
      state.canvasBlurMode = "software";
      invalidateBlurCache();
    }
  }

  return {
    canvas: applySoftwareBlurToCanvas(base, blurPx),
    method: "software",
    pad,
  };
}

function getBlurredBackgroundSurface(img, cW, cH, blurPx) {
  const cached = state.blurCache;
  if (
    cached &&
    cached.image === img &&
    cached.width === cW &&
    cached.height === cH &&
    cached.blur === blurPx &&
    cached.method === state.canvasBlurMode
  ) {
    return cached;
  }

  const next = createBlurredBackgroundSurface(img, cW, cH, blurPx);
  state.blurCache = {
    image: img,
    width: cW,
    height: cH,
    blur: blurPx,
    method: next.method,
    pad: next.pad,
    canvas: next.canvas,
  };
  return state.blurCache;
}

/**
 * Noise: rendered on an offscreen canvas and tinted with the chosen colour.
 * Each pixel keeps a randomized alpha value so the result still reads as
 * texture rather than a flat wash.
 */
function paintNoise(ctx, w, h, color, scale = 1, blendMode = "overlay", opacity = 1) {
  const off = document.createElement("canvas");
  off.width  = w;
  off.height = h;
  const oc = off.getContext("2d");
  const d  = oc.createImageData(w, h);
  const { r, g, b } = hexToRgb(color);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.random() * 255 | 0;
    d.data[i] = r;
    d.data[i + 1] = g;
    d.data[i + 2] = b;
    d.data[i + 3] = v;
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

function getCenteredPatternOffset(size, spacing) {
  const center = size / 2;
  return ((center % spacing) + spacing) % spacing;
}

/**
 * Dot grid: evenly-spaced small circles whose colour is computed from
 * adaptivePatternColor so they always complement the background.
 */
function paintDotGrid(ctx, w, h, dotColor, scale = 1, blendMode = "overlay", opacity = 1) {
  const spacing = 20 * scale;
  const radius  = 1.4 * scale;
  const xOffset = getCenteredPatternOffset(w, spacing);
  const yOffset = getCenteredPatternOffset(h, spacing);
  const prevOp    = ctx.globalCompositeOperation;
  const prevAlpha = ctx.globalAlpha;
  ctx.globalCompositeOperation = blendMode;
  ctx.globalAlpha = opacity;
  ctx.fillStyle = dotColor;
  ctx.beginPath();
  for (let x = xOffset; x <= w; x += spacing) {
    for (let y = yOffset; y <= h; y += spacing) {
      ctx.moveTo(x + radius, y);
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    }
  }
  ctx.fill();
  ctx.globalCompositeOperation = prevOp;
  ctx.globalAlpha = prevAlpha;
}

/**
 * Grid: light line work that adds structure without overpowering the image.
 * The scale control expands or tightens the spacing while keeping lines thin.
 */
function paintGrid(ctx, w, h, lineColor, scale = 1, blendMode = "overlay", opacity = 1) {
  const spacing = Math.max(12, 24 * scale);
  const lineWidth = Math.max(0.5, Math.min(2, scale * 0.8));
  const xOffset = getCenteredPatternOffset(w, spacing);
  const yOffset = getCenteredPatternOffset(h, spacing);
  const prevOp = ctx.globalCompositeOperation;
  const prevAlpha = ctx.globalAlpha;

  ctx.globalCompositeOperation = blendMode;
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();

  for (let x = xOffset; x <= w; x += spacing) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }

  for (let y = yOffset; y <= h; y += spacing) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }

  ctx.stroke();
  ctx.globalCompositeOperation = prevOp;
  ctx.globalAlpha = prevAlpha;
}

/**
 * Blurred image background: draws the source image scaled to cover the
 * entire canvas, blurred, on an oversized offscreen canvas so the Gaussian
 * kernel never bleeds to transparency at the edges.
 */
function paintBlurredBackground(ctx, img, cW, cH, blurPx) {
  const surface = getBlurredBackgroundSurface(img, cW, cH, blurPx);
  ctx.drawImage(surface.canvas, surface.pad, surface.pad, cW, cH, 0, 0, cW, cH);
}

function paintGradientBackground(ctx, cW, cH, startColor, endColor, direction) {
  const [x0, y0, x1, y1] = getGradientEndpoints(direction, cW, cH);
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0, startColor);
  gradient.addColorStop(1, endColor);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cW, cH);
}

/* ── DOM refs ───────────────────────────────────────────────── */

const $ = (id) => document.getElementById(id);

const els = {
  fileInput:     $("fileInput"),
  logoFileInput: $("logoFileInput"),
  previewArea:   $("previewArea"),
  frameWrap:     $("frameWrap"),
  frame:         document.querySelector(".frame"),
  canvas:        $("previewCanvas"),
  canvasActions: $("canvasActions"),
  canvasBrowseBtn: $("canvasBrowseBtn"),
  exportBtn:     $("exportBtn"),
  copyBtn:       $("copyBtn"),
  toast:         $("toast"),
  panel:         $("panel"),
  resetBtn:      $("resetBtn"),
  imageLabel:    $("imageLabel"),
  sectionStyle:  $("section-style"),
  sectionElement: $("section-element"),
  sectionExport: $("section-export"),
  sectionFeedback: $("section-feedback"),
  // Appearance controls
  ratioPicker:   $("ratioPicker"),
  bgTypePicker:  $("bgTypePicker"),
  bgColorInput:  $("bgColorInput"),
  bgColorControl: $("bgColorControl"),
  bgGradientControl: $("bgGradientControl"),
  bgGradientStartInput: $("bgGradientStartInput"),
  bgGradientEndInput: $("bgGradientEndInput"),
  bgGradientDirectionControl: $("bgGradientDirectionControl"),
  bgGradientDirectionPicker: $("bgGradientDirectionPicker"),
  bgBlurControl:  $("bgBlurControl"),
  patternPicker: $("patternPicker"),
  patternColorControl: $("patternColorControl"),
  patternColorInput: $("patternColorInput"),
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
  overlayTypePicker: $("overlayTypePicker"),
  overlayTextControl: $("overlayTextControl"),
  overlayTextInput: $("overlayTextInput"),
  overlayFontSelect: $("overlayFontSelect"),
  overlayColorInput: $("overlayColorInput"),
  overlayLogoControl: $("overlayLogoControl"),
  overlayLogoBtn: $("overlayLogoBtn"),
  overlayLogoHint: $("overlayLogoHint"),
  overlayPositionControl: $("overlayPositionControl"),
  overlayPositionPicker: $("overlayPositionPicker"),
  overlayBlendControl: $("overlayBlendControl"),
  overlayBlendPicker: $("overlayBlendPicker"),
  overlayEdgeDistanceControl: $("overlayEdgeDistanceControl"),
  overlayEdgeDistanceSlider: $("overlayEdgeDistanceSlider"),
  overlayEdgeDistanceVal: $("overlayEdgeDistanceVal"),
  overlaySizeControl: $("overlaySizeControl"),
  overlaySizeSlider: $("overlaySizeSlider"),
  overlaySizeVal: $("overlaySizeVal"),
  overlayOpacityControl: $("overlayOpacityControl"),
  overlayOpacitySlider: $("overlayOpacitySlider"),
  overlayOpacityVal: $("overlayOpacityVal"),
  soundPicker: $("soundPicker"),
  soundUnlockControl: $("soundUnlockControl"),
  soundUnlockBtn: $("soundUnlockBtn"),
  soundUnlockHint: $("soundUnlockHint"),
  soundHelperText: $("soundHelperText"),
};

const ctx = els.canvas.getContext("2d");

/* ── Canvas render ──────────────────────────────────────────── */

const SCALE = 2; // 2× backing store → retina-sharp export

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getCanvasLayout(img, settings = state.settings) {
  const pad = settings.padding;
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  const aspect = imgH ? imgW / imgH : 1;
  const preset = CANVAS_PRESETS[settings.canvasRatio];
  let cW, cH, dW, dH, ix, iy;

  if (!preset) {
    // Free: canvas sized to original image at full resolution.
    dW = imgW;
    dH = imgH;
    cW = dW + pad * 2;
    cH = dH + pad * 2;
    ix = pad;
    iy = pad;
  } else {
    cW = preset.cW;
    cH = preset.cH;

    const baseSize = 560;
    const maxImageDim = Math.max(imgW, imgH);
    const presetScale = Math.max(1, maxImageDim / baseSize);

    cW = Math.round(cW * presetScale);
    cH = Math.round(cH * presetScale);

    const availW = Math.max(1, cW - pad * 2);
    const availH = Math.max(1, cH - pad * 2);

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

  return { cW, cH, dW, dH, ix, iy, imgW, imgH, aspect, pad };
}

function render() {
  if (!state.image) return;

  const img     = state.image;
  const r       = state.settings.radius;
  const {
    bgType,
    bgColor,
    bgGradientStartColor,
    bgGradientEndColor,
    bgGradientDirection,
    blurAmount,
    pattern,
    patternColor,
    patternScale,
    patternBlendMode,
    patternOpacity,
  } = state.settings;
  const scale = patternScale / 10;
  const opacity = patternOpacity / 100;
  const resolvedPatternColor = patternColor
    || adaptivePatternColor(getBackgroundReferenceColor(state.settings), bgType === "blur");
  const layout = getCanvasLayout(img, state.settings);
  const { cW, cH, dW, dH, ix, iy } = layout;

  // Size the pixel buffer at 2×
  els.canvas.width  = cW * SCALE;
  els.canvas.height = cH * SCALE;

  // Display the canvas with responsive scaling so it always fits in the
  // preview window, even for very tall or wide images.
  const previewStyles = window.getComputedStyle(els.previewArea);
  const previewW = Math.max(
    1,
    els.previewArea.clientWidth
      - parseFloat(previewStyles.paddingLeft || "0")
      - parseFloat(previewStyles.paddingRight || "0")
  );
  const previewH = Math.max(
    1,
    els.previewArea.clientHeight
      - parseFloat(previewStyles.paddingTop || "0")
      - parseFloat(previewStyles.paddingBottom || "0")
  );
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
  } else if (bgType === "gradient") {
    paintGradientBackground(
      ctx,
      cW,
      cH,
      bgGradientStartColor,
      bgGradientEndColor,
      bgGradientDirection
    );
  } else if (bgType === "blur") {
    paintBlurredBackground(ctx, img, cW, cH, blurAmount);
  }

  // 2 — Optional pattern (background-only)
  if (pattern === "noise") {
    paintNoise(ctx, cW, cH, resolvedPatternColor, scale, patternBlendMode, opacity);
  } else if (pattern === "dots") {
    paintDotGrid(ctx, cW, cH, resolvedPatternColor, scale, patternBlendMode, opacity);
  } else if (pattern === "grid") {
    paintGrid(ctx, cW, cH, resolvedPatternColor, scale, patternBlendMode, opacity);
  }

  // 3 — Optional overlay, drawn behind the pasted image.
  paintOverlay(ctx, layout);

  // 4 — Build the clipped image surface, then derive a shadow layer from its alpha.
  //
  //     Why offscreen?  We want the image clipped cleanly while still being
  //     able to contract or expand the shadow silhouette before blur.
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

  const shadow = computeShadow(state.settings.shadow, state.settings.shadowSpread);
  if (shadow) {
    const shadowLayer = createShadowLayer(imgOff, shadow);
    ctx.drawImage(
      shadowLayer.canvas,
      ix - shadowLayer.offsetX,
      iy - shadowLayer.offsetY
    );
  }
  ctx.drawImage(imgOff, ix, iy, dW, dH);

  ctx.restore();
}

function getOverlayBaseMargin(canvasW, canvasH) {
  return Math.max(16, Math.round(Math.min(canvasW, canvasH) * 0.04));
}

function isSideOverlayPosition(position) {
  return position === "left-side" || position === "right-side";
}

function getOverlayAlign(position) {
  if (isSideOverlayPosition(position)) {
    return {
      hAlign: "center",
      vAlign: "center",
    };
  }

  return {
    hAlign: position.endsWith("left")
      ? "start"
      : position.endsWith("right")
        ? "end"
        : "center",
    vAlign: position.startsWith("top") ? "start" : "end",
  };
}

function getOverlayCandidateAreas(position, layout) {
  if (!layout) return [];

  const { cW, cH, dW, dH, ix, iy } = layout;
  const { hAlign, vAlign } = getOverlayAlign(position);
  const imageRight = ix + dW;
  const imageBottom = iy + dH;
  const areas = [];

  if (isSideOverlayPosition(position)) {
    areas.push({
      x: position === "left-side" ? 0 : imageRight,
      y: iy,
      w: position === "left-side" ? Math.max(0, ix) : Math.max(0, cW - imageRight),
      h: dH,
      hAlign: position === "left-side" ? "start" : "end",
      vAlign: "center",
      primary: true,
    });

    return areas.filter((area) => area.w > 0 && area.h > 0);
  }

  if (vAlign === "start") {
    areas.push({
      x: 0,
      y: 0,
      w: cW,
      h: Math.max(0, iy),
      hAlign,
      vAlign,
      primary: true,
    });
  } else {
    areas.push({
      x: 0,
      y: imageBottom,
      w: cW,
      h: Math.max(0, cH - imageBottom),
      hAlign,
      vAlign,
      primary: true,
    });
  }

  if (hAlign === "start") {
    areas.push({
      x: 0,
      y: 0,
      w: Math.max(0, ix),
      h: cH,
      hAlign,
      vAlign,
      primary: false,
    });
  } else if (hAlign === "end") {
    areas.push({
      x: imageRight,
      y: 0,
      w: Math.max(0, cW - imageRight),
      h: cH,
      hAlign,
      vAlign,
      primary: false,
    });
  }

  return areas.filter((area) => area.w > 0 && area.h > 0);
}

function getOverlayAreaInset(area, canvasW, canvasH) {
  const shortestSide = Math.min(area.w, area.h);
  if (shortestSide <= 0) return 0;
  return Math.round(Math.min(
    getOverlayBaseMargin(canvasW, canvasH),
    Math.max(4, shortestSide * OVERLAY_AREA_INSET_RATIO)
  ));
}

function getOverlayAreaInnerSize(area, canvasW, canvasH) {
  const inset = getOverlayAreaInset(area, canvasW, canvasH);
  return {
    inset,
    innerW: Math.max(1, area.w - inset * 2),
    innerH: Math.max(1, area.h - inset * 2),
  };
}

function alignOverlayAxis(start, length, boxSize, inset, align, extraInset = 0) {
  const edgeInset = inset + (align === "center" ? 0 : extraInset);
  const min = start + edgeInset;
  const max = start + length - edgeInset - boxSize;

  if (max < min) {
    return Math.round(start + (length - boxSize) / 2);
  }

  if (align === "center") return Math.round((min + max) / 2);
  if (align === "end") return Math.round(max);
  return Math.round(min);
}

function getLegacyOverlayPlacement(position, boxW, boxH, canvasW, canvasH) {
  const margin = getOverlayBaseMargin(canvasW, canvasH);

  switch (position) {
    case "top-left":
      return { x: margin, y: margin };
    case "top-center":
      return {
        x: Math.round((canvasW - boxW) / 2),
        y: margin,
      };
    case "top-right":
      return { x: canvasW - boxW - margin, y: margin };
    case "bottom-left":
      return { x: margin, y: canvasH - boxH - margin };
    case "bottom-center":
      return {
        x: Math.round((canvasW - boxW) / 2),
        y: canvasH - boxH - margin,
      };
    case "left-side":
      return {
        x: margin,
        y: Math.round((canvasH - boxH) / 2),
      };
    case "right-side":
      return {
        x: canvasW - boxW - margin,
        y: Math.round((canvasH - boxH) / 2),
      };
    case "bottom-right":
    default:
      return { x: canvasW - boxW - margin, y: canvasH - boxH - margin };
  }
}

function getOverlayExtraDistanceLimit(area, boxW, boxH, canvasW, canvasH) {
  const { inset } = getOverlayAreaInnerSize(area, canvasW, canvasH);
  const limits = [];

  if (area.hAlign !== "center") {
    limits.push(Math.max(0, area.w - boxW - inset * 2));
  }
  if (area.vAlign !== "center") {
    limits.push(Math.max(0, area.h - boxH - inset * 2));
  }

  if (!limits.length) return 0;
  return Math.floor(Math.min(...limits));
}

function getEffectiveOverlayExtraDistance(area, boxW, boxH, canvasW, canvasH) {
  const requested = Math.round(Number(state.settings.overlayEdgeDistance) || 0);
  return clampNumber(
    requested,
    OVERLAY_EDGE_DISTANCE_MIN,
    getOverlayExtraDistanceLimit(area, boxW, boxH, canvasW, canvasH)
  );
}

function placeOverlayInArea(area, boxW, boxH, canvasW, canvasH) {
  const { inset } = getOverlayAreaInnerSize(area, canvasW, canvasH);
  const extraInset = getEffectiveOverlayExtraDistance(area, boxW, boxH, canvasW, canvasH);
  return {
    x: alignOverlayAxis(area.x, area.w, boxW, inset, area.hAlign, extraInset),
    y: alignOverlayAxis(area.y, area.h, boxH, inset, area.vAlign, extraInset),
  };
}

function getOverlayPlacementCandidate(position, boxW, boxH, layout) {
  const { cW, cH } = layout;
  const candidates = getOverlayCandidateAreas(position, layout)
    .map((area, index) => {
      const { innerW, innerH } = getOverlayAreaInnerSize(area, cW, cH);
      const fitScore = Math.min(innerW / Math.max(1, boxW), innerH / Math.max(1, boxH));
      return {
        area,
        index,
        fits: boxW <= innerW && boxH <= innerH,
        fitScore,
      };
    })
    .filter((candidate) => candidate.fitScore > 0);

  if (!candidates.length) {
    return null;
  }

  candidates.sort((a, b) => {
    if (a.fits !== b.fits) return a.fits ? -1 : 1;
    if (a.fits && a.area.primary !== b.area.primary) return a.area.primary ? -1 : 1;
    if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
    return a.index - b.index;
  });

  return candidates[0];
}

function getOverlayPlacement(position, boxW, boxH, layout) {
  const { cW, cH } = layout;
  const candidate = getOverlayPlacementCandidate(position, boxW, boxH, layout);

  if (!candidate) {
    return getLegacyOverlayPlacement(position, boxW, boxH, cW, cH);
  }

  return placeOverlayInArea(candidate.area, boxW, boxH, cW, cH);
}

function paintOverlay(ctx, layout) {
  const { cW, cH } = layout;
  const {
    overlayType,
    overlayText,
    overlayColor,
    overlayBlendMode,
    overlaySize,
    overlayOpacity,
    overlayPosition,
  } = state.settings;

  if (overlayType === "none") return;

  ctx.save();
  ctx.globalAlpha = overlayOpacity / 100;
  ctx.globalCompositeOperation = overlayBlendMode === "overlay" || overlayBlendMode === "screen"
    ? overlayBlendMode
    : "source-over";

  if (overlayType === "text" && overlayText.trim()) {
    const fontSize = Math.max(1, Math.round((cW * overlaySize) / 100));
    ctx.font = `600 ${fontSize}px ${getOverlayFontFamily()}`;
    ctx.fillStyle = overlayColor;
    ctx.textBaseline = "top";
    const boxW = Math.ceil(measureOverlayTextWidth(ctx, overlayText, fontSize));
    const boxH = Math.ceil(fontSize * 1.15);
    const { x, y } = getOverlayPlacement(overlayPosition, boxW, boxH, layout);
    drawOverlayText(ctx, overlayText, x, y, fontSize);
    ctx.restore();
    return;
  }

  if (overlayType === "logo" && state.logoImage) {
    const maxW = Math.round((cW * overlaySize) / 100);
    const aspect = state.logoImage.naturalWidth / state.logoImage.naturalHeight || 1;
    const boxW = Math.max(1, maxW);
    const boxH = Math.max(1, Math.round(boxW / aspect));
    const { x, y } = getOverlayPlacement(overlayPosition, boxW, boxH, layout);
    ctx.drawImage(state.logoImage, x, y, boxW, boxH);
  }

  ctx.restore();
}

function getOverlayFontFamily() {
  return OVERLAY_FONT_STACKS[state.settings.overlayFont] || OVERLAY_FONT_STACKS["sans-serif"];
}

function getOverlayTextGraphemes(text) {
  if (OVERLAY_TEXT_SEGMENTER) {
    return [...OVERLAY_TEXT_SEGMENTER.segment(text)].map((part) => part.segment);
  }
  return Array.from(text);
}

function getOverlayTextKerning(fontSize) {
  return fontSize * OVERLAY_TEXT_KERNING_EM;
}

function hasCanvasLetterSpacing(renderCtx) {
  return "letterSpacing" in renderCtx;
}

function withOverlayTextKerning(renderCtx, fontSize, callback) {
  if (!hasCanvasLetterSpacing(renderCtx)) {
    return callback(false);
  }

  const previousLetterSpacing = renderCtx.letterSpacing;
  renderCtx.letterSpacing = `${getOverlayTextKerning(fontSize)}px`;
  try {
    return callback(true);
  } finally {
    renderCtx.letterSpacing = previousLetterSpacing;
  }
}

function measureOverlayTextWidth(renderCtx, text, fontSize) {
  const graphemes = getOverlayTextGraphemes(text);
  if (!graphemes.length) return 0;

  return withOverlayTextKerning(renderCtx, fontSize, (usesNativeSpacing) => {
    if (usesNativeSpacing) {
      return Math.max(1, renderCtx.measureText(text).width);
    }

    const kerning = getOverlayTextKerning(fontSize);
    const glyphWidth = graphemes.reduce(
      (total, glyph) => total + renderCtx.measureText(glyph).width,
      0
    );
    return Math.max(1, glyphWidth + kerning * (graphemes.length - 1));
  });
}

function drawOverlayText(renderCtx, text, x, y, fontSize) {
  const graphemes = getOverlayTextGraphemes(text);

  withOverlayTextKerning(renderCtx, fontSize, (usesNativeSpacing) => {
    if (usesNativeSpacing) {
      renderCtx.fillText(text, x, y);
      return;
    }

    const kerning = getOverlayTextKerning(fontSize);
    let cursorX = x;
    graphemes.forEach((glyph) => {
      renderCtx.fillText(glyph, cursorX, y);
      cursorX += renderCtx.measureText(glyph).width + kerning;
    });
  });
}

function measureOverlayTextWidthAtFontSize(text, fontSize) {
  ctx.save();
  ctx.font = `600 ${fontSize}px ${getOverlayFontFamily()}`;
  const width = measureOverlayTextWidth(ctx, text, fontSize);
  ctx.restore();
  return width;
}

function getAutoTextOverlaySize(layout) {
  const text = state.settings.overlayText.trim() || DEFAULT_SETTINGS.overlayText;
  const widthAt100 = Math.max(1, measureOverlayTextWidthAtFontSize(text, 100));
  const widthPerPx = widthAt100 / 100;
  const areas = getOverlayCandidateAreas(state.settings.overlayPosition, layout);
  let bestFontSize = 0;

  if (!areas.length && isSideOverlayPosition(state.settings.overlayPosition)) {
    return OVERLAY_SIZE_MIN;
  }

  areas.forEach((area) => {
    const { innerW, innerH } = getOverlayAreaInnerSize(area, layout.cW, layout.cH);
    const fontByWidth = innerW / widthPerPx;
    const fontByHeight = innerH / OVERLAY_TEXT_LINE_HEIGHT;
    bestFontSize = Math.max(bestFontSize, Math.min(fontByWidth, fontByHeight));
  });

  if (!bestFontSize) return DEFAULT_SETTINGS.overlaySize;
  return Math.floor((bestFontSize * OVERLAY_AUTO_FILL / layout.cW) * 100);
}

function getAutoLogoOverlaySize(layout) {
  const logo = state.logoImage;
  const aspect = logo
    ? logo.naturalWidth / logo.naturalHeight || OVERLAY_FALLBACK_LOGO_ASPECT
    : OVERLAY_FALLBACK_LOGO_ASPECT;
  const areas = getOverlayCandidateAreas(state.settings.overlayPosition, layout);
  let bestLogoWidth = 0;

  if (!areas.length && isSideOverlayPosition(state.settings.overlayPosition)) {
    return OVERLAY_SIZE_MIN;
  }

  areas.forEach((area) => {
    const { innerW, innerH } = getOverlayAreaInnerSize(area, layout.cW, layout.cH);
    bestLogoWidth = Math.max(bestLogoWidth, Math.min(innerW, innerH * aspect));
  });

  if (!bestLogoWidth) return DEFAULT_SETTINGS.overlaySize;
  return Math.floor((bestLogoWidth * OVERLAY_AUTO_FILL / layout.cW) * 100);
}

function getAutoOverlaySize(type, layout) {
  if (type === "text") return getAutoTextOverlaySize(layout);
  if (type === "logo") return getAutoLogoOverlaySize(layout);
  return DEFAULT_SETTINGS.overlaySize;
}

function getOverlayBoxSize(type, layout) {
  const { cW } = layout;

  if (type === "text") {
    const text = state.settings.overlayText.trim() || DEFAULT_SETTINGS.overlayText;
    const fontSize = Math.max(1, Math.round((cW * state.settings.overlaySize) / 100));
    const width = measureOverlayTextWidthAtFontSize(text, fontSize);
    return {
      boxW: Math.ceil(width),
      boxH: Math.ceil(fontSize * OVERLAY_TEXT_LINE_HEIGHT),
    };
  }

  if (type === "logo") {
    const aspect = state.logoImage
      ? state.logoImage.naturalWidth / state.logoImage.naturalHeight || OVERLAY_FALLBACK_LOGO_ASPECT
      : OVERLAY_FALLBACK_LOGO_ASPECT;
    const boxW = Math.max(1, Math.round((cW * state.settings.overlaySize) / 100));
    return {
      boxW,
      boxH: Math.max(1, Math.round(boxW / aspect)),
    };
  }

  return { boxW: 0, boxH: 0 };
}

function syncOverlaySizeControls() {
  els.overlaySizeSlider.value = state.settings.overlaySize;
  els.overlaySizeVal.value = state.settings.overlaySize;
  refreshSlider(els.overlaySizeSlider);
}

function syncOverlayEdgeDistanceControls() {
  els.overlayEdgeDistanceSlider.value = state.settings.overlayEdgeDistance;
  els.overlayEdgeDistanceVal.value = state.settings.overlayEdgeDistance;
  refreshSlider(els.overlayEdgeDistanceSlider);
}

function syncOverlayFontSelect() {
  const fontKey = OVERLAY_FONT_STACKS[state.settings.overlayFont]
    ? state.settings.overlayFont
    : DEFAULT_SETTINGS.overlayFont;

  state.settings.overlayFont = fontKey;
  els.overlayFontSelect.value = fontKey;
  els.overlayFontSelect.style.fontFamily = getOverlayFontFamily();
}

function syncOverlayBlendMode() {
  if (!OVERLAY_BLEND_MODES.has(state.settings.overlayBlendMode)) {
    state.settings.overlayBlendMode = DEFAULT_SETTINGS.overlayBlendMode;
  }
  syncChipPicker(els.overlayBlendPicker, "overlayBlend", state.settings.overlayBlendMode);
}

function getOverlayEdgeDistanceLimit() {
  const { overlayType, overlayPosition } = state.settings;
  if (!state.image || overlayType === "none") return 0;

  const layout = getCanvasLayout(state.image, state.settings);
  const { boxW, boxH } = getOverlayBoxSize(overlayType, layout);
  if (boxW <= 0 || boxH <= 0) return 0;

  const candidate = getOverlayPlacementCandidate(overlayPosition, boxW, boxH, layout);
  if (!candidate) return 0;

  return getOverlayExtraDistanceLimit(candidate.area, boxW, boxH, layout.cW, layout.cH);
}

function syncOverlayEdgeDistanceBounds() {
  const max = getOverlayEdgeDistanceLimit();
  els.overlayEdgeDistanceSlider.min = String(OVERLAY_EDGE_DISTANCE_MIN);
  els.overlayEdgeDistanceVal.min = String(OVERLAY_EDGE_DISTANCE_MIN);
  els.overlayEdgeDistanceSlider.max = String(max);
  els.overlayEdgeDistanceVal.max = String(max);
  els.overlayEdgeDistanceSlider.disabled = max <= OVERLAY_EDGE_DISTANCE_MIN;
  els.overlayEdgeDistanceVal.disabled = max <= OVERLAY_EDGE_DISTANCE_MIN;

  if (state.settings.overlayEdgeDistance < OVERLAY_EDGE_DISTANCE_MIN) {
    state.settings.overlayEdgeDistance = OVERLAY_EDGE_DISTANCE_MIN;
  }
  if (state.settings.overlayEdgeDistance > max) {
    state.settings.overlayEdgeDistance = max;
  }
  syncOverlayEdgeDistanceControls();
}

function getOverlaySizeLimit() {
  const { overlayType, overlayPosition } = state.settings;
  const baseMax = OVERLAY_SIZE_LIMITS[overlayType] || OVERLAY_SIZE_LIMITS.none;

  if (!state.image || overlayType === "none" || !isSideOverlayPosition(overlayPosition)) {
    return baseMax;
  }

  const layout = getCanvasLayout(state.image, state.settings);
  const sideMax = getAutoOverlaySize(overlayType, layout);
  return clampNumber(sideMax, OVERLAY_SIZE_MIN, baseMax);
}

function autoFitActiveOverlaySize() {
  const { overlayType } = state.settings;
  if (!state.image || overlayType === "none") return false;

  const max = getOverlaySizeLimit();
  const layout = getCanvasLayout(state.image, state.settings);
  const autoSize = getAutoOverlaySize(overlayType, layout);
  state.settings.overlaySize = clampNumber(autoSize, OVERLAY_SIZE_MIN, max);
  syncOverlaySizeBounds();
  return true;
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
 * Return the image as a data URL without compression — preserve full quality.
 */
function toStorageURL(img) {
  const off = document.createElement("canvas");
  off.width  = img.naturalWidth;
  off.height = img.naturalHeight;
  off.getContext("2d").drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
  return off.toDataURL("image/png");
}

function updateImageLabel(label) {
  if (!els.imageLabel) return;
  els.imageLabel.textContent = label || "image_mockups.png";
}

function syncOverlaySizeBounds() {
  const max = getOverlaySizeLimit();
  els.overlaySizeSlider.min = String(OVERLAY_SIZE_MIN);
  els.overlaySizeVal.min = String(OVERLAY_SIZE_MIN);
  els.overlaySizeSlider.max = String(max);
  els.overlaySizeVal.max = String(max);
  if (state.settings.overlaySize < OVERLAY_SIZE_MIN) {
    state.settings.overlaySize = OVERLAY_SIZE_MIN;
  }
  if (state.settings.overlaySize > max) {
    state.settings.overlaySize = max;
  }
  syncOverlaySizeControls();
  syncOverlayEdgeDistanceBounds();
}

function updateOverlayUI() {
  const { overlayType } = state.settings;
  const showText = overlayType === "text";
  const showLogo = overlayType === "logo";
  const showOverlayControls = overlayType !== "none";

  els.overlayTextControl.classList.toggle("hidden", !showText);
  els.overlayLogoControl.classList.toggle("hidden", !showLogo);
  els.overlayPositionControl.classList.toggle("hidden", !showOverlayControls);
  els.overlayBlendControl.classList.toggle("hidden", !showOverlayControls);
  els.overlayEdgeDistanceControl.classList.toggle("hidden", !showOverlayControls);
  els.overlaySizeControl.classList.toggle("hidden", !showOverlayControls);
  els.overlayOpacityControl.classList.toggle("hidden", !showOverlayControls);
  els.overlayLogoHint.textContent = state.logoDataURL
    ? "Logo ready for export."
    : "No logo selected.";
  syncOverlayFontSelect();
  syncOverlayBlendMode();
  syncOverlaySizeBounds();
}

function updateBackgroundUI() {
  const { bgType } = state.settings;
  els.bgColorControl.classList.toggle("hidden", bgType !== "solid");
  els.bgGradientControl.classList.toggle("hidden", bgType !== "gradient");
  els.bgGradientDirectionControl.classList.toggle("hidden", bgType !== "gradient");
  els.bgBlurControl.classList.toggle("hidden", bgType !== "blur");
}

function applySettings(settings) {
  state.settings = { ...DEFAULT_SETTINGS, ...settings };
  invalidateBlurCache();
  applySettingsToUI();
}

function pickDemoImage() {
  return DEMO_IMAGES[(Math.random() * DEMO_IMAGES.length) | 0];
}

async function setImage(src, options = {}) {
  const {
    persist = true,
    label = null,
    isDemo = false,
    soundName = null,
  } = options;

  try {
    const img = await loadImgElement(src);
    state.image = img;
    invalidateBlurCache();
    state.isDemo = isDemo;
    state.imageLabel = label || "image_mockups.png";
    updateImageLabel(state.imageLabel);
    showPreview();
    if (state.overlaySizeAutoFit) {
      autoFitActiveOverlaySize();
    } else {
      syncOverlaySizeBounds();
    }
    render();
    state.imageDataURL = persist ? toStorageURL(img) : null;
    saveSession();
    if (soundName) {
      playSound(soundName, 0.9);
    }
  } catch {
    playSound(UI_SOUNDS.error, 0.9);
    showToast("Could not display image.");
  }
}

async function loadDemoImage(demo = pickDemoImage()) {
  applySettings({
    ...demo.settings,
    soundEnabled: state.settings.soundEnabled,
  });
  await setImage(demo.src, {
    persist: false,
    label: demo.label,
    isDemo: true,
  });
}

async function loadFileAsImage(file) {
  const objectURL = URL.createObjectURL(file);
  try {
    await setImage(objectURL, {
      persist: true,
      label: file.name || "pasted-image.png",
      isDemo: false,
      soundName: UI_SOUNDS.import,
    });
  } finally {
    URL.revokeObjectURL(objectURL);
  }
}

async function setLogoImage(src, persist = true, soundName = null, options = {}) {
  const { autoFit = false } = options;

  try {
    const img = await loadImgElement(src);
    state.logoImage = img;
    state.logoDataURL = persist ? src : null;
    if (autoFit || state.pendingLogoAutoFit) {
      state.overlaySizeAutoFit = state.settings.overlayType === "logo";
      autoFitActiveOverlaySize();
    } else {
      syncOverlaySizeBounds();
    }
    state.pendingLogoAutoFit = false;
    updateOverlayUI();
    render();
    saveSession();
    if (soundName) {
      playSound(soundName, 0.75);
    }
  } catch {
    playSound(UI_SOUNDS.error, 0.9);
    showToast("Could not load logo.");
  }
}

function loadLogoFile(file) {
  if (!file) return;
  const lowerName = file.name.toLowerCase();
  const isSupportedType = file.type === "image/png" || lowerName.endsWith(".png");
  if (!isSupportedType) {
    playSound(UI_SOUNDS.error, 0.9);
    showToast("Please use a PNG logo.");
    return;
  }
  const reader = new FileReader();
  reader.onload = async (e) => {
    await setLogoImage(e.target.result, true, UI_SOUNDS.import, {
      autoFit: state.settings.overlayType === "logo" && state.overlaySizeAutoFit,
    });
  };
  reader.readAsDataURL(file);
}

function extractImageURLFromHTML(html) {
  if (!html) return null;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const img = doc.querySelector("img");
  if (!img) return null;
  const src = img.getAttribute("src");
  if (!src) return null;
  if (src.startsWith("data:image/")) return src;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  return null;
}

function handleFile(file) {
  if (!file) return;
  if (file.type && !file.type.startsWith("image/")) {
    playSound(UI_SOUNDS.error, 0.9);
    showToast("Please use a PNG, JPG, or WEBP image.");
    return;
  }
  loadFileAsImage(file).catch(() => {
    playSound(UI_SOUNDS.error, 0.9);
    showToast("Could not display image.");
  });
}

function handleClipboardData(clipboardData) {
  if (!clipboardData) return false;
  const items = Array.from(clipboardData.items || []);

  const imageItem = items.find((it) => it.type === "image/png")
    || items.find((it) => it.type.startsWith("image/"));
  if (imageItem) {
    playPasteAnimation();
    handleFile(imageItem.getAsFile());
    return true;
  }

  const htmlItem = items.find((it) => it.type === "text/html");
  if (htmlItem) {
    htmlItem.getAsString((html) => {
      const src = extractImageURLFromHTML(html);
      if (!src) return;
      playPasteAnimation();
      setImage(src, { soundName: UI_SOUNDS.import });
    });
    return true;
  }

  const textItem = items.find((it) => it.type === "text/plain");
  if (textItem) {
    textItem.getAsString((text) => {
      const trimmed = text.trim();
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        playPasteAnimation();
        loadFromURL(trimmed);
      }
    });
    return true;
  }

  return false;
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
    invalidateBlurCache();
    state.isDemo = false;
    state.imageLabel = "linked-image.png";
    updateImageLabel(state.imageLabel);
    showPreview();
    render();
    // Still compress for storage, but the display uses the original
    state.imageDataURL = toStorageURL(img);
    saveSession();
    playSound(UI_SOUNDS.import, 0.9);
  } catch {
    playSound(UI_SOUNDS.error, 0.9);
    showToast("Couldn't load that URL — make sure it's a direct image link.");
  }
}

/* ── Show / hide preview ────────────────────────────────────── */

function showPreview() {
  els.panel.classList.remove("hidden");
  els.resetBtn.classList.remove("hidden");
  els.sectionStyle.classList.remove("hidden");
  els.sectionElement.classList.remove("hidden");
  els.sectionExport.classList.remove("hidden");
  els.sectionFeedback.classList.remove("hidden");
  updateSoundUI();

  // Re-trigger entrance animation on each new image load
  els.frame.classList.remove("enter-animate");
  els.canvasActions.classList.remove("enter-animate");
  void els.frame.offsetWidth;
  requestAnimationFrame(() => {
    els.frame.classList.add("enter-animate");
    // els.canvasActions.classList.add("enter-animate");
  });
}

function playPasteAnimation() {
  const target = els.frameWrap;
  target.classList.remove("paste-animate");
  void target.offsetWidth;
  target.classList.add("paste-animate");
  target.addEventListener("animationend", () => {
    target.classList.remove("paste-animate");
  }, { once: true });
}

async function resetCanvas() {
  state.image        = null;
  state.imageDataURL = null;
  state.logoImage    = null;
  state.logoDataURL  = null;
  invalidateBlurCache();
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  await loadDemoImage();
  playSound(UI_SOUNDS.reset, 0.82);
}

/* ── Upload zone ────────────────────────────────────────────── */

function initUpload() {
  els.canvasBrowseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    els.fileInput.click();
  });

  els.overlayLogoBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    els.logoFileInput.click();
  });

  els.logoFileInput.addEventListener("change", (e) => {
    if (e.target.files[0]) loadLogoFile(e.target.files[0]);
    els.logoFileInput.value = "";
  });

  els.fileInput.addEventListener("change", (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
    els.fileInput.value = ""; // reset so same file can be re-selected
  });

  els.previewArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    els.previewArea.classList.add("drag-over");
  });
  els.previewArea.addEventListener("dragleave", (e) => {
    if (e.relatedTarget && els.previewArea.contains(e.relatedTarget)) return;
    els.previewArea.classList.remove("drag-over");
  });
  els.previewArea.addEventListener("drop", (e) => {
    e.preventDefault();
    els.previewArea.classList.remove("drag-over");
    void unlockAudio();
    handleFile(e.dataTransfer.files[0]);
  });

  // Global drop anywhere on the page
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    void unlockAudio();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  });
}

/* ── Clipboard paste (⌘V / Ctrl+V anywhere) ─────────────────── */

function isMacPlatform() {
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  return /mac/i.test(platform);
}

function isEditableTarget(target) {
  const element = target instanceof Element ? target : target?.parentElement;
  if (!element) return false;
  if (element.closest("input, textarea, select")) return true;
  const editableAncestor = element.closest("[contenteditable]");
  return editableAncestor instanceof HTMLElement ? editableAncestor.isContentEditable : false;
}

function hasActiveTextSelection() {
  const selection = window.getSelection?.();
  return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
}

function isCopyShortcut(event) {
  if (event.defaultPrevented || event.isComposing || event.repeat) return false;
  if (event.altKey || event.shiftKey) return false;
  if (event.key.toLowerCase() !== "c") return false;
  return isMacPlatform()
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
}

function createCanvasPngBlobPromise() {
  return new Promise((resolve, reject) => {
    els.canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("PNG export failed"));
    }, "image/png");
  });
}

function getClipboardCopyErrorMessage(error) {
  if (!window.isSecureContext) {
    return "Clipboard copy needs HTTPS or localhost.";
  }
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    return "Image copy isn't supported here.";
  }
  if (error?.message === "PNG export failed") {
    return "Couldn't prepare the PNG for copying.";
  }
  if (error?.name === "NotAllowedError") {
    return "Browser blocked clipboard access. Try again.";
  }
  if (error?.name === "AbortError") {
    return "Copy was canceled before it finished.";
  }
  return "Couldn't copy the image.";
}

function copyCanvasToClipboard() {
  if (!state.image) return Promise.resolve(false);
  if (!window.isSecureContext) {
    return Promise.reject(new Error("Clipboard requires a secure context"));
  }
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    return Promise.reject(new Error("Clipboard API unavailable"));
  }
  const clipboardItem = new ClipboardItem({
    "image/png": createCanvasPngBlobPromise(),
  });
  return navigator.clipboard.write([clipboardItem]);
}

function handleCopyToClipboardRequest() {
  if (!state.image) return Promise.resolve(false);
  return copyCanvasToClipboard()
    .then(() => {
      playSound(UI_SOUNDS.copy, 0.88);
      showToast("Copied to clipboard ✓");
      return true;
    })
    .catch((error) => {
      console.error("Clipboard copy failed", error);
      playSound(UI_SOUNDS.error, 0.9);
      showToast(getClipboardCopyErrorMessage(error));
      return false;
    });
}

function initClipboard() {
  document.addEventListener("paste", (e) => {
    if (handleClipboardData(e.clipboardData)) {
      e.preventDefault();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (!isCopyShortcut(e)) return;
    if (!state.image || els.sectionExport.classList.contains("hidden")) return;
    if (isEditableTarget(e.target) || hasActiveTextSelection()) return;
    e.preventDefault();
    void handleCopyToClipboardRequest();
  });
}

/* ── Slider helpers ─────────────────────────────────────────── */

/** Update the CSS --pct variable so the track fill matches the thumb. */
function refreshSlider(slider) {
  const min = parseFloat(slider.min);
  const max = parseFloat(slider.max);
  const val = parseFloat(slider.value);
  const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
  slider.style.setProperty("--pct", pct.toFixed(1) + "%");
}

/**
 * Wire a range slider and a number <input> together.
 * Either control updates state.settings[key], re-renders, and saves.
 */
function connectSlider(slider, numInput, key, min, max) {
  const apply = (raw) => {
    const hasDynamicBounds = key === "overlaySize" || key === "overlayEdgeDistance";
    const sliderMin = Number(slider.min);
    const sliderMax = Number(slider.max);
    const inputMin = hasDynamicBounds && Number.isFinite(sliderMin) ? sliderMin : min;
    const inputMax = hasDynamicBounds && Number.isFinite(sliderMax) ? sliderMax : max;
    const val = clampNumber(Math.round(+raw), inputMin, inputMax);
    if (!Number.isFinite(val)) return;
    state.settings[key] = val;
    if (key === "overlaySize") {
      state.overlaySizeAutoFit = false;
      state.pendingLogoAutoFit = false;
      syncOverlayEdgeDistanceBounds();
    } else if (key === "overlayEdgeDistance") {
      syncOverlayEdgeDistanceBounds();
    } else if (key === "padding") {
      if (state.overlaySizeAutoFit) {
        autoFitActiveOverlaySize();
      } else {
        syncOverlaySizeBounds();
      }
    }
    const appliedVal = state.settings[key];
    slider.value         = appliedVal;
    numInput.value       = appliedVal;
    refreshSlider(slider);
    render();
    saveSession();
  };
  slider.addEventListener("input",    () => {
    apply(slider.value);
    playSliderTick(slider);
  });
  numInput.addEventListener("change", () => apply(numInput.value));
  numInput.addEventListener("change", () => playSound(UI_SOUNDS.slider, 0.72));
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
    if (state.settings.canvasRatio === chip.dataset.ratio) return;
    els.ratioPicker.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    state.settings.canvasRatio = chip.dataset.ratio;
    if (state.overlaySizeAutoFit) {
      autoFitActiveOverlaySize();
    } else {
      syncOverlaySizeBounds();
    }
    render();
    saveSession();
    playSound(UI_SOUNDS.chip, 0.78);
  });

  // Background type
  els.bgTypePicker.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip[data-bg-type]");
    if (!chip) return;
    if (state.settings.bgType === chip.dataset.bgType) return;

    els.bgTypePicker.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    state.settings.bgType = chip.dataset.bgType;
    updateBackgroundUI();
    render();
    saveSession();
    playSound(UI_SOUNDS.chip, 0.78);
  });

  // Background colour
  els.bgColorInput.addEventListener("input", () => {
    state.settings.bgColor = els.bgColorInput.value;
    render();
    saveSession();
  });

  els.bgGradientStartInput.addEventListener("input", () => {
    state.settings.bgGradientStartColor = els.bgGradientStartInput.value;
    render();
    saveSession();
  });

  els.bgGradientEndInput.addEventListener("input", () => {
    state.settings.bgGradientEndColor = els.bgGradientEndInput.value;
    render();
    saveSession();
  });

  els.bgGradientDirectionPicker.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip[data-gradient-direction]");
    if (!chip) return;
    if (state.settings.bgGradientDirection === chip.dataset.gradientDirection) return;
    syncChipPicker(els.bgGradientDirectionPicker, "gradientDirection", chip.dataset.gradientDirection);
    state.settings.bgGradientDirection = chip.dataset.gradientDirection;
    render();
    saveSession();
    playSound(UI_SOUNDS.chip, 0.78);
  });

  els.patternColorInput.addEventListener("input", () => {
    state.settings.patternColor = els.patternColorInput.value;
    render();
    saveSession();
  });

  // Pattern picker (none / noise / dots / grid)
  els.patternPicker.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip[data-pattern]");
    if (!chip) return;
    if (state.settings.pattern === chip.dataset.pattern) return;
    els.patternPicker.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    state.settings.pattern = chip.dataset.pattern;
    const hasPattern = chip.dataset.pattern !== "none";
    els.patternColorControl.classList.toggle("hidden", !hasPattern);
    els.patternScaleControl.classList.toggle("hidden", !hasPattern);
    els.patternBlendControl.classList.toggle("hidden", !hasPattern);
    els.patternOpacityControl.classList.toggle("hidden", !hasPattern);
    render();
    saveSession();
    playSound(UI_SOUNDS.chip, 0.78);
  });

  // Pattern blend mode picker
  els.patternBlendPicker.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip[data-blend]");
    if (!chip) return;
    if (state.settings.patternBlendMode === chip.dataset.blend) return;
    els.patternBlendPicker.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    state.settings.patternBlendMode = chip.dataset.blend;
    render();
    saveSession();
    playSound(UI_SOUNDS.chip, 0.78);
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
  connectSlider(els.overlaySizeSlider, els.overlaySizeVal, "overlaySize", OVERLAY_SIZE_MIN, 40);
  connectSlider(
    els.overlayEdgeDistanceSlider,
    els.overlayEdgeDistanceVal,
    "overlayEdgeDistance",
    OVERLAY_EDGE_DISTANCE_MIN,
    120
  );
  connectSlider(els.overlayOpacitySlider, els.overlayOpacityVal, "overlayOpacity", 10, 100);

  els.overlayTypePicker.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip[data-overlay-type]");
    if (!chip) return;
    if (state.settings.overlayType === chip.dataset.overlayType) return;
    syncChipPicker(els.overlayTypePicker, "overlayType", chip.dataset.overlayType);
    state.settings.overlayType = chip.dataset.overlayType;
    state.overlaySizeAutoFit = state.settings.overlayType !== "none";
    state.pendingLogoAutoFit = state.settings.overlayType === "logo" && !state.logoImage;
    if (state.overlaySizeAutoFit) {
      autoFitActiveOverlaySize();
    }
    updateOverlayUI();
    render();
    saveSession();
    playSound(UI_SOUNDS.chip, 0.78);
  });

  els.overlayPositionPicker.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip[data-overlay-position]");
    if (!chip) return;
    if (state.settings.overlayPosition === chip.dataset.overlayPosition) return;
    syncChipPicker(els.overlayPositionPicker, "overlayPosition", chip.dataset.overlayPosition);
    state.settings.overlayPosition = chip.dataset.overlayPosition;
    if (state.overlaySizeAutoFit) {
      autoFitActiveOverlaySize();
    } else {
      syncOverlaySizeBounds();
    }
    render();
    saveSession();
    playSound(UI_SOUNDS.chip, 0.78);
  });

  els.overlayBlendPicker.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip[data-overlay-blend]");
    if (!chip) return;
    if (state.settings.overlayBlendMode === chip.dataset.overlayBlend) return;
    state.settings.overlayBlendMode = chip.dataset.overlayBlend;
    syncOverlayBlendMode();
    render();
    saveSession();
    playSound(UI_SOUNDS.chip, 0.78);
  });

  els.overlayTextInput.addEventListener("input", () => {
    state.settings.overlayText = els.overlayTextInput.value;
    if (state.overlaySizeAutoFit) {
      autoFitActiveOverlaySize();
    } else {
      syncOverlaySizeBounds();
    }
    render();
    saveSession();
  });

  els.overlayFontSelect.addEventListener("change", () => {
    state.settings.overlayFont = els.overlayFontSelect.value;
    syncOverlayFontSelect();
    if (state.overlaySizeAutoFit) {
      autoFitActiveOverlaySize();
    } else {
      syncOverlaySizeBounds();
    }
    render();
    saveSession();
    playSound(UI_SOUNDS.chip, 0.72);
  });

  els.overlayColorInput.addEventListener("input", () => {
    state.settings.overlayColor = els.overlayColorInput.value;
    render();
    saveSession();
  });

  els.soundPicker.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip[data-sound]");
    if (!chip) return;
    const enabled = chip.dataset.sound === "on";
    if (enabled === state.settings.soundEnabled) return;
    if (!enabled && state.settings.soundEnabled) {
      playSound(UI_SOUNDS.soundOff, 0.78);
    }
    state.settings.soundEnabled = enabled;
    syncChipPicker(els.soundPicker, "sound", enabled ? "on" : "off");
    saveSession();
    updateSoundUI();
    if (enabled) {
      playSound(UI_SOUNDS.soundOn, 0.78);
    }
  });

  els.soundUnlockBtn.addEventListener("click", () => {
    void enableSoundOnDevice();
  });

  // Reset button
  els.resetBtn.addEventListener("click", resetCanvas);
}

/** Push saved settings back into every UI control after session restore. */
function applySettingsToUI() {
  const {
    bgType, bgColor, bgGradientStartColor, bgGradientEndColor, bgGradientDirection,
    pattern, canvasRatio, padding, radius, shadow,
    blurAmount, patternColor, patternScale, patternBlendMode, patternOpacity,
    overlayType, overlayText, overlayFont, overlayColor, overlayBlendMode,
    overlaySize, overlayEdgeDistance, overlayOpacity, overlayPosition,
    soundEnabled,
  } = state.settings;

  els.bgColorInput.value = bgColor;
  els.bgGradientStartInput.value = bgGradientStartColor;
  els.bgGradientEndInput.value = bgGradientEndColor;
  els.patternColorInput.value = patternColor
    || adaptivePatternColor(getBackgroundReferenceColor(state.settings), bgType === "blur");

  syncChipPicker(els.bgTypePicker,  "bg-type", bgType);
  syncChipPicker(els.ratioPicker,    "ratio",   canvasRatio);
  syncChipPicker(els.patternPicker,  "pattern", pattern);
  syncChipPicker(els.bgGradientDirectionPicker, "gradientDirection", bgGradientDirection);
  syncChipPicker(els.soundPicker, "sound", soundEnabled ? "on" : "off");

  // Show controls based on selections
  updateBackgroundUI();
  const hasPattern = pattern !== "none";
  els.patternColorControl.classList.toggle("hidden", !hasPattern);
  els.patternScaleControl.classList.toggle("hidden", !hasPattern);
  els.patternBlendControl.classList.toggle("hidden", !hasPattern);
  els.patternOpacityControl.classList.toggle("hidden", !hasPattern);
  syncChipPicker(els.overlayTypePicker, "overlayType", overlayType);
  syncChipPicker(els.overlayPositionPicker, "overlayPosition", overlayPosition);
  syncChipPicker(els.overlayBlendPicker, "overlayBlend", overlayBlendMode);
  els.overlayTextInput.value = overlayText;
  els.overlayFontSelect.value = overlayFont;
  syncOverlayFontSelect();
  els.overlayColorInput.value = overlayColor;
  els.overlaySizeSlider.value = overlaySize;
  els.overlaySizeVal.value = overlaySize;
  refreshSlider(els.overlaySizeSlider);
  els.overlayEdgeDistanceSlider.value = overlayEdgeDistance;
  els.overlayEdgeDistanceVal.value = overlayEdgeDistance;
  refreshSlider(els.overlayEdgeDistanceSlider);
  els.overlayOpacitySlider.value = overlayOpacity;
  els.overlayOpacityVal.value = overlayOpacity;
  refreshSlider(els.overlayOpacitySlider);
  updateOverlayUI();

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

  updateSoundUI();
}

function toDataAttrKey(dataKey) {
  return dataKey.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function toDatasetKey(dataKey) {
  return dataKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function syncChipPicker(container, dataKey, value) {
  const attrKey = toDataAttrKey(dataKey);
  const datasetKey = toDatasetKey(attrKey);
  container.querySelectorAll(`.chip[data-${attrKey}]`).forEach((c) => {
    c.classList.toggle("active", c.dataset[datasetKey] === value);
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
    playSound(UI_SOUNDS.download, 0.92);
    showToast("Downloaded ✓");
  });

  els.copyBtn.addEventListener("click", () => {
    void handleCopyToClipboardRequest();
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
      imageDataURL: state.isDemo ? null : state.imageDataURL,
      logoDataURL:  state.logoDataURL,
    }));
  } catch { /* quota exceeded — fail silently */ }
}

async function restoreSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (saved.settings) {
      // Migrate old blur pattern to new bgType
      if (saved.settings.pattern === "blur") {
        saved.settings.bgType = "blur";
        saved.settings.pattern = "none";
      }
      applySettings(saved.settings);
    }
    if (saved.imageDataURL) {
      await setImage(saved.imageDataURL, {
        persist: true,
        label: "my-image.png",
        isDemo: false,
      });
      if (saved.logoDataURL) {
        await setLogoImage(saved.logoDataURL);
      }
      return true;
    }
    if (saved.logoDataURL) {
      await setLogoImage(saved.logoDataURL);
    }
    return false;
  } catch {
    localStorage.removeItem(SESSION_KEY); // corrupted — start fresh
    return false;
  }
}

/* ── Resize — re-render on container size change ────────────── */

let resizeTimer = null;

window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (state.image) render(); }, 120);
});

/* ── Init ───────────────────────────────────────────────────── */

async function init() {
  state.canvasBlurMode = detectNativeCanvasBlurSupport() ? "native" : "software";
  invalidateBlurCache();
  primeAudioOnFirstGesture();

  // Initialise slider track fills from their default HTML values
  refreshSlider(els.paddingSlider);
  refreshSlider(els.radiusSlider);
  refreshSlider(els.shadowSlider);
  refreshSlider(els.blurSlider);
  refreshSlider(els.patternScaleSlider);
  refreshSlider(els.patternOpacitySlider);
  refreshSlider(els.overlayEdgeDistanceSlider);

  initUpload();
  initClipboard();
  initControls();
  initExport();
  const restored = await restoreSession();
  if (!restored) {
    await loadDemoImage();
  }
}

document.addEventListener("DOMContentLoaded", init);
