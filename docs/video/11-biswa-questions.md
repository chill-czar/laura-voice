# 11 — The Interview Questions, Answered

> Every answer is 30–90 seconds spoken. Bullets are thinking scaffolding, not lines to read.
> **Bold = the sentence that carries the answer.** If you only remember one thing per question, remember that.

---

## Q1. "If you remove Vapi, can you build the system underneath it yourself?"

**Then:** I'd have described what Vapi does from the outside — I understood it as a product, not a runtime.

**Now:** **Vapi is roughly four things bolted together: media transport, a turn-taking loop, an orchestration
runtime, and a data/observability plane. I built the last two properly and integrated the first two.**

- I did **not** rebuild WebRTC/SFU — LiveKit owns that, and rebuilding it would be a bad engineering decision, not an impressive one.
- I did build: the turn-state machine, the business phase machine, agent routing with validated handoffs, the tool layer with validation and idempotency, context assembly, and the event/observability pipeline.
- **The honest line:** "I built a small Vapi-*like* orchestration layer on top of realtime infrastructure. I didn't rebuild the realtime infrastructure, and I'd push back on anyone who wanted to."

**Tradeoff:** Buying transport buys you jitter buffers, NAT traversal, reconnection, and codec negotiation — years of work. Building orchestration is where the actual product differentiation lives.

**Demo proof:** `CallOrchestrator.ts` + the live event log.

---

## Q2. "How would you build a voice calling system from first principles?"

**Now:** Work outward from the audio and name each boundary.

1. **Capture** — mic → PCM, with AEC/noise suppression at the browser
2. **Transport** — WebRTC (browser) or SIP/RTP (phone); jitter buffer, packet loss
3. **Turn-taking** — VAD per frame, then *endpointing*: is the turn over?
4. **Recognition** — streaming STT, partials + finals
5. **Orchestration** — state, context assembly, agent routing ← *the part that's actually mine*
6. **Reasoning** — LLM, streamed
7. **Action** — validated tools, the only path to state mutation
8. **Synthesis** — streaming TTS, sentence-chunked
9. **Playback** — back out over the same transport
10. **Cross-cutting** — events, latency, failure handling, evaluation

**Key framing:** **"Layers 1–4 and 9 I integrate. Layers 5, 7 and 10 I own. That split is the whole engineering judgement."**

---

## Q3. "What happens from the moment audio enters until the AI responds?"

Walk the chain, with real numbers from your recorded call:

`mic → Opus/WebRTC → LiveKit → VAD → endpointing (~578ms) → STT final (~415ms) → orchestrator assembles context → LLM TTFT (~700ms) → tool call? → TTS first byte (~300ms) → audio out`

- **Show the Activity Log while saying this.** The events literally appear in that order.
- Note that **each arrow is measured** — that's why you can say which stage is slow instead of guessing.

---

## Q4. "What's the audio/data pipeline?"

Two pipelines, don't conflate them:

- **Audio pipeline** — frames, real-time, milliseconds matter, mostly LiveKit + models
- **Data pipeline** — transcript → structured extraction → zod validation → typed service → Postgres → event → next turn's context

**The line:** **"Audio is ephemeral and I don't store it. Text and structured facts are durable. The transition point between those two is the STT boundary, and that's where I decide what's worth keeping."**

---

## Q5 / Q18. "What would you use for orchestration? / What happens during orchestration?"

**Now:** **"I didn't use an orchestration framework. I wrote the orchestrator, because the whole point is that this
layer encodes *my customer's* business rules — and those aren't generic."**

Per turn the orchestrator:
1. receives a final transcript
2. persists it
3. schedules background extraction
4. assembles context (`ContextService`)
5. lets the active agent reason
6. **validates any proposed transition** against `PHASE_TRANSITIONS`
7. executes tools through one wrapper
8. emits events at every step

**Show:** `prepareHandoff()` returning `null` when a transition is illegal.

---

## Q6 / Q7. "What is Vapi doing underneath? / How would you build Vapi?"

Same content as Q1, but frame it as *components*:

| Vapi gives you | Underneath it is |
|---|---|
| "Make a call" | SIP trunk or WebRTC room, media server |
| "It listens" | VAD + endpointing + streaming STT websocket |
| "It thinks" | Context assembly + LLM streaming + function calling |
| "It talks" | Streaming TTS + audio track publishing |
| "It handles interruptions" | Turn-state machine + generation cancellation |
| "Dashboard/logs" | Event pipeline + durable store |

**Say:** "The abstraction hides five hard problems. I now know which five, because I had to handle each one."

---

## Q8. "Important components of a production voice system?"

Answer as a checklist, and be honest about what you have:

