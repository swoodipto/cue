# Cue — Codebase Systemization & Design-Token Refactor

> **Brief for:** Fable 5
> **Prepared by:** scoping session with the maintainer (sudipto)
> **One rule above all others:** the app's rendered output — both the on-screen UI and every exported PNG — must be **byte-for-byte identical** before and after your work. This is a structural and organizational refactor only. If a change alters a single pixel or a single behavior, it is out of scope.

---

## ✅ EXECUTION REPORT (2026-07-06)

**Status: COMPLETE — all hard gates passed.** Executed by Fable 5 on branch
`refactor`. Baseline commit `d3d0f00` → final commit `b3d261f`, one commit per
phase as required by §14. Zero pixel, computed-style, or behavior drift.

### Work performed, by phase

**Phase 0 — Baseline capture.**
Built a deterministic verification harness instead of manual download-and-diff
(equivalent per the code: the Download button exports `els.canvas.toDataURL()`
directly, so hashing the preview canvas's raw `getImageData` *is* the export
pixel check). Seeded `localStorage["cue_v5"]` with a fixed profile using
`assets/tweet.png` as both image and logo (sound off), then drove the real UI
by programmatically clicking chips through the §13.1 matrix. Captured:

- **13 export states** (FNV-1a pixel hashes): `solid`/`blur` × `none`/`dots`/
  `grid` (incl. one blend-mode change), overlay `text` and `logo`, ratios
  `free`/`16:9`/`1:1`, plus `bgType:"gradient"` seeded via localStorage to
  exercise the latent path. Determinism proven by an identical re-run.
- **4 computed-style snapshots**: every element (233) × every non-custom
  computed property × element/`::before`/`::after`, at 1280×800 and 375×812,
  in two control-visibility states (solid+dots, blur+none). Full snapshots
  gzip-stored for property-level drill-down on mismatch.
- Console baseline (service-worker logs only) and a noise-pattern reference
  screenshot. The service worker was unregistered and caches cleared before
  every capture so cache-first serving couldn't poison comparisons.

**Phase 1 — Token layer (`styles.css`) — commit `3e2a760`.**
Extended `:root` with **160 new tokens**; all 17 pre-existing tokens kept
with names and values untouched. Categories per §8: brand/accent/danger
color; the alpha-tint scale in exact 8-digit hex (`--tint-black-15` =
`#00000015`; rgba-notation tints kept separately as `--tint-*-aNN`);
role-based surface and border tokens (same value under distinct roles per
§6.2, e.g. `--color-black` vs `--color-text`); the noise-texture data-URI;
`--space-2…40`; radii incl. the documented `--radius-fader: 14px / 2px`
special; font sizes/weights/line-heights/letter-spacings; durations
0.12–0.25s + `--ease-spring: cubic-bezier(0,.69,.1,1.64)`; z-layers
0/1/2/20/200; dimensions (`--panel-h-mobile`, `--swatch-size`,
`--btn-primary-h`, icon/thumb/track sizes); **23 composite shadow /
text-shadow / drop-shadow stacks** (card ring, btn base/hover/active, frame,
preview edge+frame, panel edge, section divider, pill, kbd, chip
pressed/active, badge, input inset, slider tracks h+v, thumb, reset
hover/active, toast, three embosses, chip-active text glow). Substituted
literals in place — no selector, specificity, or cascade-order changes; both
duplicate `.preview-area`/`.panel` definitions preserved as separate blocks
(now marked with a comment). Single-use colored alphas (danger reds, warm
browns, accent glows, `#333333`-family embosses) stay inline *inside* their
composite token definitions; deliberate one-off literals stay inline and are
listed in DESIGN-SYSTEM.md.

**Phase 2 — DESIGN-SYSTEM.md — commit `1dd40f5`.**
New 560-line reference at repo root: overview of the design language; full
token tables (`name | value | role`) incl. the four unused chip tokens and
`--radius-chip` marked "defined, currently unused"; the alpha-tint naming
scheme and the exact-hex rationale (§10.3); component contracts for all nine
§9 patterns + the logo (purpose, markup contract, states, tokens consumed);
naming conventions and JS state classes; the desktop→mobile responsive
model; and the §12 preserved-quirks list expanded with new observations
(below). Class-contract review found the existing markup already consistent;
the "inconsistencies" (`.cortshuts` spelling, styled-but-unused classes)
cannot be normalized without pixel/HTML changes, so they are documented as
deviations per §9 — **no HTML was touched**.

