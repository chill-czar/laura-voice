# 15 — Cheat Sheet

> One page. Beside the monitor. No paragraphs.

---

### THE SENTENCE (memorise)
LiveKit = media · **My orchestrator = business state machine** · Agents = reasoning policies · Tools = only path to mutation · Postgres = truth · Redis = events · OpenRouter = model routing · Frontend = observability

---

### 1 · HOOK — 1:00
- Interview gave a specific direction
- Gap: knew voice through **provider abstractions**, not the runtime
- Chose to build instead of say "I can learn"
- **Never:** underestimated / you were wrong

### 2 · WHAT I LEARNED — 1:30 · `03-...html`
- Not `audio → LLM → audio`
- transport · VAD · **endpointing** · STT · orchestration · context · tools · TTS · observability
- **VAD ≠ endpointing** — "silence now" vs "turn over"
- 💡 *The engineering is between the models, not in them*

### 3 · ARCHITECTURE — 1:30 · `02-...html`
- Say THE SENTENCE
- Concept → implementation, always answer **why**
- **Redis dies = UI quiet. Postgres dies = data loss.**

### 4 · MODELS — 1:15 · `04-...html` + Excalidraw
- Cascaded ↔ S2S
- encoder · vocoder · acoustic vs semantic
- Lost at STT: prosody, emotion, speaker → *"Fine." vs "Fine!"*
- Cascaded because **transcript is the deliverable** for legal
- ⛔ "Can't claim proprietary internals"

### 5 · ORCHESTRATION ⭐ — 1:45 · `05-...html` + code
- **LLM probabilistic → business must be deterministic**
- `PHASE_TRANSITIONS` = **data table**, not ifs
- `prepareHandoff()` returns `null` = the gate
- `evaluateQualification()` = **pure function, 0 LLM**
- 💬 *"A firm can't have a model deciding who's disqualified"*
- Tools: no drift · observable · contained · idempotent

### 6 · CONTEXT + DATA — 1:30 · `06-` `07-`
- Blocks: role · phase · caller · fields · **missing** · policy · rules
- **Talk about what I exclude** ← the good part
- Loop: extract → merge → missing shrinks → *next prompt differs*
- **AI output ≠ source of truth** — proposal → zod → typed service
- Persist per-turn: **calls drop**

### 7 · LATENCY — 1:00 · `08-...html` + real panel
- endpointing → STT → **TTFT** → **TTS TTFB**
- Stream everywhere; never wait for a complete artifact
- 📖 Story: extraction was inline = 2 LLM calls per turn
- ⚠️ Aggregate turn metric **derived, not emitted**

### 8 · INTERRUPTION — 1:00 · `09-...html`
- Not a boolean → `TurnState`, **separate from `CallPhase`**
- Played audio can't be recalled → truncated msg into context
- **Tool calls run to completion** (idempotency makes retry safe)
- 📖 Story: `first_audio` → user transcript 1s later, every time. `minWords: 0` → **agent interrupted itself**

### 9 · DEMO ⭐ — 2:30 · browser + terminal
Call out: transcript streaming → **handoff** → fields fill live → **tool calls** → **INTERRUPT** → qualification flips → appointment → agent ends call

### 10 · TRACES — 0:45
Activity Log → Call History → **Prisma Studio**
💬 *"UI isn't the source of truth — here's the row"*

### 11 · PRODUCTION — 0:45
- Failure per boundary (LLM/tool/PG/Redis/hangup/double-call)
- ⚠️ **Say the gaps: no evals, no auth, no SIP, no retry/backoff**
- 💬 *"I'd rather tell you what's missing than have you find it"*

### 12 · FDE — 0:45
- Messy workflow → phases · 13 fields · 9 tools · audit trail
- **Per-customer parts are data, not code**
- 💬 *"When a firm tells me their real criteria, that's a config change on a call — not a prompt re-tune"*
- One line on public technical writing. Move on.

---

### MY NUMBERS (fill in after the demo call)
- TTFT: ______ ms
- TTS first byte: ______ ms
- End-of-utterance: ______ ms
- Events in call: ______

### THREE STORIES
1. **Silent 400** — strict schema missing `additionalProperties:false`; error swallowed → extraction dead, invisible
2. **Self-interruption** — echo → VAD → agent cancelled itself; `minWords 0 → 2` + AEC
3. **Blocking extraction** — inline await = 2 sequential LLM calls before speaking

### NEVER SAY
❌ built Vapi ❌ production-ready ❌ has tests ❌ knows GPT-4o internals ❌ qualifies cases legally ❌ handles phone calls ❌ you underestimated me