✅ Realtime transport · ✅ Turn detection · ✅ Streaming STT/TTS · ✅ Orchestration + state machine ·
✅ Tool layer with validation · ✅ Idempotency · ✅ Durable persistence · ✅ Event/audit trail ·
✅ Latency instrumentation · ✅ Interruption handling · ✅ Error containment

⚠️ **Missing and I'll say so:** automated evals, authn/authz, telephony/SIP, load testing, p95 alerting, PII redaction policy beyond log redaction.

---

## Q9. "How do you maintain very low latency?"

Four levers, in order of impact:

1. **Stream at every boundary.** TTS starts on the first sentence, not the full response. Response length stops affecting perceived latency.
2. **Keep work out of the critical path.** VAD is prewarmed at worker start. **Structured extraction runs detached** — I had it inline first, and it added a whole LLM round-trip to every turn before the agent could speak.
3. **Keep the prompt small.** Empty fields are excluded, policy is topic-scoped, tools are per-agent. On a voice call the caller is listening to *silence* while the model reads context.
4. **Measure per stage.** TTFT and TTS-TTFB are separate metrics, so I optimise the right thing.

**Best next win:** semantic turn detection — endpointing (~578ms) is the most compressible number I have.

---

## Q10. "What happens with VAD?"

- Small binary classifier over short audio windows: speech or not. Silero, **running locally in-process** — no network hop in the turn loop.
- It knows nothing about words or meaning.
- **The important distinction:** VAD says "silence *now*". **Endpointing** says "the *turn* is over". A pause mid-sentence is not a finished turn — too eager and you talk over people, too patient and it feels dead.
- Also drives barge-in: user speech while `agentState === "speaking"` = interruption.

---

## Q11 / Q12. "How does STT work? / What models are involved?"

- Audio streams up a websocket; the model returns **revisable partials**, then a **final**.
- Acoustic model + language model, decoded into text — **I use it, I haven't trained one, and I'll say that.**
- Models here: **Silero** (VAD), **Deepgram nova-3** (STT), **any OpenRouter model** (LLM, env-swappable), **Deepgram aura** (TTS).
- **Point worth making:** one spoken thought often arrives as 4–6 separate finals. That's why extraction uses a rolling 6-turn window instead of one utterance — a real thing I learned from the logs.

---

## Q13 / Q14 / Q15 / Q16. Cascaded vs speech-to-speech, encoders, vocoders

Show `04-speech-models.html`.

- **Cascaded:** audio → STT → *text* → LLM → *text* → TTS → audio. Three models joined by text.
- **S2S:** audio → speech encoder → audio representation → multimodal model → representation → vocoder → audio. No text bottleneck.
- **Speech encoder:** turns waveform into vectors/discrete audio tokens a model can reason over — the audio analogue of tokenisation.
- **Vocoder:** turns a predicted representation (mel-spectrogram or audio codes) back into a playable waveform.
- **Why cascaded here:** for a *legal intake* product the transcript isn't a debugging nicety, it's part of the deliverable. Plus per-stage swappability, mature tool calling, and text-in/text-out makes evals scriptable.

**Hard boundary:** **"I can explain the general architecture class. I can't tell you the internals of a specific proprietary model, and I'm not going to pretend otherwise."**

---

## Q17. "What happens to audio information when converting speech to text?"

**Kept:** words, rough timing. **Lost:** prosody, intonation, emotion, speaker identity, background acoustics.

**The sharp example:** "Fine." said angrily and "Fine!" said with relief become *identical text*.

**Why I accepted it:** for an injury intake line I'd rather have an exact, replayable, auditable transcript than
emotional nuance. **That's a tradeoff I made, not a limitation I missed.** If emotional state mattered more than
the paper trail, that's the argument for speech-to-speech.

---

## Q19. "How do agents interact with tools?"

- 9 tools, all through one `wrap()` in `ToolRegistry`.
- **The zod schema that validates input is the same schema that generates the JSON schema the model sees** — no drift between what the model is told and what I accept.
- Every call emits `tool.started` (with input) → `tool.completed` (with output + `durationMs`) or `tool.failed`.
- **Exceptions never reach the model** — they come back as `{ error }` so the agent can apologise verbally instead of the call dying.
- Agents only see the tools their role permits — capability scoping.

**Show:** `tool.started` / `tool.completed` pairs in the live log.

---

## Q20. "How do you handle context?"

Show `06-context-engineering.html`. The assembled prompt is: role → phase → known caller → known matter fields →
**missing required fields** → topic-scoped policy → optional recent turns → global rules.

**The strong bit is the negative space:** no full transcript, no whole-DB dump, no empty fields, no irrelevant policy docs.

