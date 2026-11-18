# Harvest Notes — status (18 Nov 2026, ~16:15 WIB)

**Verdict: VIABLE — building started.** #BuildHybridAI 2026, Google + Firebase,
$30,000 pool. Deadline Mon Nov 30, 2026, 2:00 PM PT (= Tue Dec 1, 05:00 WIB).
~12 days left. Indonesia eligible (not in the exclusion list). Free entry.
Prize claim needs IRS Form W-8BEN (non-US) — KTP available.

## What is built (this dir, `~/workspace/buildhybridai/`)

**Harvest Notes** — offline-first AI field journal for smallholder farmers.
Web (Chrome) target → competes for Best Web/Chrome App ($3,000) + Grand ($10,000).

- Zero-build static app; Firebase JS SDK 13.4.0 via CDN import map.
- `src/ai.js` — Firebase AI Logic: hybrid model ONLY for the on-device leg
  (`ONLY_ON_DEVICE`, fast-fail so ui.js can retry); PLAIN cloud model
  (`getGenerativeModel(ai, { model })`, no InferenceMode) for every
  IN_CLOUD request, model gemini-3.8-flash + gemini-3.5-flash-lite fallback
  on overload errors. See "AI layer fix" below.
- `src/ui.js` — honest Nano detection (`LanguageModel.availability()`,
  pill shows ready / not-downloaded / none), visible "Working…" state +
  button lock during AI calls, attempt chain: routed target → cloud
  retry → fallback cloud model on overload (401/403/404 end the chain).
- `src/firebase.js` — Remote Config `cloud_model` override guard: a stale
  value naming a deprecated/shut-down model is replaced by the default.
- `src/router.js` — pure routing policy, **13/13 unit tests pass** (`npm test`).
- `src/firebase.js` — Auth anonymous, Firestore offline persistence,
  App Check (debug token on localhost), Remote Config (cloud_model, max_note_chars).
- `src/notes.js` — Firestore CRUD (ownerUid-scoped, no composite index needed)
  with localStorage demo fallback.
- `src/ui.js` + `index.html` + `src/styles.css` — full UI: notes, summarize,
  extract tasks, ask-my-notes, season plan, mode selector, model download,
  status pills, per-answer source badge + reason.
- PWA: `manifest.webmanifest`, `sw.js` (offline app shell), `icon.svg`.
- `README.md`, `SETUP.md` (exact Firebase console steps), `LICENSE` (Apache-2.0).
- Verified: `npm test` 13/13 pass, `npm run check` clean, all 12 files serve
  HTTP 200, all 22 element IDs present. No headless-Chrome render test on the
  VM (no Chromium binary here) — needs the parent's browser.

## What remains (parent agent — needs the live browser)

