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
  cloudDefault: "gemini-3.5-flash",
  // Fallback if the configured cloud model is unavailable.
  cloudFallback: "gemini-3.5-flash-lite",
};

export const LIMITS = {
  maxNoteChars: 20000,
  // Notes longer than this go to the cloud for Q&A (on-device context is small).
  askContextChars: 6000,
  // Prompts longer than this always go to the cloud.
  promptCapChars: 8000,
};
