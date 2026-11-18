// Harvest Notes — bootstrap.
import { initFirebase } from "./firebase.js";
import { createNoteStore } from "./notes.js";
import { createAI } from "./ai.js";
import { initUI } from "./ui.js";

const env = await initFirebase();
const store = createNoteStore(env);
const ai = env.configured ? createAI(env.app) : null;

initUI({
  env,
  store,
  ai,
  cloudModel: env.cloudModel,
  maxNoteChars: env.maxNoteChars,
});

// Offline app shell (PWA). Skipped on file:// and when the worker is missing.
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
