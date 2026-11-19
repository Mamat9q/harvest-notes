// Pure prompt builders + helpers for Harvest Notes.
//
// No Firebase imports here, so this file is unit-testable in plain Node.
// ai.js re-exports everything from this module; ui.js imports from ai.js
// as before, so nothing else changes.
//
// Prompt policy (why Ask used to answer thin):
//   - The old ask prompt said "using ONLY these field notes" and nothing
//     else, so the model just restated the note. The new ask prompt still
//     grounds every claim in the notes, but asks for concrete next steps
//     tied to specific facts in them — and when the notes do not cover
//     something, the model says what is unknown and may add general
//     farming practice, clearly marked as general advice, never presented
//     as if it came from the farmer's notes.

export const SYSTEM_PROMPT =
  "You are Harvest Notes, a concise farming assistant for smallholder farmers. Plain English, short sentences, no made-up prices or dates.";

export function summarizePrompt(note) {
  return `Summarize this field note in 2-3 short sentences. Keep facts only, no advice.\n\n${note}`;
}

export function tasksPrompt(note) {
  return `List the concrete jobs to do from this field note as a JSON array of short strings, for example ["Water the tomatoes", "Buy fertilizer"]. Output only the JSON array, nothing else.\n\n${note}`;
}

export function askPrompt(question, notesText) {
  return `Answer the question using the field notes below as your main source. Give concrete next steps the farmer can do this week, tied to specific facts from the notes (crop, symptom, timing). If the notes do not cover something, say plainly what is unknown, then you may add general farming practice for it — clearly marked as general advice, not from the notes. Keep it short, plain English, short sentences. No made-up prices, dates, or product names.\n\nNOTES:\n${notesText}\n\nQUESTION: ${question}`;
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
