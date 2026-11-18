// Hybrid AI layer — Firebase AI Logic (Gemini Nano on-device + Gemini cloud).
//
// Verified against the official Firebase docs (Nov 2026):
//   - getAI(app, { backend: new GoogleAIBackend() })
//   - getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE,
//       inCloudParams: { model, generationConfig },
//       onDeviceParams: { createOptions: { expectedInputs, expectedOutputs, initialPrompts } } })
//   - result.response.inferenceSource is "ON_DEVICE" or "IN_CLOUD" (JS SDK >= 12.5.0)
//   - default cloud fallback model is gemini-3.5-flash-lite (JS SDK >= 13.0.0)
//   - model.initializeDeviceModel(progressCb) downloads the on-device model.
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";
import { MODELS } from "./config.js";

const Mode = InferenceMode || null;

function modeFor(target, preference) {
  if (!Mode) return undefined; // SDK default is on-device-first with cloud fallback.
  if (target === "ON_DEVICE") {
    return preference === "device" ? Mode.ONLY_ON_DEVICE : Mode.PREFER_ON_DEVICE;
  }
  return preference === "cloud" ? Mode.ONLY_IN_CLOUD : Mode.PREFER_IN_CLOUD;
}

/** Create the Firebase AI Logic client (Gemini Developer API backend). */
export function createAI(firebaseApp) {
  return getAI(firebaseApp, { backend: new GoogleAIBackend() });
}

/**
 * Build a hybrid GenerativeModel for one request.
 * @param {object} opts
 * @param {"ON_DEVICE"|"IN_CLOUD"} opts.target  from routeRequest()
 * @param {"auto"|"device"|"cloud"} opts.preference  user mode selector
 * @param {string} opts.cloudModel  cloud model name (Remote Config or default)
 * @param {string} opts.systemPrompt  system prompt for the on-device model
 */
export function createModel(ai, { target, preference, cloudModel, systemPrompt }) {
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
    source: response.inferenceSource || "UNKNOWN",
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