1. **Firebase console** (SETUP.md step 1, Boss's Google `matlailpajri1@gmail.com`):
   create project, enable AI Logic (Gemini Developer API), Anonymous Auth,
   Firestore + rules, Remote Config params, App Check (optional), copy the
   web config into `src/config.js`.
2. **Test in Chrome**: add note → Summarize → badge must read Gemini Nano
   (on-device) or Gemini Flash (cloud); test offline mode.
3. **GitHub repo** `Mamat9q/harvest-notes` (create via browser — connector
   create fails 403), push, enable GitHub Pages, verify live URL.
4. **Demo video** < 3 min, public YouTube, English (screen-record the hosted app).
5. **Devpost submission** (account `matlailpajri1`) before Nov 30, 2:00 PM PT.
   Platform: Web (Chrome). Title/description drafts are in SETUP.md step 5.
6. Optional: Sprint 3 Google Account Quota — request by Wed Nov 25, 10:00 AM PT
   (only if image generation or other billing-required models are added; the
   current text-only app does NOT need it).

## AI layer fix (18 Nov 2026, ~16:40 WIB)

Live Chrome test on https://mamat9q.github.io/harvest-notes/ (16:25–16:32 WIB):
page + notes fine, but ALL THREE AI features failed — Summarize/Ask HTTP 500
"This model is currently experiencing high demand", Season plan HTTP 401
"Request is missing required authentication credential", model download
"not supported on this device" (expected in that test browser).

ROOT CAUSE (verified from Firebase docs + Gemini model pages, 18 Nov 2026):
1. `firebasevertexai.googleapis.com/v1beta/projects/.../models/...:generateContent`
   is the Firebase AI Logic proxy endpoint for BOTH backends — the URL is by
   design, not a backend mix-up. The hybrid cloud leg is what failed there.
2. The cloud model was `gemini-3.5-flash` — deprecated in the Gemini
   Developer API on 8 Oct 2026 (requests auto-route to gemini-3.6-flash).
   `gemini-2.5-flash` (deprecated, access-limited for new projects) and
   `gemini-2.0-flash` (shut down 1 Jun 2026) are also unusable. Current
   stable free models: `gemini-3.8-flash` (newest, recommended) and
   `gemini-3.5-flash-lite`.
3. The Nano pill lied: `LanguageModel in window` only proves the Prompt API
   object exists, not that a model is on the device — so short tasks were
   routed on-device and stalled ~30s before failing.

FIX (push 067c6e03): cloud leg = plain cloud model, gemini-3.8-flash, fallback
gemini-3.5-flash-lite on overload (429/500/503); hybrid model kept only for
the on-device leg with ONLY_ON_DEVICE (fast fail → ui.js cloud retry);
Remote Config deprecated-model guard; Nano pill from
`LanguageModel.availability()` (ready / downloadable / none); visible
"Working…" state + button lock during AI calls.

LIVE VERIFICATION (curl, 18 Nov 2026 16:52 WIB, by parent — the SDK's exact
request shape, read from firebase-ai.js 13.4.0): anonymous Auth token via
Identity Toolkit + `Authorization: Firebase <token>` + `x-goog-api-key` +
`X-Firebase-Appid` against the firebasevertexai proxy:
- gemini-3.8-flash → HTTP 500 "This model is currently experiencing high
  demand" (capacity, not auth — the newest model is overloaded right now).
- gemini-3.5-flash-lite → ANSWERED ("Hello, it's nice to meet you!").
- Direct generativelanguage.googleapis.com calls → HTTP 403 for both
  models: the Firebase web key is restricted to Firebase APIs, expected —
  the proxy is the only path the SDK uses. A first probe with
  `Authorization: Bearer <token>` also 401'd — the proxy wants the
  `Firebase` scheme, not `Bearer`; that was a probe error, not an app bug.
MODEL SWAP (this push): cloudDefault is now gemini-3.5-flash-lite (the
model verified answering live), cloudFallback gemini-3.8-flash. Remote
Config console value still says gemini-3.5-flash — update it to
gemini-3.5-flash-lite (code guard overrides it meanwhile). RE-TEST: live
RE-TEST (browser, 18 Nov 17:21-17:24 WIB) — PASSED END-TO-END on the new build
(SW v2 live after 1 reload; pill now "No on-device model — cloud will be
used"). Summarize in_cloud 1315 ms (real summary), Ask in_cloud 1204 ms
(honest but thin — restates the note, no concrete advice), Season plan
in_cloud 3315 ms (full 4-week plan), Extract tasks in_cloud 974 ms
(2 tasks). No errors, no billing. SMALL BUG FOUND: the test note appeared
TWICE after saving — most likely a fast double-click on Save (submit
button was not disabled during the async save). Fix (this push): disable
the Save button while saving + SW cache v3.

- Devpost: https://firebasehybridaihackathon.devpost.com/
- Rules (eligibility, W-8BEN, dates): https://firebasehybridaihackathon.devpost.com/rules
- Hybrid docs: https://firebase.google.com/docs/ai-logic/hybrid
- Web hybrid config: https://firebase.google.com/docs/ai-logic/hybrid/web/configuration-options
- Get started: https://firebase.google.com/docs/ai-logic/get-started
