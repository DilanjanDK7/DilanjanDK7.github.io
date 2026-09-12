# Portfolio (Astro + Tailwind)

This folder contains the Astro + Tailwind build for the Dilanjan DK portfolio. The site is deployed to GitHub Pages via GitHub Actions.

## Setup

```bash
cd site
npm ci
```

## Development

```bash
npm run dev
```

Open http://localhost:4321

## Build

```bash
npm run build
```

## Validation

```bash
npm run check
```

Output is written to `../dist` (repo root). The GitHub Actions workflow runs this and deploys `dist/` to GitHub Pages.

## Firebase (Schedule page)

To enable the Schedule page with live collaboration:

1. Copy `public/assets/js/firebase-config.example.js` to `public/assets/js/firebase-config.js` (or create it with your Firebase config).
2. Do not commit real API keys; use environment variables or build-time replacement if needed.
3. Ensure Firebase Auth (Anonymous) and Firestore are enabled.

## Pages

- `/` — Home (hero, featured research, about, bento projects, contact)
- `/about` — About
- `/contact` — Contact form (Formspree)
- `/reading` — Reading list
- `/schedule` — When2Meet-style scheduler (Firebase)
- `/projects` — Projects grid
- `/projects/epiflow` — EpiFlow
- `/projects/feature_extraction_container` — Feature Extraction Container
- `/projects/qm_fft_feature_package` — QM FFT Feature Package
- `/projects/brainviz_dk` — BrainViz DK
- `/projects/fmri_processing_pipeline_epilepsy` — Redirects to EpiFlow
