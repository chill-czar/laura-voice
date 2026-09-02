# 01 — What I Actually Built (verified against the codebase)

> Every row below was read out of the repository. If it is not in this file, **do not claim it on camera.**
> Gaps and known-broken things are in the last section — read that before recording.

---

## The one-sentence architecture

> LiveKit owns realtime media and the voice pipeline. My `CallOrchestrator` owns the business state machine.
> Agents are specialised reasoning policies. Tools are the only way the model mutates business state.
> Postgres is the durable source of truth, Redis carries ephemeral events, OpenRouter provides model routing,
> and the frontend is a thin observability layer.

That sentence is true of the code as written. Say it early, then spend the rest of the video proving each clause.

---

## Concept → Implementation map (the table Biswa will care about)

| Concept | Implementation | File |
|---|---|---|
| Voice gateway / realtime transport | LiveKit Cloud + `@livekit/agents` 1.6.3 | `apps/agent/src/entry.ts` |
| VAD / turn detection | Silero VAD, prewarmed per worker | `entry.ts` `prewarm()` |
| Streaming STT | Deepgram `nova-3` | `entry.ts:29` |
| Streaming TTS | Deepgram `aura-asteria-en` | `entry.ts:30` |
| LLM gateway | OpenRouter via LiveKit's OpenAI-compatible adapter | `entry.ts:31-35` |
| Non-realtime LLM (extraction/summary) | `@openrouter/sdk` | `services/OpenRouterService.ts` |
| Business control plane | `CallOrchestrator` | `orchestrator/CallOrchestrator.ts` |
| Typed call state | `CallState` | `orchestrator/CallState.ts` |
| Context engineering | `ContextService.buildInstructions()` | `orchestrator/ContextService.ts` |
| State machine | `PHASE_TRANSITIONS` + `isTransitionAllowed()` | `packages/shared/src/phases.ts` |
| Qualification rules | `evaluateQualification()` — pure function, no LLM | `packages/shared/src/intake.ts` |
| Tool layer | `ToolRegistry` (9 tools) | `tools/ToolRegistry.ts` |
| Durable state | PostgreSQL + Prisma | `packages/db/prisma/schema.prisma` |
| Ephemeral events | Redis stream + pub/sub | `services/EventService.ts` |
| Knowledge retrieval | `PolicyService` — 4 markdown + 2 JSON docs, topic lookup | `services/PolicyService.ts` |
| Live frontend feed | Redis pub/sub → SSE → React | `api/services/EventStreamService.ts`, `web/hooks/useCallEventStream.ts` |
| Presentation | Next.js 16 / React 19 | `apps/web/` |

---

## Subsystem detail

### 1. `CallOrchestrator` — the business control plane
**File:** `apps/agent/src/orchestrator/CallOrchestrator.ts`

- `transitionPhase(next, reason)` — **rejects** any transition not in `PHASE_TRANSITIONS`, logs `phase.transition_rejected`.
- `prepareHandoff(target)` — validates the phase edge *before* constructing the next agent. Returns `null` if illegal.
- `runQualification()` — calls the pure rule function, persists status, emits event. **Awaits `pendingExtraction` first** so it never judges on stale fields.
- `recordUserTurn()` — persists the turn, pushes to the rolling window, and schedules background extraction.
- `endCall()` — guarded by an `ended` flag (idempotent), generates a summary if none supplied, bridges `SCHEDULING → CONFIRMATION → COMPLETED`, then fires `onEnded` to tear the session down.

**Say this:** "The LLM proposes; this class decides. A handoff tool can *ask* to move to qualification — `prepareHandoff` is what actually allows or refuses it."

### 2. `CallState` — typed state, not a service
**File:** `orchestrator/CallState.ts`
- `currentPhase`, `activeAgent`, `turnState`, `callerId`, `matterId`, `collectedFields`, `qualificationStatus`, `interruptionCount`
- `missingRequiredFields` — a getter derived from `REQUIRED_INTAKE_FIELDS`; this is what drives the agent's next question.
- `recentUserTurns` — rolling window of 6, because streaming STT fragments one spoken thought into several finals.
- `pendingExtraction` — the in-flight background extraction promise.

