# Security deployment checklist

## Required Firebase deployment

The scheduler now records each participant under their Firebase anonymous-auth user ID. Deploy the repository rules before publishing the scheduler changes:

```bash
npx firebase-tools deploy --only firestore:rules
```

Alternatively, paste the contents of `firestore.rules` into Firebase Console → Firestore Database → Rules and publish them. Confirm that Anonymous authentication is enabled in Firebase Authentication.

## Firebase web configuration

The Firebase web configuration is intentionally public: it identifies a browser application and is not a server secret. In Google Cloud Console, restrict its API key to `https://www.dilanjandk.com/*` and `https://dilanjandk.com/*`, and allow only the Firebase services the site uses.

For GitHub Pages deployments, create a repository Actions secret named `FIREBASE_WEB_CONFIG`. Its value must be the complete JavaScript assignment from the local `site/public/assets/js/firebase-config.js` file, beginning with `window.FIREBASE_CONFIG =`. The deployment workflow writes this file immediately before building; it is never committed to the repository.

## Cloudflare response headers

GitHub Pages cannot set arbitrary response headers. In Cloudflare, create a response-header rule for `www.dilanjandk.com/*` that sets:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), geolocation=(), microphone=()`
- `X-Frame-Options: DENY`

The application also includes a browser-level Content Security Policy. Configure the same policy as a Cloudflare response header for stronger enforcement.
