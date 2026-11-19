// Hybrid AI layer — Firebase AI Logic (Gemini Nano on-device + Gemini cloud).
//
// Verified against the official Firebase docs (Nov 2026):
//   - getAI(app, { backend: new GoogleAIBackend() })
//   - getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE,
//       inCloudParams: { model, generationConfig },
//       onDeviceParams: { createOptions: { expectedInputs, expectedOutputs, initialPrompts } } })
//   - result.response.inferenceSource is "ON_DEVICE" or "IN_CLOUD" per the
//     docs, but the shipped SDK returns it lowercase ("on_device" /
//     "in_cloud") — generate() normalizes it to uppercase (18 Nov 2026).
//   - model.initializeDeviceModel(progressCb) downloads the on-device model.
//
// LIVE-TEST FINDINGS (18 Nov 2026, GitHub Pages, Chrome without Nano):
//   - ALL Firebase AI Logic calls go through the Firebase AI Logic proxy
//     endpoint firebasevertexai.googleapis.com/v1beta/projects/.../models/...,
//     even with GoogleAIBackend() — that URL is by design, not a bug.
//   - The HYBRID cloud leg failed there: HTTP 500 "This model is currently
//     experiencing high demand" (Summarize, Ask) on the deprecated
//     gemini-3.5-flash, and HTTP 401 "missing required authentication
//     credential" (Season plan). So the cloud leg now uses a PLAIN cloud
//     model (no InferenceMode, no onDeviceParams) — the standard documented
//     cloud path — with the current stable model gemini-3.8-flash.
//   - The hybrid model is kept ONLY for the on-device leg (real Chrome with
//     Gemini Nano), where it answers locally. See createModel().
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";
import { MODELS } from "./config.js";

// Pure prompt builders + helpers live in prompts.js (no Firebase imports,
// unit-tested) and are re-exported here so ui.js keeps importing from ai.js.
export {
  SYSTEM_PROMPT,
  summarizePrompt,
  tasksPrompt,
  askPrompt,
  planPrompt,
  parseTasks,
  demoAnswer,
  isOverloadedError,
} from "./prompts.js";

const Mode = InferenceMode || null;

function modeFor(target, preference) {
  if (!Mode) return undefined; // SDK default is on-device-first with cloud fallback.
  // Only ON_DEVICE ever reaches here: IN_CLOUD returns a plain cloud
  // model before modeFor is called. ALWAYS only-on-device: the hybrid
  // model's own cloud fallback is the broken path (500/401 on 18 Nov
  // 2026). On-device failure must throw fast so ui.js can retry with the
  // plain cloud model instead of waiting on the SDK's internal fallback.
  return Mode.ONLY_ON_DEVICE;
}

/** Create the Firebase AI Logic client (Gemini Developer API backend). */
export function createAI(firebaseApp) {
  return getAI(firebaseApp, { backend: new GoogleAIBackend() });
}

/** Plain cloud model — the standard Firebase AI Logic cloud path.
 * No InferenceMode, no onDeviceParams. Used for every IN_CLOUD request:
 * the hybrid cloud leg failed live (see header), the plain model does
 * not go through the hybrid code path. */
export function createCloudModel(ai, cloudModel) {
  return getGenerativeModel(ai, {
    model: cloudModel || MODELS.cloudDefault,
    generationConfig: { maxOutputTokens: 1024 },
  });
}

/**
 * Build a GenerativeModel for one request.
 * @param {object} opts
 * @param {"ON_DEVICE"|"IN_CLOUD"} opts.target  from routeRequest()
 * @param {"auto"|"device"|"cloud"} opts.preference  user mode selector
 * @param {string} opts.cloudModel  cloud model name (Remote Config or default)
 * @param {string} opts.systemPrompt  system prompt for the on-device model
 */
export function createModel(ai, { target, preference, cloudModel, systemPrompt }) {
  // Cloud leg: plain cloud model (see createCloudModel). Never a hybrid
  // model — the hybrid cloud leg failed live on 18 Nov 2026.
  if (target === "IN_CLOUD") return createCloudModel(ai, cloudModel);
  // On-device leg: hybrid model. mode is ONLY_ON_DEVICE (see modeFor):
  // on-device failure must throw immediately so ui.js can retry with the
  // plain cloud model — the hybrid model's own cloud fallback is the
  // broken path (500/401 on 18 Nov 2026). inCloudParams stays set so the
  // hybrid model definition is complete, with the current cloud model.
  const options = {
    inCloudParams: {
      model: cloudModel || MODELS.cloudDefault,
      generationConfig: { maxOutputTokens: 1024 },
    },
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: "text", languages: ["en"] }],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
        initialPrompts: [
          {
            role: "system",
            content: [
              {
                type: "text",
                value:
                  systemPrompt ||
                  "You are Harvest Notes, a concise farming assistant for smallholder farmers. Plain English, short sentences, no made-up prices or dates.",
              },
            ],
          },
        ],
      },
    },
  };
  const mode = modeFor(target, preference);
  if (mode) options.mode = mode;
  return getGenerativeModel(ai, options);
}

/** Send one prompt; returns the text plus which backend actually answered. */
export async function generate(model, prompt) {
  const started = performance.now();
  const result = await model.generateContent(prompt);
  const response = result.response;
  return {
    text: response.text(),
    // The SDK returns inferenceSource lowercase ("in_cloud" / "on_device")
    // in this version — normalize to uppercase so the UI badge mapping
    // ("Gemini Flash · cloud" / "Gemini Nano · on-device") matches.
    source: String(response.inferenceSource || "UNKNOWN").toUpperCase(),
    ms: Math.round(performance.now() - started),
  };
}

/** Download the on-device model (Chrome) with a progress callback (0-100). */
export async function ensureDeviceModel(model, onProgress) {
  if (model && typeof model.initializeDeviceModel === "function") {
    try {
      await model.initializeDeviceModel((p) => {
        if (onProgress) onProgress(Math.round(p * 100));
      });
      return true;
    } catch (e) {
      console.warn("On-device model download failed:", e);
      return false;
    }
  }
  return false;
}


// --- prompt builders + helpers (SYSTEM_PROMPT, summarizePrompt,
// tasksPrompt, askPrompt, planPrompt, parseTasks, demoAnswer) live in
// src/prompts.js and are re-exported at the top of this file. ---