### 3. Agents (4) and handoffs
| Agent | File | Enters on | Key tools |
|---|---|---|---|
| Triage | `agents/TriageAgent.ts` | call start | `begin_intake`, `request_human_handoff`, `end_call` |
| Intake | `agents/IntakeAgent.ts` | from triage | 6 data tools + `proceed_to_qualification` |
| Qualification | `agents/QualificationAgent.ts` | from intake | `proceed_to_scheduling`, `return_to_intake` |
| Scheduling | `agents/SchedulingAgent.ts` | from qualification | availability + booking |

All four have an `onEnter` that speaks immediately, so a handoff never lands in dead air.
`QUALIFICATION → INTAKE` is a real edge — an INSUFFICIENT result loops back for the missing facts.

### 4. Deterministic qualification — the strongest single point
**File:** `packages/shared/src/intake.ts` → `evaluateQualification()`

```
representedByAttorney === true        → DISQUALIFIED (immediately, regardless of everything else)
hasInjury && supportedType && dateKnown → QUALIFIED
otherwise                             → INSUFFICIENT (+ machine-readable reasons[])
```
Supported types: `motor_vehicle_accident`, `slip_and_fall`, `workplace_injury`, `dog_bite`.

**Say this:** "This is a pure function with no LLM in it. The model extracts the facts; code makes the decision. I can unit-test it, and it returns the same answer every time. `QualificationAgent` only *explains* the result — it can't change it."

### 5. `ToolRegistry` — 9 tools, one wrapper
**File:** `tools/ToolRegistry.ts`

`get_caller`, `create_caller`, `create_matter`, `update_matter_intake`, `get_matter`,
`check_appointment_availability`, `schedule_follow_up`, `add_call_note`, `end_call`

Every tool goes through `wrap()`, which:
1. emits `tool.started` with the input,
2. validates input against the shared zod schema (**the same schema generates the JSON schema the LLM sees** — no drift),
3. emits `tool.completed` with `durationMs`, or `tool.failed`,
4. **never lets an exception reach the LLM** — errors come back as `{ error }` so the agent can recover verbally.

### 6. Idempotency — `schedule_follow_up`
**File:** `services/AppointmentService.ts`
Key = `callId + appointmentRequestId`, enforced by a `@unique` column. A retry returns the existing appointment with `idempotent: true` instead of double-booking. This is the concrete answer to "what if the tool is called twice?"

### 7. Structured extraction
**File:** `services/OpenRouterService.ts`
- Runs on **every user turn in every phase** (from `recordUserTurn`), not just during intake — callers describe the incident during triage.
- **Non-blocking**: the framework awaits turn callbacks before generating the spoken reply, so awaiting extraction would add a whole LLM round-trip to every turn's latency. `runQualification()` awaits it instead.
- Uses OpenAI-strict `json_schema`, then **re-validates with zod** before anything is persisted.
- Failures surface as `error` events with `source: "intake_extraction"`.

**Worth telling as a war story:** zod's generated JSON schema omits `additionalProperties:false` and `required`, which OpenAI strict mode rejects with a 400. Every extraction call was failing *silently* because the error was swallowed and returned as `{}`. `toStrictJsonSchema()` post-processes the schema; failures now throw and surface as events. That's a real debugging story about observability being the thing that makes a bug findable.

### 8. `EventService` — one call site, four destinations
**File:** `services/EventService.ts`
Postgres `CallEvent` row → Redis `call-events` stream (`XADD`) → Redis per-call pub/sub channel → structured console line.

**20 event types are actually emitted** (verified): `call.started`, `agent.entered`, `agent.handoff`, `phase.changed`, `user.transcript.partial`, `user.transcript.final`, `agent.speech`, `llm.started`, `llm.completed`, `tts.started`, `first_audio`, `tool.started`, `tool.completed`, `tool.failed`, `intake.fields_extracted`, `interruption.detected`, `speech.cancelled`, `call.note`, `call.ended`, `error` — plus `latency.end_of_utterance`.