**Phase 3 — `app.js` reorganization — commit `ac5b04e`.**
Comments only, per "if in doubt, prefer comments over motion": a 19-entry
table-of-contents block after the file header (noting where the unbannered
subsections live — the overlay placement engine inside "Canvas render",
`applySettingsToUI`/`syncChipPicker` inside "Controls"), and the one
inconsistent section banner (URL loading) normalized to the shared style
with its parenthetical preserved on a second line. **No function was moved,
renamed, or reordered**; no executable statement touched. Module syntax
verified with `node --check`; behavior re-verified in-browser.

**Phase 4 — Final gate + deploy bump — commit `b3d261f`.**
Full §13 re-run on the finished work (results below), §13.4 diff review,
then the single `service-worker.js` change: `CACHE_NAME` `"cue-v21"` →
`"cue-v22"`. Verified live: new SW activates, creates `cue-v22`, deletes
`cue-v21`.

### Verification results (§13)

| Gate | Result |
|---|---|
| §13.1 export matrix | **13/13 states pixel-hash identical** before/after |
| §13.2 computed-style snapshots | **4/4 identical** (desktop + mobile widths, two control states; all non-custom properties incl. pseudo-elements) |
| Extra gate: var() resolver | Script substitutes every token back into the stylesheet → resolves **character-identical** to the pre-refactor CSS |
| §13.3 QA (automatable items) | Session restore, `pattern:"blur"`→`bgType:"blur"` migration (migrated render hash equals the blur baseline), hex normalization (`fff` → `#ffffff`, `#FFAA00` → `#ffaa00`), number-input clamping (999→120), Enter-to-blur, "Downloaded ✓" toast, mobile snap-rail + ratio edge-fade toggle on scroll, entrance/paste animation classes — all behave as baseline |
| Console | Identical to baseline (SW registration logs only; no errors/warnings) |
| Comment preservation | `styles.css` 61/61 original comments verbatim (every commented-out block survives); `app.js` 30/31 — the 31st is the URL-loading banner, deliberately normalized |
| File set | `index.html` **byte-identical**; `manifest.json`/`LICENSE`/`CLAUDE.md` untouched; no files added except `DESIGN-SYSTEM.md` |
| §13.4 diff review | Every hunk classifies as (a) token definition, (b) identical-value substitution, (d) added comments/banners, (e) DESIGN-SYSTEM.md, or (f) the CACHE_NAME bump. Category (c) unused — nothing was moved |

> **Noise note (per §13.1 caveat):** `pattern:"noise"` was excluded from
> pixel-equality as instructed — `paintNoise()` randomizes per-pixel alpha,
> so it can never diff to zero. It was verified instead by (a) the diff
> showing its code path untouched and (b) a visual spot-check against the
> baseline screenshot. **A noise mismatch in any future naive pixel-diff is
> expected, not a regression.**

### Bugs caught and fixed by the gates (before committing)

1. **Slider-gradient token broke the `--pct` fill.** First attempt tokenized
   the track-fill gradients as `:root` tokens. Custom-property `var()`
   substitution happens where the property is *defined*, so `var(--pct, 50%)`
   baked in its 50% fallback at `:root` and froze every track fill — caught
   by the §13.2 snapshot (radius slider at 50% instead of 30%), invisible to
   textual checking. The gradients are deliberately inline on `.slider`
   (desktop + mobile) with a warning comment in `:root` and a note in
   DESIGN-SYSTEM.md §2.14.
2. **`*/` inside the app.js TOC.** `getOverlay*/paintOverlay` terminated the
   block comment early and would have broken the whole module — caught by
   the syntax check, rewritten as `getOverlay…, paintOverlay`.

### §15 additions — observations (documented, not fixed)

- `#soundHelperText` is commented out in `index.html`, so
  `els.soundHelperText` is `null` and `updateSoundUI()` always returns at
  its guard clause — the sound helper texts and the iOS manual-unlock reveal
  are currently inert.
- `.export-note` and `.frame-hint` are styled but have no live markup;
  `.header`/`.header-tagline` rules serve the commented-out header while
  `#imageLabel` reuses `header-tagline` (hidden on desktop).
- `.section-label` declares `font-weight: 600` then `500` in the same rule
  (the `500` wins); mobile `.panel .chip-row` ends `gap` with no semicolon.
  Both preserved.
- **Rename proposal only:** `.cortshuts` → `.shortcuts` (used in HTML + CSS;
  not performed per decision #2).

### Deviations from the brief's letter (none from its intent)

- §13.1 suggested downloading PNGs and running pixelmatch/ImageMagick; the
  harness hashes the export canvas's raw pixels instead (the download *is*
  that canvas, and raw-buffer comparison is strictly stronger than comparing
  PNG encodings). Requirement met: 0 differing pixels across the matrix.
