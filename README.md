# Harvest Notes — Offline-first AI field journal for smallholder farmers

Built for **#BuildHybridAI 2026** (Google + Firebase, Devpost).
$30,000 prize pool — Grand Prize $10,000, Best Web/Chrome App $3,000.

## The idea

Half a billion smallholder farmers grow a third of the world's food, often
with patchy or no connectivity in the field. **Harvest Notes** is a field
journal that works in the field: write down what you see and do, and let AI
turn notes into summaries, task lists, answers, and a 4-week season plan.

The hybrid part is the point — one SDK, two models:

| Work | Model | Why |
|---|---|---|
| Summarize a note, extract tasks, quick Q&A | **Gemini Nano, on-device** | Instant, private, free, works offline |
| Season plan, Q&A over many notes, long prompts | **Gemini Flash, cloud** | Bigger context, deeper reasoning |

Every answer shows a badge saying which model answered it
(`Gemini Nano · on-device` / `Gemini Flash · cloud`), with the reason the
router picked it. The user can force either side with the mode selector.

## How the hybrid routing works

`src/router.js` is a pure function (unit-tested, no Firebase imports):

- **Auto (default):** offline → on-device only; no Nano on the device →
  cloud; prompt over 8,000 chars → cloud; season plan → cloud; Q&A over
  6,000+ chars of notes → cloud; everything else short and private →
  on-device.
- **On-device only / Cloud only:** user override; the router falls back
  gracefully (cloud when Nano is missing, error when cloud is asked for
  offline) and says so.
- The app reads `response.inferenceSource` (`ON_DEVICE` / `IN_CLOUD`) from
  every Firebase AI Logic response, so the badge always shows what really
  answered — including when the SDK falls back at runtime. If an on-device
  call fails, the app retries once in the cloud and labels it.

## Firebase products used

- **AI Logic** — hybrid inference (`InferenceMode.PREFER_ON_DEVICE`,
  `inCloudParams` / `onDeviceParams`, `initializeDeviceModel` download
  progress). Gemini Developer API backend (free tier).
- **Firestore** — notes sync with offline persistence (`persistentLocalCache`).
- **Authentication** — anonymous sign-in (no account, no personal data).
- **App Check** — reCAPTCHA Enterprise in production; debug tokens accepted
  on localhost (per hackathon rules).
- **Remote Config** — cloud model name (`cloud_model`) and note limits,
  changeable without redeploying.

## Run it

Zero build step. Static files + Firebase JS SDK 13.4.0 from the Google CDN.

```bash
# 1. Put your Firebase web config in src/config.js (see SETUP.md)
# 2. Serve over HTTP (service worker + App Check need it)
python3 -m http.server 4173
# 3. Open http://localhost:4173 — Chrome for Gemini Nano on-device
```

Without a Firebase config the app runs in **demo mode**: notes in
`localStorage`, extractive demo answers, clearly labeled. Set up Firebase
(free Spark plan, ~5 minutes — `SETUP.md`) for real hybrid AI.

## Tests

```bash
npm test    # node:test, 13 router cases — no dependencies
npm run check  # syntax-check every source file
```

## Submission checklist (Devpost)

- [ ] Firebase project configured (`src/config.js`, `SETUP.md`)
- [ ] Public GitHub repo + Apache-2.0 LICENSE (this repo)
- [ ] Hosted demo URL (GitHub Pages)
- [ ] Demo video < 3 min, public on YouTube, English
- [ ] Devpost text description (features, Firebase AI Logic use, value prop)
- [ ] Submit before **Mon Nov 30, 2026, 2:00 PM PT** (Tue Dec 1, 05:00 WIB)

## License

Apache-2.0 — see `LICENSE`.