### 9. Context engineering
**File:** `orchestrator/ContextService.ts` — assembles exactly:
role instructions → `CURRENT PHASE` → `KNOWN CALLER` → `KNOWN MATTER FIELDS` → `REQUIRED MISSING FIELDS` → `RELEVANT POLICY` (topic-selected) → optional recent turns → `GLOBAL RULES`.

Note the **negative space**: no full transcript, no whole-database dump, only the policy topics that agent needs.

### 10. Retrieval — two kinds, no vector DB
- **Structured:** `get_caller(phone)` → returns the caller *and* their most recent open matter → `get_matter(matterId)` loads the stored fields into live call state.
- **Knowledge:** `PolicyService` loads 4 markdown + 2 JSON docs at boot and serves them by topic.

**Say this:** "I deliberately didn't add a vector database. Retrieval here is 'load this caller's record' and 'pick the right policy document for this phase'. Both are exact lookups. Embeddings would have been resume-driven development."

### 11. Frontend
`CallConsole.tsx` — 3 columns (Conversation / orb + controls / Case Details) + Activity Log.
`deriveCallState.ts` — **reconstructs the entire call state purely from the event log**, so the panel and the timeline can never disagree.
`AgentOrb.tsx` — driven by real `useVoiceAssistant()` state and real `useTrackVolume()` amplitude.
Call ending keeps everything on screen; **New Call** starts a fresh one.

---

## Verified latency instrumentation (real numbers exist)

| Measurement | Where | Event |
|---|---|---|
| End-of-utterance delay | `entry.ts` eou_metrics | `latency.end_of_utterance` `durationMs` |
| STT transcription delay | same | `metadata.transcriptionDelayMs` |
| **LLM time-to-first-token** | llm_metrics | `llm.completed` `metadata.ttftMs` |
| LLM total | llm_metrics | `llm.completed` `durationMs` |
| Prompt/completion tokens | llm_metrics | `metadata.promptTokens` / `completionTokens` |
| **TTS time-to-first-byte** | tts_metrics | `first_audio` `durationMs` |
| Tool execution | `ToolRegistry.wrap` | `tool.completed` `durationMs` |
| Extraction | orchestrator | `intake.fields_extracted` `durationMs` |

Real values seen in a recorded call: TTFT ~590–820ms, TTS first byte ~284–411ms, eou ~577–580ms.
**Use numbers from the call you actually record — do not reuse these.**

---

## Gaps — know these before you record

**Say them if asked. Do not volunteer all of them, but never claim the opposite.**

1. **There are no tests and no evals. Zero.** `CLAUDE.md` §23 asks for 20–30 scripted conversations; none exist. This is the single biggest gap. See `16-evaluation.md`.
2. **Three event types are defined but never emitted:** `context.retrieved`, `llm.first_token`, `user.speech.started`. TTFT *is* captured as metadata on `llm.completed`, so the measurement exists — but don't point at a `context.retrieved` row on the timeline, it won't be there.
3. `latency.end_of_utterance` is emitted as a raw string and isn't in the `CallEventType` enum, so it would fail `callEventPayloadSchema` validation. Harmless today (nothing validates on that path) but it's an inconsistency.
4. **No single end-to-end "user stopped speaking → first agent audio" metric.** The pieces are all measured; the aggregate has to be derived by subtracting event timestamps. See `08-latency.html`.
5. **The full Docker stack has never been successfully built.** `docker compose up -d postgres redis` + `bun run dev` is the verified path. Don't run `docker compose up --build` live on camera.
6. **No telephony.** Browser WebRTC only. No SIP trunk, no PSTN. You can *explain* where SIP would attach; you have not built it.
7. **No authentication anywhere on the API.** Fine for a local demo, must be said out loud if asked about production.
8. **An unresolved bug:** TTS sometimes doesn't play after a long silence. Root cause not yet confirmed.
9. `apps/docs` and `packages/ui` are unused `create-turbo` leftovers.
10. The `INSUFFICIENT → INTAKE` loop has no retry ceiling — it could ping-pong.
11. Qualification runs on `QualificationAgent.onEnter`; if the caller never reaches that phase, no qualification is recorded.
