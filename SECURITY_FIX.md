# Firebase API Key Exposure - Immediate Action Required

Your Firebase API key was committed to the public repository. Follow these steps immediately:

## 1. Rotate the API Key (5 minutes)

### Step 1: Delete the Exposed Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: **dkwebsite-12f83**
3. Go to **APIs & Services** → **Credentials**
4. Find the API key: `AIzaSyB5srCg2IxMzJPFChGfGbQ8b7QRlx_pOHQ`
5. Click the **Delete** button (trash icon)
6. Confirm deletion

### Step 2: Create a New Restricted Key
1. Still in **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **API key**
3. A new key will be created
4. **Immediately** click **RESTRICT KEY**

### Step 3: Add Application Restrictions
1. Under **Application restrictions**, select **HTTP referrers (web sites)**
2. Click **+ ADD AN ITEM**
3. Add these referrers:
   ```
   https://dilanjandk7.github.io/*
   http://localhost/*
   http://127.0.0.1/*
   ```
4. This ensures only your website can use this key

### Step 4: Add API Restrictions
1. Under **API restrictions**, select **Restrict key**
2. Select only these APIs:
   - **Identity Toolkit API** (Firebase Authentication)
   - **Cloud Firestore API**
3. Uncheck all other APIs

### Step 5: Save
1. Click **SAVE**
2. Copy the new API key

## 2. Update Your Local Config

1. Copy `assets/js/firebase-config.example.js` to `assets/js/firebase-config.js`
2. Paste your **NEW** restricted API key
3. Uncomment the script tag in `schedule.html`:
   ```html
   <script src="assets/js/firebase-config.js"></script>
   ```
4. **Test locally** - the scheduler should work
5. **DO NOT commit** `firebase-config.js` (it's now in `.gitignore`)

## 3. Commit the Security Fix

```bash
git add .gitignore
git add assets/js/firebase-config.js
git add assets/js/firebase-config.example.js
git add schedule.html
git add README.md
git commit -m "fix: remove exposed Firebase API key and add .gitignore"
git push
```

## 4. Verify Protection

1. Check that `assets/js/firebase-config.js` shows as ignored:
   ```bash
   git status
   ```
   It should NOT appear in changes

2. Your repo now has:
   - ✅ `.gitignore` preventing future commits
   - ✅ Only an example config in git
   - ✅ Your real config only on your local machine

## Why This Matters

Even though Firebase API keys are "safe" to expose for client-side apps, restricting them prevents:
- Unauthorized quota usage
- Spam signups
- Database abuse
- Unexpected Firebase bills

With HTTP referrer restrictions, only requests from your domain work.

## Need Help?

- Firebase docs: https://firebase.google.com/docs/projects/api-keys
- If you see errors after restriction, double-check your referrer patterns match your domain exactly.

