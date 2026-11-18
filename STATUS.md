# Harvest Notes — status (18 Nov 2026, ~16:15 WIB)

**Verdict: VIABLE — building started.** #BuildHybridAI 2026, Google + Firebase,
$30,000 pool. Deadline Mon Nov 30, 2026, 2:00 PM PT (= Tue Dec 1, 05:00 WIB).
~12 days left. Indonesia eligible (not in the exclusion list). Free entry.
Prize claim needs IRS Form W-8BEN (non-US) — KTP available.

## What is built (this dir, `~/workspace/buildhybridai/`)

**Harvest Notes** — offline-first AI field journal for smallholder farmers.
Web (Chrome) target → competes for Best Web/Chrome App ($3,000) + Grand ($10,000).

- Zero-build static app; Firebase JS SDK 13.4.0 via CDN import map.
- `src/ai.js` — real Firebase AI Logic hybrid calls (verified API):
  `PREFER_ON_DEVICE` / `ONLY_ON_DEVICE` / `PREFER_IN_CLOUD` / `ONLY_IN_CLOUD`,
  `inCloudParams` (gemini-3.5-flash), `onDeviceParams` (Chrome Prompt API),
  `response.inferenceSource` badge, `initializeDeviceModel` download.
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

## Key sources (verified 18 Nov 2026)

- Devpost: https://firebasehybridaihackathon.devpost.com/
- Rules (eligibility, W-8BEN, dates): https://firebasehybridaihackathon.devpost.com/rules
- Hybrid docs: https://firebase.google.com/docs/ai-logic/hybrid
- Web hybrid config: https://firebase.google.com/docs/ai-logic/hybrid/web/configuration-options
- Get started: https://firebase.google.com/docs/ai-logic/get-started