- §11 allowed grouping hoisted declarations; after review, no motion
  improved on the existing grouping, so the JS diff is comments-only — the
  bar §11 itself set ("added a TOC and tidied banners, nothing more").

---

## 1. Overview

Cue is a no-login, no-build, vanilla HTML/CSS/JS web app that turns a screenshot or pasted image into a clean, exportable mockup. It is feature-complete and in production on GitHub Pages. The three source files (`index.html`, `styles.css`, `app.js`) have grown organically, and most design values (colors, multi-layer shadows, spacing, radii, typography, transitions) are hardcoded and repeated inline rather than expressed through a token system.

Your job is to **systematize the codebase into a documented design system** — a complete CSS custom-property token layer, consistent and documented CSS component contracts, a written design-system reference, and a lightly reorganized `app.js` — **without changing any functionality, any visual output, or the language/stack.**

This is not a redesign, a rewrite, a framework migration, or a bug-fix pass. It is a "make the existing thing legible and maintainable, changing nothing the user can perceive" pass.

---

## 2. Why this refactor

The app works and looks the way the maintainer wants. What's missing is *internal* structure:

- Design values are scattered as literals. The same multi-layer shadow appears in multiple selectors; the same alpha-black tint is retyped in dozens of `box-shadow`s; spacing and radii are ad-hoc magic numbers. Changing "the shadow on cards" means hunting through 1,500 lines.
- There is a partial token block in `:root` (~17 tokens) but it covers a fraction of the values actually in use, and much of it predates later styling (some tokens are now unused).
- Repeated markup patterns (chips, control-sets, slider rows) have no documented contract, so it's easy to add an inconsistent one.

The goal state: a maintainer (or a future agent) can read `DESIGN-SYSTEM.md`, understand every token and component, and make a global visual change by editing one token — with confidence that nothing silently drifted.

---

## 3. The four locked decisions

These were decided during scoping. Do not revisit them.

| # | Decision | What it means for you |
|---|----------|-----------------------|
| 1 | **`app.js` stays one file, reorganized in place** | No ES-module split. No new `.js` files. Tighten section ordering, grouping, and comments only. |
| 2 | **Preserve everything** | Do **not** delete commented-out code, remove stale references, or fix latent typos/quirks. Reorganize and tokenize around them. See §12. |
| 3 | **Full token system + reference doc** | Comprehensive tokens covering color, shadow, spacing, radius, typography, and transitions, all resolving to today's exact values, plus a new `DESIGN-SYSTEM.md`. |
| 4 | **"Componentize" = document CSS patterns only** | Treat repeated markup as documented CSS components with consistent class contracts. **HTML stays static and hand-written. No JS-generated DOM.** |

---

## 4. Goals & success metrics

**Primary goal:** A fully tokenized, documented design system with zero perceptible change to the product.

Success is measured by:

1. **Pixel parity.** Deterministic PNG exports are identical before/after (§13.1), and a computed-style snapshot of the UI is identical before/after (§13.2). Both are hard gates.
2. **Behavior parity.** Every item on the QA checklist (§13.3) behaves exactly as it did on the pre-refactor commit.
3. **Token coverage.** The overwhelming majority of design literals in `styles.css` are expressed as tokens; remaining inline literals are deliberate, documented one-offs.
4. **Documentation completeness.** `DESIGN-SYSTEM.md` documents every token and every CSS component's contract, states, and the tokens it consumes.
5. **Diff legibility.** Every line of the diff falls into exactly one of: token definition, value→token substitution (identical computed value), safe reordering of hoisted function declarations, or added comments/docs. Nothing else.

**Secondary goal:** `app.js` is easier to navigate (table of contents, consistent section banners, related helpers grouped) without any logic change.

---

## 5. Scope

### In scope

- **`styles.css`** — build the token layer in `:root`; substitute hardcoded values with `var(--token)` references where the computed result is identical; add composite shadow/transition tokens; add clarifying section comments. Consistency of class contracts.
- **`app.js`** — in-place reorganization: a top-of-file table of contents, consistent section-banner comments, grouping of related function *declarations* within their existing sections. No logic, naming, or ordering changes to executable code.
- **`DESIGN-SYSTEM.md`** — new documentation file at repo root (see §10).
- **`service-worker.js`** — a **single** change only: bump `CACHE_NAME` (see §6, deploy note). Nothing else in this file.

### Out of scope / Non-goals

