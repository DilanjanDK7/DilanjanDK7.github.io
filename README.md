# DilanjanDK7.github.io

Personal portfolio for Dilanjan DK (ddiyabal@uwo.ca). Built as a static site and deployable via GitHub Pages.

## Structure

- `index.html`: Home page
- `projects/`: Project detail pages
  - `feature_extraction_container.html`
  - `fmri_processing_pipeline_epilepsy.html`
  - `qm_fft_feature_package.html`
- `assets/`
  - `css/style.css`: Global styles (light/dark, components)
  - `js/main.js`: Behavior (theme, modal, accessibility, interactions)
  - `icons/favicon.svg`: Site icon
  - `manifest.webmanifest`: Web manifest
  - `images/`: Place custom images here
  - `fonts/`: Place custom fonts here
- `404.html`: Not-found route for GitHub Pages
- `robots.txt`: Crawl directives
- `sitemap.xml`: Sitemap for search engines
- `.nojekyll`: Disable Jekyll processing

## Local development

Open `index.html` in your browser. No build step required.

### Scheduler (Schedule Page)

The page `schedule.html` provides a When2Meet-style scheduler with a calendar picker and optional real-time collaboration backed by Firebase Firestore.

Setup (optional, for sharing without JSON):

1. Firebase project
   - Create a Firebase project (console)
   - Add a Web App, copy config into `assets/js/firebase-config.js`
   - Enable Authentication → Anonymous
   - Enable Firestore (Production mode)

2. Security Rules (Firestore)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /events/{eventId} {
      allow read: if true; // anyone with link can view
      allow create: if request.auth != null; // host must be signed in anonymously
      allow update: if request.auth != null && request.resource.data.hostUid == resource.data.hostUid; // only host updates event meta
      allow delete: if false;

      match /participants/{uid} {
        allow read: if true;
        allow write: if request.auth != null && request.auth.uid == uid; // each user writes only their own availability
      }
    }
  }
}
```

3. CSP
   - `schedule.html` includes CSP allowing required Firebase endpoints.

Usage:
 - Open `schedule.html`, click Create event to generate a share link
 - Share the link; participants mark availability live (no JSON paste)
 - Host can adjust date range and slot settings; updates sync to everyone

## Deployment

Push to the default branch of this repository. In repository settings, enable GitHub Pages with the root (`/`) as the source.

## Accessibility & Security

- Skip link to main content
- Accessible modal with focus trapping and Escape to close
- Respects `prefers-reduced-motion`
- Strict CSP via meta; no inline scripts
- External links use `rel="noopener noreferrer"`

## Customization

- Replace diagrams.net iframe URL with a published link
- Connect the contact form to Formspree/Netlify for submissions
- Add images under `assets/images/` and reference them in pages

## Author

Dilanjan DK — ddiyabal@uwo.ca
