# SETUP.md — Firebase project + hosting + Devpost (for the parent agent)

Harvest Notes is a static web app. Everything below is free (Firebase Spark
plan, GitHub Pages). No paid service is needed at any step.

## 1. Firebase project (browser, ~5 minutes)

1. Go to https://console.firebase.google.com/ and sign in with Boss's Google
   account (`matlailpajri1@gmail.com` — the account authorized for Google access).
2. **Add project** → name it `harvest-notes` → disable Google Analytics (not
   needed) → Create.
3. In the project, click **Build → AI Logic** (or search "AI Logic") →
   **Get started** → choose **Gemini Developer API** as the backend →
   finish the wizard (it enables the Firebase AI Logic API + Gemini API).
4. **Build → Authentication → Get started → Sign-in method → Anonymous →
   Enable → Save.**
5. **Build → Firestore Database → Create database → Start in production
   mode → pick a location (e.g. `asia-southeast1`) → Enable.**
   Then **Rules** tab, replace with:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /notes/{noteId} {
         allow create: if request.auth != null
           && request.auth.uid == request.resource.data.ownerUid;
         allow read, update, delete: if request.auth != null
           && request.auth.uid == resource.data.ownerUid;
       }
     }
   }
   ```
   Click **Publish**.
6. **Build → Remote Config → Add parameter:**
   - `cloud_model` = `gemini-3.8-flash` (string — current stable Flash;
     do NOT use `gemini-3.5-flash`, deprecated in the Developer API Oct 2026)
   - `max_note_chars` = `20000` (number)
   Click **Publish changes**.
7. **App Check (optional but recommended):**
   - **Build → App Check → Apps → Register** the web app (below) with
     **reCAPTCHA Enterprise** → copy the **site key** into `recaptchaSiteKey`
     in `src/config.js`.
   - For local testing, App Check accepts debug tokens: open the app on
     `localhost` (or with `?appcheck-debug`) and the app sets
     `FIREBASE_APPCHECK_DEBUG_TOKEN`; register the printed debug token in
     App Check → Apps → overflow menu → **Manage debug tokens**.
   - If you skip App Check, leave `recaptchaSiteKey` empty — the app works
     while App Check enforcement is off.
8. **Project settings (gear) → Your apps → Web app (`</>`)** → nickname
   `harvest-notes-web` → **Register app** → copy the `firebaseConfig`
   object into `src/config.js` (replace the `YOUR_*` placeholders).

## 2. Test locally

```bash
cd ~/workspace/buildhybridai
python3 -m http.server 4173
# Open http://localhost:4173 in Chrome
```

Check: add a note → Summarize → the badge should read
**Gemini Nano · on-device** (Chrome downloads Nano on first use — click
"Download on-device model" and wait) or **Gemini Flash · cloud** if Nano is
unavailable. Toggle the mode selector and go offline (DevTools → Network →
Offline) to see the offline path. Notes must persist after reload (Firestore
offline cache).

## 3. GitHub repo + hosting

1. Create repo `Mamat9q/harvest-notes` (public) via the browser (connector
   `create_repository` fails 403 — create in the browser, then add it to the
   Muse GitHub App installation like the other entry repos).
2. Push this directory (Apache-2.0 LICENSE included; `.gitignore` keeps junk out).
3. **Settings → Pages → Deploy from branch → `main` / `/ (root)`** → the
   live URL is `https://mamat9q.github.io/harvest-notes/`. Verify it loads
   and the app works (real Firebase config is already in the pushed code —
   the web `apiKey` is a public identifier, not a secret).

## 4. Demo video (< 3 min, YouTube public, English)

Screen-record the hosted app in Chrome: add a note, Summarize (show the
on-device badge), Extract tasks, Ask my notes, Season plan (cloud badge),
then go offline and Summarize again (still works). Narrate in English or
add English subtitles. Upload public to YouTube (channel FILM DRAKOR, as
with HAUNT) and keep the URL for the Devpost form.

## 5. Devpost submission

Devpost account: `matlailpajri1` (already exists — used for Kiroween).
Contest: https://firebasehybridaihackathon.devpost.com/ →
**Enter a Submission** before **Mon Nov 30, 2026, 2:00 PM PT**
(= Tue Dec 1, 2026, 05:00 WIB).

- **Platform:** Web (Chrome) — competes for Best Web/Chrome App ($3,000)
  as well as Grand Prize ($10,000).
- **Title:** Harvest Notes — Offline-first AI field journal for smallholder farmers
- **Description must include:** how Firebase AI Logic hybrid inference is
  used (on-device Nano vs cloud Flash, routing rules, `inferenceSource`
  badge), feature summary, and the value proposition (works in the field
  with no connectivity; private; free).
- **Repo URL:** https://github.com/Mamat9q/harvest-notes
- **Demo video URL:** the YouTube link from step 4.
- **Try-it-out URL:** the GitHub Pages URL from step 3.
- **Built with:** Firebase AI Logic, Firestore, Authentication, App Check,
  Remote Config, Gemini Nano, Gemini Flash, JavaScript, PWA.

## 6. If we win (announced on or around Dec 21, 2026)

Devpost/Administrator will ask for tax documentation: **IRS Form W-8BEN**
(non-US resident). Boss's KTP is available now, so this can be completed
when asked. Prizes are paid net of any required withholding; winner pays
any transfer/currency fees. Do NOT claim or submit tax forms before the
announcement.
