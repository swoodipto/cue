You are a senior frontend engineer and product designer.

Your task is to build a minimal, elegant web app called "Cue".

----------------------------------------
PRODUCT IDEA
----------------------------------------

Cue is a simple, no-login web app that helps users present content beautifully for social sharing.

Core idea:
Users can upload any image (e.g. screenshot) OR paste an app/store link, and Cue transforms it into a clean, on-brand visual presentation that can be exported as an image.

This is NOT a design tool. It is a fast presentation layer.

----------------------------------------
CORE FEATURES
----------------------------------------

1. INPUT METHODS

A. Image Upload
- Drag & drop, clipboard paste OR file picker
- Accept common formats (png, jpg, webp)
- Preview instantly

B. Link Input
- User pastes a link
- Gets the image from the link
- displays in the preview to customize instantly

(If extraction fails, fall back gracefully)

----------------------------------------

2. PRESENTATION GENERATION

- Place content inside a clean composition:
  - Centered card
  - Soft shadow
  - Rounded corners
  - Generous padding
- Background:
  - Default: clean white
  - Optional subtle gradients
- Maintain aspect ratio
- Smart scaling

----------------------------------------

3. CUSTOMIZATION (LIGHTWEIGHT)

Keep this minimal. No complex editor.

Allow:
- Background color (presets and features: white / gradient / subtle noise, and random color generator which settings to change the color: one color if its solid, two if its gradient)
- Padding scale (tight / medium / wide)
- Corner radius (small / medium / large)
- Shadow intensity (off / soft / strong)

No sliders unless necessary — prefer discrete options.

----------------------------------------

4. EXPORT

- Export as PNG
- High resolution (2x or 3x)
- One-click download
- No watermark

----------------------------------------

5. SESSION PERSISTENCE

- No login system
- Use localStorage or IndexedDB
- Persist:
  - Uploaded image
  - Current layout settings
- Restore state on refresh

----------------------------------------

UX PRINCIPLES
----------------------------------------

- Extremely fast
- No clutter
- No onboarding
- No friction

The user flow should feel like:
Upload → instantly looks good → tweak → export

----------------------------------------

UI STYLE
----------------------------------------

- Minimal, clean, mostly white
- Inspired by:
  - ChatGPT UI
  - ultramock.io
- Use lots of whitespace
- Subtle borders (#e5e5e5 range)
- Soft shadows
- Clean typography (system fonts only)

Layout:
- Right: controls
- Center: live preview (dominant)
- Responsive for smaller screens (on smaller screens the preview is fixed at the top, the controls stacked below the preview in z-index and also positioned at the bottom and is scrollable)

----------------------------------------

TECH STACK
----------------------------------------

- Pure HTML, CSS, JavaScript (no frameworks)
- No build tools required
- Everything runs in browser
- Use canvas for export rendering

----------------------------------------

TECH REQUIREMENTS
----------------------------------------

- Use HTML5 Canvas to render final export
- Handle high DPI export scaling
- Optimize image loading
- Avoid blocking UI
- Use modular JS structure (not one giant file)

----------------------------------------

EDGE CASES
----------------------------------------

- Large images → scale properly
- Invalid links → show graceful error
- Missing metadata → fallback UI
- Empty state → visually pleasing

----------------------------------------

DELIVERABLES
----------------------------------------

1. index.html
2. styles.css
3. app.js

Code should be clean, readable, and well structured.

----------------------------------------

EXTRA (OPTIONAL IF TIME)
----------------------------------------

- Add subtle entrance animation
- Add “copy to clipboard” for export
- Add drag repositioning inside frame

----------------------------------------

IMPORTANT
----------------------------------------

Do NOT over-engineer.
Do NOT add unnecessary features.
Focus on polish, speed, and clarity.

This should feel like a tool people open, use in 10 seconds, and leave.

----------------------------------------

Start by:
1. Designing the layout structure
2. Then implement upload + preview
3. Then styling system
4. Then export functionality
