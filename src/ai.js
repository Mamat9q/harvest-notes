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

/** True when the error looks like a transient server/overload failure
 * (HTTP 429/500/502/503/504, "high demand", "overloaded",
 * "unavailable", "resource exhausted", quota/rate-limit) — worth one
 * retry with the fallback cloud model. Auth (401/403) and not-found
 * (404) errors are NOT overload: retrying those with another model is
 * pointless, so they return false. */
export function isOverloadedError(e) {
  const msg = String((e && (e.message || e)) || "").toLowerCase();
  if (/401|403|404|unauthenticated|permission|not found/.test(msg)) return false;
  return /429|500|502|503|504|overload|high demand|unavailable|resource-exhausted|resource exhausted|rate limit|quota|capacity|try again/.test(
    msg
  );
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

// --- prompt builders (one per AI feature) ---

export const SYSTEM_PROMPT =
  "You are Harvest Notes, a concise farming assistant for smallholder farmers. Plain English, short sentences, no made-up prices or dates.";

export function summarizePrompt(note) {
  return `Summarize this field note in 2-3 short sentences. Keep facts only, no advice.\n\n${note}`;
}

export function tasksPrompt(note) {
  return `List the concrete jobs to do from this field note as a JSON array of short strings, for example ["Water the tomatoes", "Buy fertilizer"]. Output only the JSON array, nothing else.\n\n${note}`;
}

export function askPrompt(question, notesText) {
  return `Answer the question using ONLY these field notes. If the notes do not say, say so plainly.\n\nNOTES:\n${notesText}\n\nQUESTION: ${question}`;
}

export function planPrompt(notesText) {
  return `You are planning the next 4 weeks for a small farm. Using ONLY these field notes, write a short weekly plan: what to plant, water, feed, and watch for. Keep it practical and honest about what is unknown.\n\nNOTES:\n${notesText}`;
}

/** Parse the tasks JSON defensively; fall back to line-splitting. */
export function parseTasks(text) {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    const arr = JSON.parse(match ? match[0] : text);
    if (Array.isArray(arr)) return arr.map(String).filter(Boolean).slice(0, 10);
  } catch (e) {
    // fall through to line parsing
  }
  return text
    .split(/\n/)
    .map((s) => s.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 10);
}

/**
 * Local demo fallback, used ONLY when no Firebase config is set (see config.js).
 * Extractive only — no fake AI claims. The UI always labels it "DEMO".
 */
export function demoAnswer(kind, input) {
  const sentences = input
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  if (kind === "tasks") {
    const verbs = sentences.filter((s) => /need|must|should|water|plant|feed|buy|check|spray|harvest/i.test(s));
    return { text: JSON.stringify((verbs.length ? verbs : sentences).slice(0, 5)), source: "DEMO", ms: 0 };
  }
  return { text: sentences.slice(0, 3).join(" "), source: "DEMO", ms: 0 };
}
