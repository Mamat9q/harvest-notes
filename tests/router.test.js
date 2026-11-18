// Unit tests for the hybrid router (src/router.js). Pure logic — no Firebase.
import test from "node:test";
import assert from "node:assert/strict";
import { routeRequest, TARGETS, UNAVAILABLE } from "../src/router.js";

const LIMITS = { askContextChars: 6000, promptCapChars: 8000 };

test("auto: offline + Nano -> ON_DEVICE", () => {
  const r = routeRequest({ kind: "summarize", online: false, nanoAvailable: true, limits: LIMITS });
  assert.equal(r.target, TARGETS.ON_DEVICE);
});

test("auto: offline + no Nano -> UNAVAILABLE", () => {
  const r = routeRequest({ kind: "summarize", online: false, nanoAvailable: false, limits: LIMITS });
  assert.equal(r.target, UNAVAILABLE);
});

test("auto: online + no Nano -> IN_CLOUD", () => {
  const r = routeRequest({ kind: "summarize", online: true, nanoAvailable: false, limits: LIMITS });
  assert.equal(r.target, TARGETS.IN_CLOUD);
});

test("auto: season plan always goes to cloud", () => {
  const r = routeRequest({ kind: "plan", online: true, nanoAvailable: true, limits: LIMITS });
  assert.equal(r.target, TARGETS.IN_CLOUD);
});

test("auto: ask over many notes goes to cloud", () => {
  const r = routeRequest({ kind: "ask", noteChars: 7000, online: true, nanoAvailable: true, limits: LIMITS });
  assert.equal(r.target, TARGETS.IN_CLOUD);
});

test("auto: ask over few notes stays on-device", () => {
  const r = routeRequest({ kind: "ask", noteChars: 100, online: true, nanoAvailable: true, limits: LIMITS });
  assert.equal(r.target, TARGETS.ON_DEVICE);
});

test("auto: short summarize/tasks stay on-device", () => {
  for (const kind of ["summarize", "tasks"]) {
    const r = routeRequest({ kind, online: true, nanoAvailable: true, limits: LIMITS });
    assert.equal(r.target, TARGETS.ON_DEVICE);
  }
});

test("auto: over-long prompt goes to cloud", () => {
  const r = routeRequest({ kind: "summarize", promptChars: 9000, online: true, nanoAvailable: true, limits: LIMITS });
  assert.equal(r.target, TARGETS.IN_CLOUD);
});

test("preference device + Nano -> ON_DEVICE", () => {
  const r = routeRequest({ kind: "ask", online: true, nanoAvailable: true, preference: "device", limits: LIMITS });
  assert.equal(r.target, TARGETS.ON_DEVICE);
});

test("preference device + no Nano + online -> IN_CLOUD fallback", () => {
  const r = routeRequest({ kind: "ask", online: true, nanoAvailable: false, preference: "device", limits: LIMITS });
  assert.equal(r.target, TARGETS.IN_CLOUD);
  assert.equal(r.fallback, true);
});

test("preference device + offline + no Nano -> UNAVAILABLE", () => {
  const r = routeRequest({ kind: "ask", online: false, nanoAvailable: false, preference: "device", limits: LIMITS });
  assert.equal(r.target, UNAVAILABLE);
});

test("preference cloud + offline -> UNAVAILABLE", () => {
  const r = routeRequest({ kind: "ask", online: false, nanoAvailable: true, preference: "cloud", limits: LIMITS });
  assert.equal(r.target, UNAVAILABLE);
});

test("preference cloud + online -> IN_CLOUD", () => {
  const r = routeRequest({ kind: "ask", online: true, nanoAvailable: true, preference: "cloud", limits: LIMITS });
  assert.equal(r.target, TARGETS.IN_CLOUD);
});
