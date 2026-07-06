# Cue — Design System Reference

This document describes the design-token layer and CSS component contracts in
`styles.css`, as systematized in the 2026-07 refactor. It is a *descriptive*
reference: every token resolves to the exact value the product shipped with —
nothing was redesigned. If you change a token value, you are changing the
product's appearance globally; that is the point of the system, but do it on
purpose.

Scope note: `index.html` markup and all values in `app.js` (canvas colors,
demo settings, audio volumes, canvas presets) are **application data, not
design tokens** — they are deliberately not tokenized.

---

## 1. Overview — the design language

Cue's UI is a warm, tactile "letterpress" surface system: an off-white app
background (`#eeece6`) over a warm gray panel, with controls carved into the
surface using paired inset shadows — a light white ring from above and a soft
black tint below — rather than flat borders. Text and icons get subtle
embossed treatments (white top-shadow, dark under-shadow). The single loud
element is the orange accent family (`#ff613d` slider fills, `#f0e2da`/`#b02f00`
active chips with a warm glow, `#f55a1c` toasts). Reset/destructive affordances
use a soft red family. Typography is system fonts only, small sizes (9–13px)
with a mono stack for numeric readouts. Motion is short (0.12–0.25s) with one
shared overshoot curve for entrance/paste animations.

---

## 2. Token reference

