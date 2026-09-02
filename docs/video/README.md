# Video Preparation Package

Everything needed to record a technically honest 13–15 minute demo video for Biswa.
**Every implementation claim in these documents was verified against the codebase.**

---

## Read in this order

| Order | File | What it's for |
|---|---|---|
| 1️⃣ | [`01-what-i-built.md`](01-what-i-built.md) | **Read first.** Verified component map + the gaps list. Ground truth. |
| 2️⃣ | [`12-talking-points.md`](12-talking-points.md) | **Main recording document.** Section by section, what to establish and show. |
| 3️⃣ | [`11-biswa-questions.md`](11-biswa-questions.md) | Every interview question, answerable in 30–90s. |
| 4️⃣ | [`13-avoid.md`](13-avoid.md) | **Read immediately before recording.** Overclaims to avoid. |
| 5️⃣ | [`14-recording-plan.md`](14-recording-plan.md) | Timings, screen layout, which Excalidraw to show/skip. |
| 6️⃣ | [`10-demo-flow.md`](10-demo-flow.md) | The live call, beat by beat. |
| 7️⃣ | [`15-cheat-sheet.md`](15-cheat-sheet.md) | **One page beside the monitor while recording.** |
| 8️⃣ | [`16-evaluation.md`](16-evaluation.md) | The honest eval gap + exactly what to say about it. |

## Screen-share during recording

| File | Show during |
|---|---|
| [`presentation/index.html`](presentation/index.html) | 21-slide deck, arrow-key navigation — the spine of the video |
| [`02-master-architecture.html`](02-master-architecture.html) | Section 3 — architecture |
| [`03-voice-under-the-hood.html`](03-voice-under-the-hood.html) | Section 2 — the layer stack |
| [`04-speech-models.html`](04-speech-models.html) | Section 4 — cascaded vs S2S |
| [`05-orchestration.html`](05-orchestration.html) | Section 5 — ⭐ most important |
| [`06-context-engineering.html`](06-context-engineering.html) | Section 6 — context |
| [`07-data-pipeline.html`](07-data-pipeline.html) | Section 6 — data |
| [`08-latency.html`](08-latency.html) | Section 7 — latency |
| [`09-interruptions.html`](09-interruptions.html) | Section 8 — barge-in |

All HTML files are standalone — open with `open docs/video/<file>.html`, no server needed.

---

## The sentence to memorise

> LiveKit owns realtime media and the voice pipeline. My `CallOrchestrator` owns the business state machine.
> Agents are specialised reasoning policies. Tools are the only way the model mutates business state.
> Postgres is the durable source of truth, Redis carries ephemeral events, OpenRouter provides model routing,
> and the frontend is a thin observability layer.

---

## Three stories that carry the video

1. **The silent 400** — zod's generated JSON schema omitted `additionalProperties:false`, OpenAI strict mode
   rejected every extraction request, and the error was swallowed and returned as `{}`. Extraction was
   completely dead and *invisible*. → why observability matters.
2. **The agent interrupting itself** — `first_audio` followed by a user transcript one second later, every
   time. Its own voice through the speakers was cancelling its speech (`minWords` defaults to **0**).
   → the event timeline *was* the diagnosis.
3. **Blocking extraction** — awaited inline, it added a full second LLM round-trip to every turn before the
   agent could speak. Moved to a tracked background promise, with qualification awaiting that exact promise.
   → latency thinking with correctness preserved.

---

## Non-negotiables

- ❌ Never claim tests or evals exist — **there are none**
- ❌ Never claim knowledge of proprietary model internals
- ❌ Never imply the demo qualification rules are real legal criteria
- ❌ Never say "I built Vapi" — say "a Vapi-*like* orchestration layer on top of realtime infrastructure"
- ✅ State the gaps out loud at least once. It reads as senior, not weak.