- **No visual change.** No color, spacing, shadow, radius, font, or timing may resolve to a different value. If tokenizing something is even slightly lossy, leave it inline and note it.
- **No behavioral change.** No new features, no removed features, no altered interactions, no changed defaults, no reworded toasts, no changed keyboard shortcuts.
- **No HTML restructuring.** Do not convert markup to JS templates, do not migrate inline `style="…"` attributes into CSS, do not rename IDs or classes that JS depends on, do not touch inline SVG markup or the data-URI favicon/manifest icons. Adding a small number of explanatory HTML comments is the *most* you should do to `index.html`, and only if it changes nothing.
- **No JS module split, no build step, no dependencies, no framework, no bundler, no preprocessor (Sass/Less/PostCSS).** The stack stays pure HTML/CSS/JS served statically.
- **No dead-code removal, no "helpful" bug fixes, no reference cleanup.** See §12.
- **No tokenizing of JS values.** Color/number literals in `app.js` (e.g. `DEFAULT_SETTINGS.bgColor`, `DEMO_IMAGES`, canvas presets, audio volumes) are application data and logic, not design tokens. Leave them.
- **No changes to `manifest.json`, the GitHub Pages workflow, `LICENSE`, or `CLAUDE.md`.**
- **No renaming of existing tokens** (`--color-bg`, `--panel-w`, etc.). They're referenced throughout; keep the names, extend the set.

---

## 6. Hard constraints (read before touching anything)

1. **Identical computed output.** A token substitution is valid **only if** the resolved value is unchanged. `color: #ffffff` → `color: var(--color-white)` is valid *iff* `--color-white: #ffffff`. Never let a token round, normalize, or "clean up" a value (e.g. do not turn `#00000015` into `rgba(0,0,0,.08)` — `0x15` is `8.2%`, not `8%`; keep the exact 8-digit hex).
2. **Map tokens by role, not just by value.** `#ffffff` used as button-text and `#ffffff` used as a hairline highlight should map to semantically distinct tokens even though they're equal today. This is what makes the system usable later. But never let this change a resolved value.
3. **Do not merge or reorder CSS in ways that change the cascade.** `styles.css` intentionally defines some selectors more than once (e.g. `.preview-area` at ~line 183 and again ~line 367; `.panel` at ~line 352 and ~line 376). These layer deliberately. Do not consolidate them, and do not reorder declarations across selectors of equal specificity. Tokenize in place.
4. **Do not change specificity.** No converting inline styles to classes, no adding/removing `!important`, no changing selector shapes.
5. **Preserve the file set and entry points.** `index.html` loads `styles.css` and `app.js` (`<script type="module">`); `app.js` imports `./vendor/web-kits-audio.js` and `./patches/minimal-patch.js`; the service-worker registration is an inline script in `index.html`. Do not rename, move, add (except `DESIGN-SYSTEM.md`), or remove files. **Keep tokens inside `:root` in `styles.css`** — do **not** create a separate `tokens.css`, because that would require a new `<link>` in `index.html` and a new entry in the service worker's `APP_SHELL`, expanding the change surface for no benefit.
6. **Deploy note (the one service-worker change).** The service worker (`service-worker.js`) caches `styles.css` and `app.js` by name under `CACHE_NAME = "cue-v21"` and serves cache-first. Because your refactor changes the *bytes* of those files (even though the render is identical), returning users would otherwise be served stale copies until the cache name changes. **Bump `CACHE_NAME` to `"cue-v22"`** as the final step so the new files are picked up on deploy. This is a cache-invalidation change, not a behavior change. Change nothing else in that file.
7. **Preserve the browser-support baseline.** The app already relies on modern features: CSS `:has()`, `@property` (`--ratio-fade-top`), `backdrop-filter`, canvas `ctx.filter`, `Intl.Segmenter`, `ClipboardItem`, ES modules. Do not add features that narrow support and do not add polyfills. Match today's baseline exactly.

---

## 7. Codebase map (so you don't have to rediscover it)

**`index.html` (~644 lines).** `<main class="layout">` with a center `.preview-area` (holds `#previewCanvas`, the `.canvas-actions` upload pill, and the toast) and a right `.panel` (`#panel`, hidden until an image loads). Panel sections: `#section-header` (logo + image label + reset), `#section-element` ("Subject": padding/radius/shadow sliders + a hidden overlay block), `#section-style` ("Backdrop": canvas ratio, background type, color/gradient/blur controls, pattern controls), `#section-export`, `#section-feedback` (sound). Note: the gradient background chip is commented out in the markup (~line 354) but the gradient code path in `app.js` is intact — treat gradient as a latent, preserved feature. There are commented-out blocks (the old `<header>` ~lines 14–20, a `#section-danger` ~lines 608–615) and inline styles (e.g. `style="display: none;"` on the overlay group). Leave all of it.