**The loop:** extraction → merge → `missingRequiredFields` shrinks → *next turn's prompt is different* → the agent
stops asking about what it already knows, with no "don't repeat yourself" instruction anywhere.

---

## Q21. "How do you engineer the data?"

- 13 typed intake fields on `Matter`, defined once in `packages/shared/src/intake.ts` and reused by the extractor, the tools, the DB writer, and the UI.
- **Field names match 1:1 across the LLM schema → validation → Prisma column.** No translation layer to drift.
- **Persist per-turn, not at call end** — calls drop, and a dropped call should still leave a usable matter.
- Full event log makes the call reconstructable; the frontend literally rebuilds state from it via `deriveCallState()`.

---

## Q22. "What happens in production when things fail?"

Go through it boundary by boundary — this is a *strong* question for you, answer it concretely:

| Fails | Behaviour today |
|---|---|
| LLM / OpenRouter | Error event emitted; call continues degraded |
| Tool throws | Caught in `wrap()`, returned as `{ error }`, agent recovers verbally |
| Extraction fails | Throws → `error` event with `source: intake_extraction`, visible on timeline (**this is what caught a real bug**) |
| Postgres down | Tool fails → agent apologises; nothing silently lost |
| Redis down | Live UI stops updating; **business state completely unaffected** |
| Caller hangs up mid-call | `session_closed` → `endCall()` runs, summary generated, everything already persisted |
| Tool called twice | Appointments are idempotent on `callId + appointmentRequestId` |

⚠️ **Missing:** retry/backoff on model calls, circuit breakers, DLQ for failed events, alerting. Say so.

---

## Q23. "How do you handle interruptions?"

Show `09-interruptions.html`, and tell the self-interruption story — it's your best debugging anecdote.

- Not a boolean — an explicit `TurnState`, **separate from the business `CallPhase`** (being interrupted doesn't change what stage of intake you're in).
- On barge-in: token stream aborted, queued TTS discarded, truncated message committed to context so the model knows what the caller actually heard.
- **Audio already played can't be recalled** — that's the constraint that makes truncation-tracking necessary.
- **Tool calls deliberately run to completion** — a half-done DB write is worse than a wasted one, and idempotency makes retry safe.

---

## Q24. "How do you handle streaming?"

Every boundary streams: STT partials → LLM tokens → TTS sentence chunks → audio frames.
**"The rule is: never wait for a complete artifact before starting the next stage."**

---

## Q25. "How do you manage call state?"

Three tiers, and be explicit about durability:

| Tier | What | Survives crash? |
|---|---|---|
| `CallState` (memory) | phase, agent, collected fields, turn state | No |
| Redis | events, live feed | Not required to |
| Postgres | Caller, Matter, Call, Transcript, Events | **Yes — this is the product** |

Plus: **the LLM is not a state store.** It's given state; it doesn't own it.

---

## Q26. "How do you store/retrieve information during a conversation?"

- **Store:** extraction → validation → `CaseService` → Postgres, per turn.
- **Retrieve (structured):** `get_caller(phone)` → returns caller **and their most recent open matter** → `get_matter(id)` loads stored fields back into live state → they appear in the next prompt.
- **Retrieve (knowledge):** `PolicyService`, six local docs, selected by topic.
- **No vector DB, deliberately** — every lookup here is exact (primary key or topic). Embeddings would add failure modes to solve a retrieval problem I don't have. "I'd add them when topic routing stops working, not before."

---

## Q27. "How would this work for a real company/customer?"

- What's real: the workflow shape, the persistence model, the audit trail, the state machine.
- What a real deployment needs next: **telephony (SIP) instead of browser-only**, CRM/case-management integration instead of my Postgres, real firm intake rules instead of my four demo categories, authn/authz, PII policy, and evals gating deploys.
- **The FDE line:** **"The four qualification rules in here are placeholders. On a real deployment, the first week is sitting with the intake team and finding out what their actual rules are — and that's a config/data change in this design, not a rewrite."**

---

## Q28. "What does a forward-deployed engineer actually do?"

**"A backend engineer gets a spec. An FDE gets a description of how a business currently works — usually a
person, a spreadsheet, and a lot of tribal knowledge — and has to turn that into states, data and actions."**

The loop: talk to the customer → map the workflow → model it as state/fields/tools → pick where AI helps and
where it must *not* be trusted → build → deploy → observe → iterate with them.

**Then connect it:** this project *is* that loop run once. A messy human workflow ("someone answers the phone,
asks the same questions, types it into a spreadsheet, calls back") became a phase machine, 13 typed fields, 9
tools, and an audit trail. And the parts most likely to change per-customer — rules, policy docs, required
fields — are the parts I deliberately made data rather than code.
