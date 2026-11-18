// UI wiring for Harvest Notes. Pure DOM code — no Firebase imports here
// except through the deps passed in (store, ai, env).
import { routeRequest, TARGETS, UNAVAILABLE } from "./router.js";
import {
  createModel,
  generate,
  ensureDeviceModel,
  summarizePrompt,
  tasksPrompt,
  askPrompt,
  planPrompt,
  parseTasks,
  demoAnswer,
  SYSTEM_PROMPT,
} from "./ai.js";
import { LIMITS } from "./config.js";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CROPS = ["Rice", "Maize", "Cassava", "Vegetables", "Coffee", "Fruit", "Other"];

export function initUI({ env, store, ai, cloudModel, maxNoteChars }) {
  const $ = (id) => document.getElementById(id);
  const state = {
    notes: [],
    preference: "auto",
    nano: "LanguageModel" in window || ("ai" in window && !!window.ai?.languageModel),
    cloudModel: cloudModel || "gemini-3.5-flash",
    maxNoteChars: maxNoteChars || LIMITS.maxNoteChars,
  };

  // --- status bar ---
  const netPill = $("net-pill");
  const nanoPill = $("nano-pill");
  const backendPill = $("backend-pill");
  const setupBanner = $("setup-banner");

  function renderStatus() {
    netPill.textContent = navigator.onLine ? "● Online" : "○ Offline";
    netPill.className = "pill " + (navigator.onLine ? "pill-ok" : "pill-warn");
    nanoPill.textContent = state.nano
      ? "● Gemini Nano detected"
      : "○ No on-device model — cloud will be used";
    nanoPill.className = "pill " + (state.nano ? "pill-ok" : "pill-muted");
    backendPill.textContent = env.configured
      ? `● Firestore (${store.backend})`
      : "○ Demo mode — set up Firebase (SETUP.md)";
    backendPill.className = "pill " + (env.configured ? "pill-ok" : "pill-warn");
    setupBanner.hidden = !!env.configured;
  }
  window.addEventListener("online", renderStatus);
  window.addEventListener("offline", renderStatus);
  renderStatus();

  // --- notes list ---
  const listEl = $("notes-list");
  const emptyEl = $("notes-empty");

  function noteCard(note) {
    const date = new Date(note.createdAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return `<article class="note-card" data-id="${escapeHtml(note.id)}">
      <div class="note-head">
        <h3>${escapeHtml(note.title || "Untitled note")}</h3>
        <span class="chip">${escapeHtml(note.crop || "Other")}</span>
      </div>
      <p class="note-date">${escapeHtml(date)}</p>
      <p class="note-body">${escapeHtml(note.body)}</p>
      <div class="note-actions">
        <button data-act="summarize">Summarize</button>
        <button data-act="tasks">Extract tasks</button>
        <button data-act="delete" class="danger">Delete</button>
      </div>
    </article>`;
  }

  function renderNotes() {
    listEl.innerHTML = state.notes.map(noteCard).join("");
    emptyEl.hidden = state.notes.length > 0;
  }

  async function refreshNotes() {
    state.notes = await store.list();
    renderNotes();
  }

  // --- AI answer panel ---
  const panel = $("ai-panel");
  const sourceBadge = $("ai-source");
  const kindEl = $("ai-kind");
  const reasonEl = $("ai-reason");
  const textEl = $("ai-text");
  const metaEl = $("ai-meta");

  function showAnswer({ kind, text, source, reason, ms }) {
    panel.hidden = false;
    kindEl.textContent = kind;
    reasonEl.textContent = reason;
    textEl.textContent = text;
    metaEl.textContent = ms ? `answered in ${ms} ms` : "";
    sourceBadge.className = "badge";
    if (source === "ON_DEVICE") {
      sourceBadge.textContent = "Gemini Nano · on-device";
      sourceBadge.classList.add("badge-device");
    } else if (source === "IN_CLOUD") {
      sourceBadge.textContent = "Gemini Flash · cloud";
      sourceBadge.classList.add("badge-cloud");
    } else if (source === "DEMO") {
      sourceBadge.textContent = "DEMO answer (no Firebase)";
      sourceBadge.classList.add("badge-demo");
    } else {
      sourceBadge.textContent = source;
      sourceBadge.classList.add("badge-demo");
    }
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // --- the hybrid run: route, then call the model ---
  async function runAI(kind, prompt, noteChars) {
    const decision = routeRequest({
      kind,
      promptChars: prompt.length,
      noteChars,
      online: navigator.onLine,
      nanoAvailable: state.nano,
      preference: state.preference,
      limits: { askContextChars: LIMITS.askContextChars, promptCapChars: LIMITS.promptCapChars },
    });
    if (decision.target === UNAVAILABLE) {
      showAnswer({ kind, text: decision.reason, source: "NONE", reason: decision.reason, ms: 0 });
      return;
    }
    if (!env.configured || !ai) {
      const demo = demoAnswer(kind, prompt);
      showAnswer({
        kind,
        text: demo.text,
        source: "DEMO",
        reason: "Demo mode — set up Firebase (see SETUP.md) for real hybrid AI.",
        ms: 0,
      });
      return;
    }
    try {
      const model = createModel(ai, {
        target: decision.target,
        preference: state.preference,
        cloudModel: state.cloudModel,
        systemPrompt: SYSTEM_PROMPT,
      });
      const out = await generate(model, prompt);
      let text = out.text;
      if (kind === "tasks") text = parseTasks(text).map((t) => "• " + t).join("\n");
      showAnswer({ kind, text, source: out.source, reason: decision.reason, ms: out.ms });
    } catch (e) {
      // On-device failed at runtime: retry once in the cloud (unless forced).
      if (decision.target === TARGETS.ON_DEVICE && state.preference !== "device" && navigator.onLine) {
        try {
          const model = createModel(ai, {
            target: TARGETS.IN_CLOUD,
            preference: state.preference,
            cloudModel: state.cloudModel,
            systemPrompt: SYSTEM_PROMPT,
          });
          const out = await generate(model, prompt);
          let text = out.text;
          if (kind === "tasks") text = parseTasks(text).map((t) => "• " + t).join("\n");
          showAnswer({
            kind,
            text,
            source: out.source,
            reason: "On-device failed, retried in cloud.",
            ms: out.ms,
          });
          return;
        } catch (e2) {
          showAnswer({ kind, text: "AI call failed: " + e2.message, source: "NONE", reason: "Error", ms: 0 });
          return;
        }
      }
      showAnswer({ kind, text: "AI call failed: " + e.message, source: "NONE", reason: "Error", ms: 0 });
    }
  }

  // --- events ---
  $("mode-select").addEventListener("change", (e) => {
    state.preference = e.target.value;
  });

  $("download-model").addEventListener("click", async (e) => {
    const btn = e.target;
    const prog = $("model-progress");
    if (!env.configured || !ai) {
      prog.textContent = "Set up Firebase first (SETUP.md).";
      return;
    }
    btn.disabled = true;
    prog.textContent = "Downloading on-device model… 0%";
    const model = createModel(ai, {
      target: TARGETS.ON_DEVICE,
      preference: "device",
      cloudModel: state.cloudModel,
      systemPrompt: SYSTEM_PROMPT,
    });
    const ok = await ensureDeviceModel(model, (p) => {
      prog.textContent = `Downloading on-device model… ${p}%`;
    });
    prog.textContent = ok ? "On-device model ready." : "Download not supported on this device — cloud will be used.";
    state.nano = ok || state.nano;
    btn.disabled = false;
    renderStatus();
  });

  $("note-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("note-title").value.trim();
    const crop = $("note-crop").value;
    const body = $("note-body").value.trim();
    if (!body) return;
    await store.add({ title: title || "Untitled note", body: body.slice(0, state.maxNoteChars), crop });
    $("note-title").value = "";
    $("note-body").value = "";
    await refreshNotes();
  });

  listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const card = e.target.closest(".note-card");
    const note = state.notes.find((n) => n.id === card.dataset.id);
    if (!note) return;
    if (btn.dataset.act === "delete") {
      if (confirm("Delete this note?")) {
        await store.remove(note.id);
        await refreshNotes();
      }
      return;
    }
    const text = `Title: ${note.title}\nCrop: ${note.crop}\n${note.body}`;
    if (btn.dataset.act === "summarize") {
      await runAI("summarize", summarizePrompt(text), text.length);
    } else if (btn.dataset.act === "tasks") {
      await runAI("tasks", tasksPrompt(text), text.length);
    }
  });

  $("ask-btn").addEventListener("click", async () => {
    const q = $("ask-input").value.trim();
    if (!q) return;
    const all = state.notes.map((n) => `Title: ${n.title}\nCrop: ${n.crop}\n${n.body}`).join("\n---\n");
    const totalChars = all.length;
    const context = all.slice(0, 12000);
    await runAI("ask", askPrompt(q, context), totalChars);
  });

  $("plan-btn").addEventListener("click", async () => {
    if (state.notes.length === 0) {
      showAnswer({ kind: "plan", text: "Add some field notes first — the plan is built from your notes.", source: "NONE", reason: "No notes yet.", ms: 0 });
      return;
    }
    const all = state.notes.map((n) => `Title: ${n.title}\nCrop: ${n.crop}\n${n.body}`).join("\n---\n");
    await runAI("plan", planPrompt(all.slice(0, 12000)), all.length);
  });

  refreshNotes();
  return { state, refreshNotes };
}