**`styles.css` (~1,531 lines).** Reset → `:root` tokens (~lines 18–44) → base → header/logo → layout → preview area (with an SVG-noise `::before`) → canvas frame + keyframes → panel → controls (`.chip`, `.control-set`, `.control-row`, `.slider`, `.color-swatch`) → export buttons → utility → toast → a large `@media (max-width: 680px)` block (~lines 1128–1531) that reflows the desktop right-panel into a horizontal, snap-scrolling card rail with vertical sliders. Contains multiple commented-out style experiments and two latent typos (§12).

**`app.js` (~2,736 lines, one ES module, `"use strict"`).** Already sectioned with comment banners in this order: State / reduced-motion → `DEFAULT_SETTINGS`, `DEMO_IMAGES`, overlay + blur constants → canvas presets → audio feedback (large) → shadow compositing → pattern helpers (noise/dots/grid/blur, color math) → DOM refs (`const $ = getElementById`, the `els` map) → canvas `render()` and layout → overlay placement engine → image loading → URL loading → show/hide preview → upload zone → clipboard → slider helpers (`refreshSlider`, `connectSlider`) → controls wiring (`initControls`) → `applySettingsToUI` → chip-picker sync → export → toast → session persistence (`SESSION_KEY = "cue_v5"`, with a `pattern:"blur"` → `bgType:"blur"` migration) → resize → `init()` on `DOMContentLoaded`. Central `state` object and `state.settings`. Export renders at `SCALE = 2`.

---

## 8. Work item A — CSS design-token layer

Build a complete, organized token set in `:root` (extending the existing block; keep existing names and values). Every new token's value must equal the literal it replaces.

