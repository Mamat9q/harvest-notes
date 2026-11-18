// Firebase initialization: Auth (anonymous), Firestore (offline-first),
// App Check (debug token on localhost), Remote Config (model + limits).
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, getFirestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getRemoteConfig, fetchAndActivate, getString, getNumber } from "firebase/remote-config";
import { firebaseConfig, recaptchaSiteKey, CONFIGURED, MODELS, LIMITS } from "./config.js";

/**
 * Initialize Firebase. Returns { configured: false } when config.js still
 * holds placeholders — the app then runs in local demo mode (see notes.js
 * and ai.js demoAnswer) so the UI can be exercised without a project.
 */
export async function initFirebase() {
  if (!CONFIGURED) return { configured: false };

  const app = initializeApp(firebaseConfig);

  if (recaptchaSiteKey) {
    try {
      const debug =
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1" ||
        new URLSearchParams(location.search).has("appcheck-debug");
      if (debug) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (e) {
      console.warn("App Check init failed (continuing without it):", e);
    }
  }

  const auth = getAuth(app);
  let user = auth.currentUser;
  if (!user) {
    const cred = await signInAnonymously(auth);
    user = cred.user;
  }

  let db;
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache({}) });
  } catch (e) {
    console.warn("Persistent Firestore cache unavailable, using default:", e);
    db = getFirestore(app);
  }

  const rc = getRemoteConfig(app);
  rc.defaultConfig = {
    cloud_model: MODELS.cloudDefault,
    max_note_chars: String(LIMITS.maxNoteChars),
  };
  rc.settings = { minimumFetchIntervalMillis: 3600000 };
  let cloudModel = MODELS.cloudDefault;
  let maxNoteChars = LIMITS.maxNoteChars;
  try {
    await fetchAndActivate(rc);
    cloudModel = getString(rc, "cloud_model") || cloudModel;
    maxNoteChars = getNumber(rc, "max_note_chars") || maxNoteChars;
  } catch (e) {
    console.warn("Remote Config fetch failed, using defaults:", e);
  }

  return { configured: true, app, auth, db, uid: user.uid, cloudModel, maxNoteChars };
}
