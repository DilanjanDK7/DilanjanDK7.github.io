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
