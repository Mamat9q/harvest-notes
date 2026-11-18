// Firebase web app configuration.
//
// HOW TO FILL THIS IN (free, ~5 minutes — full steps in SETUP.md):
//   1. Create a Firebase project (Spark plan = free) in the Firebase console.
//   2. Register a Web app and copy its config object here.
//   3. Enable: Authentication (Anonymous), Firestore, App Check, Remote Config,
//      AI Logic with the Gemini Developer API backend.
// A Firebase web apiKey is a public identifier, not a secret — but never put
// service-account keys, Admin SDK credentials, or any other secret in this repo.
export const firebaseConfig = {
  apiKey: "AIzaSyDiaza-6Ka1XHDl0taWFY8wOUZuXpvQFSE",
  authDomain: "harvest-notes-5f8d2.firebaseapp.com",
  projectId: "harvest-notes-5f8d2",
  storageBucket: "harvest-notes-5f8d2.firebasestorage.app",
  messagingSenderId: "216684894237",
  appId: "1:216684894237:web:0d6a49ff039aa4b14bcef4",
};

// Optional: reCAPTCHA Enterprise site key for App Check (Firebase console).
// Leave empty to skip App Check — the app works while App Check enforcement
// is off. Debug tokens are accepted by the hackathon; see SETUP.md.
export const recaptchaSiteKey = "";

export const CONFIGURED = firebaseConfig.apiKey !== "YOUR_API_KEY";

export const MODELS = {
  // Cloud model used when the router picks IN_CLOUD (overridable by Remote Config).
  // gemini-3.5-flash-lite: verified LIVE via the Firebase AI Logic proxy on
  // 18 Nov 2026 16:52 WIB (anonymous Auth token + API key + App ID, header
  // "Authorization: Firebase <token>") — answered while gemini-3.8-flash
  // returned HTTP 500 "high demand" on the same proxy at the same time.
  // gemini-3.5-flash was deprecated in the Gemini Developer API on
  // 8 Oct 2026 (requests auto-route to gemini-3.6-flash) and failed live
  // with HTTP 500 on 18 Nov 2026 — do not revert to it.
  cloudDefault: "gemini-3.5-flash-lite",
  // Fallback if the configured cloud model is unavailable.
  // gemini-3.8-flash is the newest stable Flash and Google's current
  // recommendation for new projects (Nov 2026); it 500'd on high demand
  // at the 18 Nov live check, so it is the fallback, not the default.
  cloudFallback: "gemini-3.8-flash",
};

// Model IDs that must never be used as the cloud model: shut down
// (gemini-2.0-*), deprecated and access-limited for new projects
// (gemini-2.5-*), or deprecated in the Developer API (gemini-3.5-flash).
// firebase.js overrides a Remote Config value that names one of these.
export const DEPRECATED_CLOUD_MODELS = new Set([
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-3-pro-preview",
]);

export const LIMITS = {
  maxNoteChars: 20000,
  // Notes longer than this go to the cloud for Q&A (on-device context is small).
  askContextChars: 6000,
  // Prompts longer than this always go to the cloud.
  promptCapChars: 8000,
};
