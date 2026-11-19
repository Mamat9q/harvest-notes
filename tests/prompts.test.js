// Unit tests for the pure prompt builders + helpers (src/prompts.js).
// No Firebase imports — runs in plain Node.
import test from "node:test";
import assert from "node:assert/strict";
import {
  SYSTEM_PROMPT,
  summarizePrompt,
  tasksPrompt,
  askPrompt,
  planPrompt,
  parseTasks,
  demoAnswer,
  isOverloadedError,
} from "../src/prompts.js";

test("askPrompt asks for concrete next steps tied to the notes", () => {
  const p = askPrompt("What about the yellowing leaves?", "Rice. Leaves yellowing after heavy rain.");
  assert.match(p, /concrete next steps/i);
  assert.match(p, /specific facts from the notes/i);
  assert.match(p, /Rice\. Leaves yellowing after heavy rain\./);
  assert.match(p, /What about the yellowing leaves\?/);
});

test("askPrompt keeps the honesty rule: unknown must be said plainly, general advice labeled", () => {
  const p = askPrompt("q", "notes");
  assert.match(p, /say plainly what is unknown/i);
  assert.match(p, /clearly marked as general advice/i);
  assert.match(p, /not from the notes/i);
  assert.match(p, /No made-up prices, dates, or product names/);
});

test("summarizePrompt keeps facts-only, no advice", () => {
  const p = summarizePrompt("Rain all week. Soil wet.");
  assert.match(p, /2-3 short sentences/);
  assert.match(p, /Keep facts only, no advice/);
  assert.match(p, /Rain all week/);
});

test("tasksPrompt demands JSON array only", () => {
  const p = tasksPrompt("Need to water the tomatoes.");
  assert.match(p, /JSON array of short strings/);
  assert.match(p, /Output only the JSON array/);
});

test("planPrompt is a 4-week plan grounded in the notes", () => {
  const p = planPrompt("Rice planted last week.");
  assert.match(p, /next 4 weeks/i);
  assert.match(p, /Using ONLY these field notes/);
});

test("SYSTEM_PROMPT forbids invented prices/dates", () => {
  assert.match(SYSTEM_PROMPT, /no made-up prices or dates/i);
});

test("parseTasks parses a JSON array and caps at 10", () => {
  const many = Array.from({ length: 12 }, (_, i) => `Task ${i + 1}`);
  const out = parseTasks(JSON.stringify(many));
  assert.equal(out.length, 10);
  assert.equal(out[0], "Task 1");
});

test("parseTasks falls back to line-splitting on plain text", () => {
  const out = parseTasks("- Water the rice\n- Check the pump");
  assert.deepEqual(out, ["Water the rice", "Check the pump"]);
});

test("parseTasks handles JSON embedded in prose", () => {
  const out = parseTasks('Here you go: ["Feed the chickens", "Fix the fence"] done.');
  assert.deepEqual(out, ["Feed the chickens", "Fix the fence"]);
});

test("isOverloadedError: 429/500/overload retry, 401/403/404 do not", () => {
  assert.equal(isOverloadedError(new Error("HTTP 500 high demand")), true);
  assert.equal(isOverloadedError(new Error("429 resource exhausted")), true);
  assert.equal(isOverloadedError(new Error("503 unavailable")), true);
  assert.equal(isOverloadedError(new Error("401 missing credential")), false);
  assert.equal(isOverloadedError(new Error("403 permission denied")), false);
  assert.equal(isOverloadedError(new Error("404 not found")), false);
});

test("demoAnswer is always labeled DEMO and never invents content", () => {
  const s = demoAnswer("summarize", "Rain all week. Soil is wet. Leaves look yellow.");
  assert.equal(s.source, "DEMO");
  assert.match(s.text, /Rain all week/);
  const t = demoAnswer("tasks", "Need to water the tomatoes. Must check the pump.");
  assert.equal(t.source, "DEMO");
  assert.doesNotThrow(() => JSON.parse(t.text));
});