**Token categories to define (representative, not exhaustive — cover what's actually used):**

- **Brand & core color:** the brand black `#1a1a1a` and white `#ffffff`; the accent/"active" family (`#ff613d`, `#b02f00`, `#f0e2da`, `#ff4400…`, toast `#f55a1c`); the danger/reset family (`#ffcfcf`, `#8a0000`, `#fe71718a…`).
- **Surfaces:** app bg `#eeece6`, panel `hsl(50, 9%, 81%)`, button surface `#e0deda`/`#e1ddd7`, input surfaces `#ffffff`/`#f7f7f7`/`#efefef`.
- **Semantic color:** already present — `--color-border`, `--color-border-focus`, `--color-text`, `--color-text-muted`, `--color-text-faint`. Keep and reuse.
- **Alpha tints (the biggest win).** Dozens of shadows use black/white at fixed alphas as 8-digit hex: `#00000015`, `#0000001c`, `#0000002e`, `#00000012`, `#ffffff8f`, `#ffffff91`, `#ffffff9e`, `#ffffffd1`, etc. Define a documented, exact-value tint scale (keep the precise hex; do not convert to `rgba()` with rounded percentages). Decide one consistent naming scheme and document it in `DESIGN-SYSTEM.md`.
- **Composite shadow tokens.** Extract the repeated multi-layer shadows into named tokens and reference them. High-value targets because they repeat: the `.control-set` inset ring (`inset 0 0 0 1px #ffffff8f, 0 1px 2px 1px #00000015`, which recurs in the mobile `.panel-section` rule), the `.btn-wrapper button` base/hover/active stacks, `.frame`, the second `.preview-area`, `.toast`, `.chip.active`/`.chip:active`, the slider track insets, `.color-swatch`, `.canvas-actions`, `.logo-version`, and the `#section-header` divider. Each token must reproduce its source stack exactly.
- **Spacing scale:** the recurring pixel steps (observed: 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40). Map paddings/margins/gaps to a scale where the value is exact; leave genuinely one-off measurements inline and note them.
- **Radii:** 4, 6, 7, 8, 10, 14, 16, and the pill `99` (already `--radius-chip`). Include the vertical-slider `14px / 2px` case as a documented special.
- **Typography:** font sizes (9, 10, 11, 12, 12.5, 13, 20, 32), weights (400/500/600), the two existing font-stack tokens, plus the letter-spacing and line-height values in use.
- **Transitions & easing:** durations (0.12, 0.15, 0.16, 0.18, 0.2, 0.25s) and easings (`ease`, `ease-in-out`, and the shared `cubic-bezier(0, .69, .1, 1.64)` used by the entrance/paste animations).
- **Z-index layers:** the discrete levels in use (0, 1, 2, 20, 200).
- **Dimensions:** keep `--header-h`, `--panel-w`; consider tokens for the mobile panel height (`262px`), swatch size (`30px`), primary button height (`50px`) where they aid clarity.

**Substitution rules:** replace literals with `var(--token)` only when identical; prefer role-based token names; never introduce a token that changes a resolved value; leave existing unused tokens in place (document them as "defined, currently unused").

---

## 9. Work item B — CSS component documentation & class contracts

Identify the recurring UI patterns as CSS "components," make their class usage consistent (without changing any rendered result or any class name JS relies on), and document each in `DESIGN-SYSTEM.md`. The components:

- **Chip** (`.chip`, shares a rule with `.reset-btn`) — states `:hover`, `:active`, `.active` (the orange treatment), `:disabled`; used in every `.chip-row` picker.
- **Control set / control row** (`.control-set`, `.control-row`, `.control-row--stacked`) — the card surface and label/value layout.
- **Slider** (`.slider`) — horizontal on desktop, reflowed to a vertical fader in the mobile block; the JS-driven `--pct` track fill.
- **Numeric readout** (`.val-group`, `.control-val`, `.control-val--hex`).
- **Color swatch** (`.color-swatch`).
- **Buttons** (`.btn-wrapper` + `.export-btn`/`.copy-btn`, `.secondary-btn`, `.canvas-browse-btn`, `.reset-btn`).
- **Canvas actions pill** (`.canvas-actions`, `.cortshuts`).
- **Toast** (`.toast`, `.toast.show`).
- **Panel section** (`.panel-section`, `.section-label`) and the **logo** (`.logo`, `.logo-mark`, `.logo-text`, `.logo-version`).

Also document the **naming convention already in use** so future markup follows it: block / `block--modifier` (e.g. `control-row--stacked`, `control-val--hex`, `canvas-actions-label--handy`) plus state classes toggled by JS (`.active`, `.hidden`, `.drag-over`, `.is-scrolled`, `.show`, `.enter-animate`, `.paste-animate`). Document the **responsive strategy** (desktop right rail → mobile horizontal snap-card rail with vertical sliders). Consistency work must be limited to non-visual normalization; if making a class contract "consistent" would change any pixel, don't — document the deviation instead.

---

## 10. Work item C — DESIGN-SYSTEM.md

A new markdown file at repo root. Suggested contents:

1. **Overview** — the design language in a paragraph (warm off-white surfaces, soft inset "letterpress" shadows, an orange active accent, system fonts).
2. **Token reference** — every token grouped by category, as tables of `name | value | role / where used`.
3. **The alpha-tint scheme** — explain the naming and why exact 8-digit hex is preserved rather than `rgba()`.
4. **Component reference** — for each component in §9: purpose, required markup/class contract, variants, states, and the tokens it consumes.
5. **Naming conventions & state classes** — the block/modifier + JS-state-class rules.
6. **Responsive model** — the desktop→mobile transformation.
7. **Preserved quirks / known tech debt** — list the items in §12 explicitly, marked "intentionally preserved as of this refactor," so a future reader doesn't think they're mistakes to fix blindly.

---

## 11. Work item D — app.js in-place reorganization

Conservative and low-touch. Allowed:

- Add a **table-of-contents comment** at the top listing the sections in order.
- Standardize the **section-banner comments** to one consistent style.
- **Group related function *declarations*** nearer each other *within their existing section* (function declarations are hoisted, so relocating them among other declarations is behavior-safe).

**Not allowed (breakage risk):**

- Do **not** reorder or move any **top-level executable statement** or initialization whose order matters — e.g. the `import` lines, `state.settings = { ...DEFAULT_SETTINGS }`, `const ctx = els.canvas.getContext("2d")`, the `els` object construction, the `soundState`/`sliderSoundTimestamps` setup, event-listener registration order inside the `init*` functions, or the `DOMContentLoaded` handler.
- Do **not rename** identifiers (functions, variables, constants). Renames ripple to call sites and risk silent breakage; the maintainer chose "preserve everything." If you believe a rename adds real value, list it in §15 as a proposal — don't perform it.
- Do **not** remove the stale `els.blurControl` entry or any other dead reference (§12).
- Do **not** extract anything into new files.

If in doubt, prefer comments over motion. The bar: the JS diff should read as "added a TOC and tidied banners," nothing more.

---

## 12. Explicitly preserve (known quirks — do NOT fix)

These look like mistakes. The maintainer has chosen to preserve them so that rendered behavior cannot change. Leave each exactly as-is (you may *document* them in `DESIGN-SYSTEM.md` §7, but do not alter them):

- **`styles.css` ~line 258** — `.frame { … transition: box-shadow 0.15s easetransform 0.15s ease; }`. `easetransform` is malformed, so the transform transition is currently inert. **Fixing it would introduce a new animation → forbidden.** Preserve verbatim.
- **`styles.css` ~line 136** — inside `.logo`, a stray backtick (`` ` ``) trailing the `text-shadow` declaration. Preserve.
- **`app.js` ~line 977** — `blurControl: $("blurControl"), // old, remove?`. There is no `#blurControl` element (the real one is `#bgBlurControl`), so this resolves to `null` and is unused. Preserve the line and its comment.
- **Commented-out code** — the old `<header>` and `#section-danger` in `index.html`; the alternate `.canvas-actions`, alternate slider styles, `.chip.active` variants, and `.panel-section.bottom` blocks in `styles.css`. Preserve all.
- **Duplicate selectors** — `.preview-area` and `.panel` are each defined more than once by design. Preserve as separate blocks.
- **Defined-but-unused tokens** — e.g. `--color-chip-active-bg`, `--color-chip-active-text` predate the current orange chip styling. Keep them; mark as unused in the docs.
- **Latent gradient feature** — the gradient chip is commented out in HTML but the JS path lives on. Keep the code path and its controls markup intact.

If you spot additional quirks, **add them to §15 as observations**; do not fix them.

---

## 13. Verification & anti-regression protocol

Both an automated pixel/style comparison **and** a manual checklist are required. Run the baseline captures on the **pre-refactor commit first**, then re-run identically on the finished work.

### 13.1 PNG export-diff (automated)

Make the export deterministic so a pixel comparison is meaningful:

1. Load a **fixed** source image (not the random demo) — e.g. drag in `assets/tweet.png` via the file picker so the input is constant.
2. Force a **fixed settings profile** by seeding storage from the console, then reloading: `localStorage.setItem('cue_v5', JSON.stringify({ settings: { …profile… } }))`. This makes every control's value deterministic.
3. Click **Download PNG** to produce the baseline. Repeat on the post-refactor build → candidate.
4. Compare with a pixel differ (e.g. `pixelmatch`, or ImageMagick `compare -metric AE a.png b.png`). **Requirement: 0 differing pixels.**

Run this across a **matrix** of deterministic states: `bgType: solid` and `bgType: blur`, each crossed with `pattern: none | dots | grid`; plus one `overlay: text` and one `overlay: logo` case; plus at least two `canvasRatio` values (`free` and one preset). Optionally seed `bgType: gradient` to exercise the latent path.

> **Critical caveat — exclude `pattern: noise` from pixel-equality.** `paintNoise()` fills each pixel's alpha with `Math.random()` (`app.js` ~line 830), so noise exports are non-deterministic and will *never* diff to zero — a mismatch there is expected, not a regression. Verify noise instead by (a) confirming its code path is unchanged in the diff and (b) a visual spot-check. Note this explicitly in your results so the maintainer isn't alarmed.

### 13.2 Computed-style snapshot diff (automated — the real guard for tokenization)

Token substitution errors show up as changed *computed* styles even when the source looks fine. Before refactoring, run a console snapshot that walks every element and records `getComputedStyle` for the relevant properties (color, background, background-image, border, box-shadow, border-radius, padding, margin, gap, font, letter-spacing, line-height, transition, transform, opacity, z-index, width, height), serialize to JSON, and save. Re-run on the finished build and diff. **Requirement: identical.** Do this at **both** a desktop width and a mobile width (< 680px) so the responsive block is covered. Capture the empty state and the image-loaded state (panel visible).

### 13.3 Manual QA checklist (every item must behave as on the pre-refactor commit)

**Input paths**
- [ ] First visit loads a random demo image; empty state looks correct.
- [ ] File picker (upload button + canvas pill) loads an image.
- [ ] Drag-and-drop onto the preview, and anywhere on the page, loads an image.
- [ ] Clipboard paste of an image (⌘V / Ctrl+V) loads it, with the paste animation.
- [ ] Paste of a direct image URL loads it; paste of HTML containing an `<img>` loads it.
- [ ] Invalid image / bad URL shows the correct error toast and error sound.

**Controls (each updates the preview live and persists)**
- [ ] Canvas ratio: all six chips (Wrap/free, 4:3, 16:9, 1:1, 9:16, 3:4).
- [ ] Background type: Solid and Blur; blur-amount slider (4–80).
- [ ] Background color picker + hex text input (typing `fff` and `#FFAA00` both normalize).
- [ ] Pattern: None / Noise / Dots / Grid; pattern color + hex; blend (Normal/Overlay/Screen/Hard Light); scale; opacity.
- [ ] Subject sliders + number inputs: padding (0–120), radius (0–60), shadow (0–100), including Enter-to-blur on the number fields.
- [ ] Overlay logic (text/logo/position/blend/size/opacity/edge-distance) works as before, including auto-fit sizing. (The overlay type picker is hidden by default — verify its current visibility is unchanged.)
- [ ] Sound On/Off; on iOS the manual "Enable Sound" unlock appears/behaves as before; `prefers-reduced-motion` still drives the sound default.

**Export**
- [ ] Download PNG saves `cue-export.png` at 2× and shows the "Downloaded ✓" toast.
- [ ] Copy to clipboard via the button and via ⌘C/Ctrl+C; correct success/error toasts; copy is suppressed while typing in a field or when text is selected.

**Session & PWA**
- [ ] Refresh restores settings, image, and logo (`localStorage` key `cue_v5`).
- [ ] The `pattern:"blur"` → `bgType:"blur"` migration still runs for old saved state.
- [ ] Service worker registers; app loads offline after first visit; after deploy, the bumped `CACHE_NAME` serves the new files.

**Responsive & motion**
- [ ] Below 680px, the panel becomes the horizontal snap-card rail with vertical sliders; the ratio stack's edge-fade toggles on scroll.
- [ ] Entrance and paste animations play; resizing the window re-renders the canvas.

**Console**
- [ ] No new errors or warnings versus the pre-refactor build.

### 13.4 Diff-review gate

Before hand-off, read the full `git diff`. Every hunk must be classifiable as: (a) a token definition, (b) a value→token substitution with identical computed value, (c) a safe reordering of hoisted function declarations, (d) added comments/section banners, (e) the new `DESIGN-SYSTEM.md`, or (f) the single `CACHE_NAME` bump. If a hunk is none of these, revert it.

---

## 14. Phasing

Work in verifiable phases; commit each separately so a regression is easy to bisect.

- **Phase 0 — Baseline.** Capture the §13.1 export matrix and §13.2 computed-style snapshots on the current commit. Record the QA checklist as the "known-good" reference.
- **Phase 1 — Token layer (`styles.css`).** Define tokens in `:root`; substitute values; extract composite shadow/transition tokens. Re-run §13.1 + §13.2 → must be identical. This is the highest-risk phase; verify hard before moving on.
- **Phase 2 — CSS component consistency + `DESIGN-SYSTEM.md`.** Normalize non-visual class contracts; write the reference doc. Re-verify.
- **Phase 3 — `app.js` reorganization.** TOC, banners, declaration grouping only. Re-run the QA checklist and confirm no console changes.
- **Phase 4 — Final gate.** Full §13 pass (both widths), §13.4 diff review, then bump `CACHE_NAME` to `cue-v22` as the last commit.

---

## 15. Risks & open questions

- **Noise non-determinism** (`Math.random` in `paintNoise`) breaks naive pixel-diffing. Mitigated by excluding `pattern:"noise"` from pixel-equality and verifying it by code-path + visual check (§13.1). Flagged here so it isn't mistaken for a regression.
- **Cascade sensitivity from duplicate selectors.** The intentional re-definitions of `.preview-area` and `.panel` mean a mistargeted token could change a computed value silently. The §13.2 computed-style diff is the safety net; run it at both widths.
- **Top-level JS ordering.** The reorg must not move executable/init statements. Constrained in §11; the QA checklist + console check guard it.
- **Alpha-tint token scheme is a judgment call.** Pick one consistent, exact-value naming scheme and document it (§10.3). Do not convert 8-digit hex to rounded `rgba()`.
- **Assumption — tokens live in `:root` within `styles.css`,** not a separate file, to avoid touching `index.html` and the service-worker cache list. If the maintainer later wants a standalone `tokens.css`, that's a follow-up requiring an HTML `<link>` and an `APP_SHELL` update.
- **Assumption — `index.html` stays essentially untouched** (no inline-style migration, no markup changes beyond optional harmless comments), consistent with "static HTML / preserve everything."
- **Brand colors that can't be tokenized.** `#1a1a1a`/`#ffffff` also appear in `index.html` (meta `theme-color`, the data-URI favicon) and `manifest.json`, where CSS custom properties can't reach. Leave them; document them in `DESIGN-SYSTEM.md` as the canonical brand values so the CSS tokens and these stay conceptually aligned.
- **Rename proposals (optional).** If you find identifiers whose names genuinely mislead, list them here as suggestions for the maintainer rather than changing them.