All tokens live in the single `:root` block at the top of `styles.css`
(deliberately not a separate `tokens.css`, so `index.html` and the service
worker's `APP_SHELL` stay untouched).

### 2.1 Font stacks (pre-existing)

| Token | Value | Role |
|---|---|---|
| `--font` | `-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, "Arial", sans-serif` | UI text |
| `--font-mono` | `ui-monospace, "SF Mono", "Cascadia Code", "Fira Code", Menlo, monospace` | numeric readouts, hints, version badge |

### 2.2 Core & semantic color (pre-existing set, kept verbatim)

| Token | Value | Role |
|---|---|---|
| `--color-bg` | `#eeece6` | app background (preview area) |
| `--color-panel` | `hsl(50, 9%, 81%)` | body/panel background |
| `--color-header` | `#ffffff` | header background (header markup currently commented out) |
| `--color-border` | `#e5e5e5` | standard input borders |
| `--color-border-focus` | `#b0b0b0` | focused input borders |
| `--color-text` | `#1a1a1a` | primary text |
| `--color-text-muted` | `#7d7d7d` | secondary text, chip labels, button labels |
| `--color-text-faint` | `rgb(132, 130, 124)` | section labels, hints, logo |
| `--color-chip-bg` | `#f0f0f0` | **defined, currently unused** (predates orange chip styling) |
| `--color-chip-hover` | `#e8e8e8` | **defined, currently unused** |
| `--color-chip-active-bg` | `#1a1a1a` | **defined, currently unused** |
| `--color-chip-active-text` | `#ffffff` | **defined, currently unused** |

### 2.3 Brand & accent

| Token | Value | Role |
|---|---|---|
| `--color-black` | `#1a1a1a` | brand black (browse-button surface). Same value as `--color-text` — distinct on purpose (role > value) |
| `--color-white` | `#ffffff` | brand white (button/toast text, slider thumbs, hairline highlights inside shadow stacks) |
| `--color-accent` | `#ff613d` | slider track fill |
| `--color-accent-text` | `#b02f00` | active-chip text |
| `--color-accent-soft` | `#f0e2da` | active-chip surface |
| `--color-toast-bg` | `#f55a1c` | toast surface |
| `--color-danger-bg` | `#ffcfcf` | reset-button hover/active surface |
| `--color-danger-text` | `#8a0000` | reset-button hover/active text + icon stroke |

The brand black/white also appear where CSS custom properties cannot reach:
the `theme-color` meta, the data-URI favicon, the inline SVG icon strokes
(`#ffffff`, `#222222`) in `index.html`, and `manifest.json`. Treat the CSS
tokens as the canonical values and keep those in sync manually.

### 2.4 Alpha tints — the tint scale

Naming scheme (see also §3):

- `--tint-black-XX` / `--tint-white-XX` — tints written as **8-digit hex**;
  `XX` is the exact hex alpha byte. Example: `--tint-black-15` = `#00000015`.
- `--tint-black-aNN` — tints written as **rgba()**; `NN` are the decimal
  alpha digits. Example: `--tint-black-a06` = `rgba(0, 0, 0, 0.06)`.

| Token | Value | Typical use |
|---|---|---|
| `--tint-black-0b` | `#0000000b` | kbd-chip surface (via `--color-surface-kbd`) |
| `--tint-black-0d` | `#0000000d` | upload-pill surface (via `--color-surface-pill`) |
| `--tint-black-10` | `#00000010` | section divider inset |
| `--tint-black-12` | `#00000012` | hairline rings/borders, numeric readout surface |
| `--tint-black-15` | `#00000015` | card drop shadow |
| `--tint-black-17` | `#00000017` | button far shadow |
| `--tint-black-1c` | `#0000001c` | preview-frame ring + shadows |
| `--tint-black-21` | `#00000021` | button pressed shadow |
| `--tint-black-24` | `#00000024` | chip pressed ring |
| `--tint-black-2b` | `#0000002b` | button hover mid shadow |
| `--tint-black-2e` | `#0000002e` | button ring + near shadow |
| `--tint-black-30` | `#00000030` | button hover far shadow |
| `--tint-black-4d` | `#0000004d` | slider-track / pill inner shadow |
| `--tint-black-70` | `#00000070` | numeric-readout inner shadow |
| `--tint-black-a06` | `rgba(0, 0, 0, 0.06)` | frame ring/far shadow |
| `--tint-black-a08` | `rgba(0, 0, 0, 0.08)` | frame mid shadow, drag-over far shadow |
| `--tint-black-a12` | `rgba(0, 0, 0, 0.12)` | drag-over shadows |
| `--tint-white-73` | `#ffffff73` | preview-frame inner glow |
| `--tint-white-79` | `#ffffff79` | preview edge glow |
| `--tint-white-7f` | `#ffffff7f` | version-badge ring |
| `--tint-white-80` | `#ffffff80` | toast ring |
| `--tint-white-87` | `#ffffff87` | numeric-readout bottom highlight |
| `--tint-white-8a` | `#ffffff8a` | toast inner glow |
| `--tint-white-8b` | `#ffffff8b` | active-chip border (via `--color-border-chip-active`) |
| `--tint-white-8f` | `#ffffff8f` | card inset ring (the signature surface ring) |
| `--tint-white-91` | `#ffffff91` | pill / reset-hover inset ring |
| `--tint-white-9e` | `#ffffff9e` | button inset ring |
| `--tint-white-ad` | `#ffffffad` | button pressed inset ring |
| `--tint-white-b7` | `#ffffffb7` | header-section divider border (via `--color-border-divider`) |
| `--tint-white-d1` | `#ffffffd1` | slider-track bottom highlight |
| `--tint-white-ee` | `#ffffffee` | emboss top-shadows, icon drop-shadows |
| `--tint-white-f0` | `#fffffff0` | reset pressed highlight |
| `--tint-white-f3` | `#fffffff3` | logo emboss highlight |

### 2.5 Surfaces

| Token | Value | Role |
|---|---|---|
| `--color-surface-card` | `rgba(255, 255, 255, 0.15)` | control-set card / mobile panel-section card |
| `--color-surface-chip` | `rgba(0,0,0,0.03)` | chip resting surface |
| `--color-surface-chip-hover` | `rgba(255,255,255,0.08)` | chip hover surface |
| `--color-surface-input` | `#ffffff` | text inputs, font select |
| `--color-surface-soft` | `#f7f7f7` | secondary button |
| `--color-surface-soft-hover` | `#efefef` | secondary button hover |
| `--color-surface-btn` | `#e0deda` | primary export/copy button |
| `--color-surface-btn-deep` | `#e1ddd7` | button lower inner glow (inside `--shadow-btn`) |
| `--color-surface-btn-glow` | `#ece7e0` | button hover/pressed inner glow |
| `--color-surface-pill` | `var(--tint-black-0d)` | upload pill |
| `--color-surface-pill-dragover` | `rgba(255, 255, 255, 0.92)` | upload pill during drag |
| `--color-surface-kbd` | `var(--tint-black-0b)` | keyboard-shortcut chip |
| `--color-surface-input-inset` | `var(--tint-black-12)` | numeric readout field |
| `--color-badge-bg` | `rgba(255, 255, 255, 0.12)` | version badge |

### 2.6 Borders

| Token | Value | Role |
|---|---|---|
| `--color-border-hairline` | `var(--tint-black-12)` | mobile control-set separators |
| `--color-border-divider` | `var(--tint-white-b7)` | header-section bottom divider |
| `--color-border-chip-hover` | `#c9c9c9` | chip hover border |
| `--color-border-chip-active` | `var(--tint-white-8b)` | active chip border |
| `--color-border-dragover` | `rgba(26, 26, 26, 0.16)` | upload pill border during drag |

### 2.7 Texture

| Token | Value | Role |
|---|---|---|
| `--noise-texture` | SVG `feTurbulence` data-URI | fractal-noise grain over preview area and body |
| `--noise-texture-size` | `90px` | tile size of the grain |

(The `.45` opacity on both noise overlays is left inline.)

### 2.8 Spacing scale

`--space-N: Npx` for N ∈ {2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28,
32, 36, 40}. Used for paddings, margins, gaps, and `scroll-padding`.
Position offsets (`top/right/bottom/left`) and negative margins are left
inline — see §8.

### 2.9 Radii

| Token | Value | Typical use |
|---|---|---|
| `--radius-2` | `2px` | slider track |
| `--radius-4` | `4px` | badges, kbd chips, readouts, slider thumbs, swatch wells |
| `--radius-6` | `6px` | chips, canvas frame |
| `--radius-7` | `7px` | color swatch |
| `--radius-8` | `8px` | buttons, toast, preview area |
| `--radius-10` | `10px` | cards, inputs |
| `--radius-14` | `14px` | mobile upload pill |
| `--radius-16` | `16px` | desktop upload pill |
| `--radius-chip` | `99px` | pill radius — **defined, currently unused** |
| `--radius-fader` | `14px / 2px` | **special**: elliptical corners for the mobile vertical fader track (x-radius 14px, y-radius 2px; combined with the 12px transparent side borders this leaves 2px×2px track corners, matching desktop) |

### 2.10 Typography

| Category | Tokens |
|---|---|
| Sizes | `--font-size-9/-10/-11/-12/-12-5/-13/-20/-32` (px values; `-12-5` = 12.5px) |
| Weights | `--font-weight-regular` 400 · `--font-weight-medium` 500 · `--font-weight-semibold` 600 |
| Line heights | `--leading-none` `1` · `--leading-none-em` `1em` (kept distinct from `1` — different inheritance semantics) · `--leading-snug` `1.2` · `--leading-relaxed` `1.4` |
| Letter spacing | `--tracking-n04` −0.04em · `--tracking-n02` −0.02em · `--tracking-n01` −0.01em · `--tracking-p01` 0.01em · `--tracking-p05` 0.05em · `--tracking-p06` 0.06em · `--tracking-p08` 0.08em (`n` = negative, `p` = positive) |

### 2.11 Transitions & easing

| Token | Value | Where |
|---|---|---|
| `--duration-120` | `0.12s` | chip state changes |
| `--duration-150` | `0.15s` | swatch border |
| `--duration-160` | `0.16s` | primary button |
| `--duration-180` | `0.18s` | toast fade |
| `--duration-200` | `0.2s` | reset-button shadow |
| `--duration-250` | `0.25s` | entrance/paste animations, ratio-fade |
| `--ease-default` | `ease` | general |
| `--ease-in-out` | `ease-in-out` | reset button |
| `--ease-spring` | `cubic-bezier(0,.69,.1,1.64)` | shared overshoot for `scaleDown` / `scaleDownFadeIn` |

(The `0.08s` animation delay on the pill entrance is a one-off, left inline.)

### 2.12 Z-index layers

| Token | Value | Role |
|---|---|---|
| `--z-base` | `0` | noise overlays |
| `--z-raised` | `1` | frame wrap, pill (desktop), panel wrapper |
| `--z-floating` | `2` | docked pill (mobile) |
| `--z-toast` | `20` | toast container |
| `--z-header` | `200` | fixed header (markup currently commented out) |

### 2.13 Dimensions

| Token | Value | Role |
|---|---|---|
| `--header-h` | `52px` | header height (pre-existing) |
| `--panel-w` | `320px` | desktop panel width (pre-existing) |
| `--panel-h-mobile` | `262px` | mobile control-rail height |
| `--swatch-size` | `30px` | color swatch |
| `--btn-primary-h` | `50px` | export/copy button height |
| `--icon-size` | `14px` | default svg icon box |
| `--icon-size-lg` | `16px` | export/copy icons |
| `--slider-thumb-size` | `16px` | slider thumb |
| `--slider-track-thickness` | `4px` | desktop slider track height |

### 2.14 Composite shadows

Each token reproduces its source stack **exactly**; layers reference tint
tokens where one exists, and single-use colored alphas (danger reds, warm
browns, accent glows, `#333333`-family embosses) stay inline inside the
token definition as documented one-offs.

| Token | Used by |
|---|---|
| `--shadow-card` | `.control-set`, mobile `.panel-section` cards — the signature "white inset ring + soft drop" |
| `--shadow-btn` / `--shadow-btn-hover` / `--shadow-btn-active` | primary button base/hover/pressed stacks |
| `--shadow-frame` / `--shadow-frame-dragover` | canvas frame resting / drag-over |
| `--shadow-preview-edge` | first `.preview-area` definition (edge glow) |
| `--shadow-preview-frame` | second `.preview-area` definition (inset ring + drops) |
| `--shadow-panel-edge` | first `.panel` definition (overridden to `none` by the second — preserved) |
| `--shadow-section-divider` | `#section-header` bottom divider inset |
| `--shadow-pill` / `--shadow-pill-dragover` | upload pill |
| `--shadow-kbd` | keyboard-shortcut chip ring |
| `--shadow-chip-pressed` / `--shadow-chip-active` | chip `:active` / `.active` |
| `--shadow-badge` | version badge |
| `--shadow-input-inset` | numeric readout |
| `--shadow-slider-track` / `--shadow-slider-track-v` | horizontal / vertical slider track insets |
| `--shadow-slider-thumb` | slider thumb |
| `--shadow-reset-hover` / `--shadow-reset-active` | reset button danger states |
| `--shadow-toast` | toast ring + glow + drop |
| `--text-shadow-emboss-logo` / `--text-shadow-emboss-label` / `--text-shadow-emboss-btn` | letterpress text (three distinct dark-alpha variants: `#333333f5` / `d2` / `ea`) |
| `--text-shadow-chip-active` | active chip's orange glow + white outline (contains `#fff` short-hex, kept verbatim) |
| `--drop-shadow-icon` / `--drop-shadow-icon-up` | icon `filter:` embosses |

**Deliberate non-token:** the slider track-fill gradients. They read
`var(--pct, 50%)`, which `app.js` sets **inline per slider element**. A
`:root`-level token would substitute `--pct` at `:root` computation time,
bake in the 50% fallback, and freeze every track fill — so the two gradients
(horizontal desktop, vertical mobile) stay inline on `.slider`, referencing
`--color-accent` for the filled side.

---

## 3. The alpha-tint scheme

Most of the depth in this UI comes from black/white at low alphas layered in
`box-shadow` stacks. These are written as **8-digit hex** in the source
(`#00000015`, `#ffffff8f`, …) and the tokens keep that exact notation:

- The hex alpha byte does not round-trip through percentage-based `rgba()`.
  `0x15` is 8.235%, not 8% — converting to `rgba(0,0,0,.08)` would change
  the rendered value. Byte-for-byte output parity was a hard requirement of
  the refactor, so the tokens preserve the source notation exactly.
- The name carries the byte: `--tint-black-15` ↔ `#00000015`. To read one,
  the suffix is the alpha in hex (0x15/255 ≈ 8.2%).
- Tints that were *originally authored* as `rgba()` keep that notation under
  the `-aNN` suffix (`--tint-black-a06` = `rgba(0, 0, 0, 0.06)`), again to
  avoid any conversion.

When adding a new tint, follow the notation of its neighbors and add a row to
the table in §2.4.

---

## 4. Component reference

The markup for all components is static, hand-written HTML in `index.html`.
JS toggles state classes only — it never generates DOM for these patterns.

### 4.1 Chip

Rectangular segmented-picker button. `.reset-btn` shares its base rule.

```html
<div class="chip-row" id="somePicker">
    <button class="chip active" data-foo="a">A</button>
    <button class="chip" data-foo="b">B</button>
</div>
```

- **Contract:** `.chip-row` is a grid (`auto-fit, minmax(78px, 1fr)`,
  `--space-6` gap); each `.chip` carries one `data-*` attribute that
  `initControls`/`syncChipPicker` in `app.js` uses to sync `.active`.
- **States:** `:hover` (`--color-surface-chip-hover` + `--color-border-chip-hover`),
  `:active` (`--shadow-chip-pressed`), `.active` (the orange treatment:
  `--color-accent-soft` / `--color-accent-text` / `--shadow-chip-active` /
  `--text-shadow-chip-active`), `:disabled` (0.5 opacity).
- **Tokens:** `--color-surface-chip`, `--radius-6`, `--font-size-11`,
  `--font-weight-semibold`, `--tracking-n02`, `--duration-120`, accent set.
- **Variants:** `#bgGradientDirectionPicker` overrides to a 4-column grid
  (part of the latent gradient feature). Mobile reflows rows to 2-column /
  single-column stacks (§6).

### 4.2 Control set / control row

The card surface and its label/value rows.

```html
<div class="control-set">
    <div class="control-row">
        <span class="control-label">Padding</span>
        <span class="val-group">…</span>
    </div>
    <input type="range" class="slider" … />
</div>
```

- **Contract:** `.control-set` = card (`--color-surface-card`,
  `--shadow-card`, `--radius-10`, `--space-18` gap). `.control-row` = flex
  row, label left, value right. `.control-row--stacked` = column variant for
  a label above a picker/slider (its children stretch to 100% width).
- **Tokens:** `--color-surface-card`, `--shadow-card`, `--radius-10`,
  spacing scale, `--font-size-11`/`--font-weight-semibold` for labels.
- **Mobile:** cards flatten to transparent rows inside the section card,
  separated by `--color-border-hairline` hairlines (§6).

### 4.3 Slider

`<input type="range" class="slider">`, wired by `connectSlider()` in app.js.

- **Contract:** JS sets the inline custom property `--pct` (via
  `refreshSlider`) so the track gradient fills up to the thumb. The gradient
  is deliberately inline in CSS, not a token (§2.14 note).
- **Desktop:** 4px horizontal track (`--slider-track-thickness`,
  `--radius-2`, `--shadow-slider-track`), 16px square-ish thumb
  (`--slider-thumb-size`, `--radius-4`, `--shadow-slider-thumb`).
- **Mobile:** becomes a vertical fader via `writing-mode: vertical-rl` +
  `direction: rtl`; the 28px-wide element uses 12px transparent side borders
  so the padding-box *is* the 4px track; `--radius-fader` (`14px / 2px`)
  keeps 2px track corners. `ns-resize` cursor replaces `ew-resize`.
- **States:** `:disabled` (0.35 opacity, `not-allowed` cursor).

### 4.4 Numeric readout

```html
<span class="val-group">
    <input type="number" class="control-val" … />
    <span class="control-unit">px</span>
</span>
```

- **Contract:** `.val-group` is `row-reverse` (unit before input in markup,
  after it visually; `.control-unit` is currently `display: none`).
  `.control-val` is a borderless number input styled as an inset well
  (`--color-surface-input-inset`, `--shadow-input-inset`, `--radius-4`,
  mono font, 36px wide). Native spinners are suppressed.
- **Variant:** `.control-val--hex` + `.val-group--color` for hex text fields
  next to swatches — 70px wide, centered, uppercase.
- **States:** `:disabled` (0.45 opacity). Enter-to-blur behavior comes from
  app.js. Hidden on mobile (readouts are desktop-only).

### 4.5 Color swatch

`<input type="color" class="color-swatch">` — 30px (`--swatch-size`) well,
`--radius-7` outer / `--radius-4` inner, `--color-border` border that darkens
to `--color-border-focus` on hover, `--duration-150` transition.

### 4.6 Buttons

- **Primary (export/copy):** `.btn-wrapper` (the hover/active *trigger* —
  state selectors live on the wrapper: `.btn-wrapper:hover > button`) wraps
  a `button.export-btn` or `button.copy-btn`. Surface `--color-surface-btn`,
  height `--btn-primary-h`, the three `--shadow-btn*` stacks,
  `--text-shadow-emboss-btn`, icon `--drop-shadow-icon`. The export button
  flexes; the copy button's wrapper is fixed at 60px (desktop). On mobile
  both are 170px and the copy button gains a "Copy" label via `::after`.
- **Secondary:** `.secondary-btn` — flat `--color-surface-soft` surface,
  `--color-border` border, `--radius-10`.
- **Canvas browse:** `.canvas-browse-btn` — the one dark button
  (`--color-black` on `--color-white` text), lives inside the pill in a
  `style`-attribute-neutralized `.btn-wrapper`.
- **Reset:** `.reset-btn` — shares the chip base rule; hover/active swap to
  the danger family (`--color-danger-bg`, `--color-danger-text`,
  `--shadow-reset-hover/-active`).

### 4.7 Canvas actions pill

`.canvas-actions` — the floating upload affordance under the canvas:
`--color-surface-pill` capsule (`--radius-16` desktop / `--radius-14`
mobile), `--shadow-pill` inset modeling. `.cortshuts` renders keyboard
shortcuts as small kbd chips (`--color-surface-kbd`, `--shadow-kbd`).
`.canvas-actions-label` (desktop copy) and `.canvas-actions-label--handy`
(short mobile copy) swap visibility across the breakpoint. During drag-over
the pill lightens (`--color-surface-pill-dragover`, `--color-border-dragover`,
`--shadow-pill-dragover`). On mobile it docks to the preview bottom
(`--z-floating`). Entrance animation: `scaleDownFadeIn` with `--ease-spring`.

### 4.8 Toast

`.toast` inside the absolutely-positioned `.toast-container` (`--z-toast`).
Orange surface (`--color-toast-bg`), `--shadow-toast`, `--radius-8`,
`--color-white` text, opacity transition `--duration-180`. JS toggles
`.show`; the message auto-hides after 2.6s. Above 769px it's a nowrap pill
capped at 500px; at ≤768px it top-aligns and scales 1.15×.

### 4.9 Panel section & section label

`.panel-section` — one vertical block per control group in the desktop rail;
`#section-header` (`.rowing` = horizontal variant) gets the
`--color-border-divider` + `--shadow-section-divider` underline.
`.section-label` — uppercase micro-heading in `--color-text-faint` with
`--text-shadow-emboss-label`. On mobile every section becomes a snap card
(§6).

### 4.10 Logo

`.logo` (emboss via `--text-shadow-emboss-logo`), `.logo-mark` (32px glyph),
`.logo-text` (20px wordmark), `.logo-version` (mono badge on
`--color-badge-bg` with `--shadow-badge`). Rotated vertical on mobile.

---

## 5. Naming conventions & state classes

- **Blocks and modifiers:** `block` / `block--modifier`, e.g.
  `control-row--stacked`, `control-val--hex`, `val-group--color`,
  `canvas-actions-label--handy`. Child elements use hyphenated block prefixes
  (`logo-mark`, `panel-section`, `section-label`).
- **JS state classes** (toggled by app.js; never restyle their meaning):
  `.active` (selected chip), `.hidden` (`display: none !important` utility),
  `.drag-over` (on `.preview-area` during drag), `.is-scrolled` (on
  `#ratioPicker`, drives the top edge fade), `.show` (toast visible),
  `.enter-animate` (frame/pill entrance), `.paste-animate` (paste bounce),
  `.rowing` (horizontal panel-section — set in markup, not JS).
- **JS style hooks:** inline `--pct` on `.slider` elements; inline
  `font-family` on the font `<select>`.
- **IDs** are camelCase and are JS API surface (`els` map in app.js) — never
  rename from CSS-side refactors.
- **data-attributes** carry picker values (`data-ratio`, `data-bg-type`,
  `data-pattern`, `data-blend`, `data-overlay-*`, `data-sound`,
  `data-gradient-direction`); `syncChipPicker` derives the dataset key from
  them.

---

## 6. Responsive model

One structural breakpoint: **`@media (max-width: 680px)`** (~line 1377 of
`styles.css`), plus minor toast-only tweaks at 768/769px.

Desktop: `.layout` is a horizontal flex — dominant `.preview-area` +
fixed-width right `.panel` (`--panel-w`) holding a vertical stack of
`.panel-section`s.

Below 680px the same DOM reflows into a **horizontal snap-card rail**:

- `.layout` goes column; `.preview-area` fills the space above a
  `--panel-h-mobile` (262px) tall `.panel` that scrolls horizontally with
  `scroll-snap-type: x proximity`.
- Each `.panel-section` becomes a full-height snap card reusing the
  `--color-surface-card` + `--shadow-card` surface; `.section-label` and
  `.control-label` rotate vertical (`writing-mode: vertical-rl` +
  `rotate(180deg)`).
- `.control-set`s flatten to transparent rows separated by
  `--color-border-hairline`; numeric readouts and hex fields hide.
- Sliders become vertical faders (§4.3). The ratio picker becomes a
  single-column stack that scrolls vertically behind mask-image edge fades;
  the registered `@property --ratio-fade-top` animates the top fade when
  app.js toggles `.is-scrolled`.
- The upload pill docks to the bottom of the preview (`position: absolute`,
  `--z-floating`); the browse button grows; the long label swaps for
  `--handy`.
- The export card becomes a small grid with stacked 170px buttons and a
  labeled copy button (`.copy-btn::after { content: "Copy" }`).

---

## 7. Preserved quirks & known tech debt

Everything below is **intentionally preserved as of this refactor**
(2026-07). They look like mistakes; they are load-bearing or harmless, and
"fixing" them would change rendered output or behavior. Do not clean them up
blindly.

1. **`.frame` malformed transition** — `transition: box-shadow 0.15s
   easetransform 0.15s ease;`. The missing space/comma makes the value
   invalid; fixing it would *introduce* a new animation. Preserved verbatim
   (flagged with a comment in the CSS).
2. **Stray backtick in `.logo`** — a `` ` `` trails the `text-shadow`
   declaration. Preserved.
3. **`app.js` stale ref** — `blurControl: $("blurControl"), // old, remove?`
   resolves to `null` (real element is `#bgBlurControl`). Preserved.
4. **Commented-out code** — the old `<header>` and `#section-danger` in
   `index.html`; the alternate `.canvas-actions`, two `.chip.active`
   variants, three alternate slider experiments, `.export-btn`/`.copy-btn`
   block, and `.panel-section.bottom` in `styles.css`. All preserved.
5. **Duplicate selectors by design** — `.preview-area` (edge glow → framed
   inset) and `.panel` (edge shadow → `box-shadow: none` + right padding)
   are each defined twice and layer deliberately. Do not merge. (Noted with
   a comment at the second pair.)
6. **Defined-but-unused tokens** — `--color-chip-bg`, `--color-chip-hover`,
   `--color-chip-active-bg`, `--color-chip-active-text` (predate the orange
   chip styling) and `--radius-chip`. Kept.
7. **Latent gradient feature** — the Gradient chip is commented out in
   `index.html` (~line 354) but the full JS path, gradient controls markup,
   and `#bgGradientDirectionPicker` CSS remain functional. Seeding
   `bgType: "gradient"` via localStorage exercises it.
8. **`.section-label` double `font-weight`** — declares `600` then `500`
   in the same rule; the later `500` wins. Both lines preserved.
9. **Missing semicolon** — mobile `.panel .chip-row` ends `gap:
   var(--space-10)` with no trailing semicolon (valid CSS). Preserved.
10. **`#soundHelperText` is commented out in the HTML**, so
    `els.soundHelperText` is `null` and `updateSoundUI()` returns at its
    guard clause every call — the sound helper texts and the iOS manual
    unlock reveal are currently inert. Preserved (a behavior fix is out of
    scope; noted as an observation).
11. **Styled-but-unused classes** — `.export-note` and `.frame-hint` have
    rules but no live markup (`.frame-hint` markup is commented out);
    `.header`/`.header-tagline` rules serve the commented-out header, and
    `#imageLabel` reuses `header-tagline` (which is `display: none` on
    desktop). Preserved.
12. **`.cortshuts`** — almost certainly a typo for "shortcuts"; it is a
    class contract used in HTML + CSS. *Rename proposal only* — not
    performed, since the maintainer chose "preserve everything."
13. **Non-tokenizable brand values** — `#1a1a1a` / `#ffffff` / `#222222` in
    `index.html` (theme-color meta, favicon data-URI, inline SVG strokes)
    and `manifest.json`. CSS custom properties cannot reach them; keep in
    sync with §2.3 manually.

### Deliberate inline one-offs (not tokenized)

Geometry-specific values left as literals on purpose: the `7px` paddings
(reset button, hex readout), `gap: 1px` (val-group), the `11px` in the
desktop pill padding, readout widths (36/70px), wrapper widths (60/170px),
`min-width: 144px` (font select), mobile chip width (120px), the vertical
fader geometry (28px width, 12px side borders, 90px min-height), browse
button heights (36/42px) and its mobile 15px icon, toast `max-width: 500px`
and 1.15 scale, `88px` mobile preview bottom padding, `bottom: 16px` pill
offset, negative margins/translates, border widths (1/1.2/1.4/1.5/1.6px),
opacities (.35–.86 range and the .45 noise), the `0.08s` entrance delay,
keyframe scales, ratio-picker mask stops (`#000`, `28px`), grid `minmax`
bounds (74/78px), and `line-height: 0` on `.frame`. Single-use colored
alphas live inside their composite shadow tokens (§2.14).
