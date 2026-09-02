# Laura Voice Intake Orchestrator (V1)

> **Portfolio demo, not a product.** Synthetic data only. This system does not provide legal advice, does not
> create an attorney-client relationship, and never makes legal conclusions. See [`CLAUDE.md`](./CLAUDE.md) for
> the full spec this implements.

A small but genuinely working end-to-end voice-AI intake system for a plaintiff law firm: a caller talks to a
browser-based voice agent, the agent conducts a structured intake conversation, and everything — transcript,
extracted case facts, tool calls, agent handoffs, and orchestration events — is persisted and visible live in the
frontend and in the terminal as it happens.

## Architecture

```
Browser mic
    │  WebRTC
    ▼
LiveKit (Cloud)  ───────────────────────────────────────────────┐
    │  media/session transport                                  │ room events
    ▼                                                            ▼
apps/agent (LiveKit Agents worker)                          apps/api (Express)
    │  Silero VAD → Deepgram STT → OpenRouter LLM → Deepgram TTS
    │  CallOrchestrator (state machine) ─┬─ TriageAgent
    │                                    ├─ IntakeAgent      (structured extraction via OpenRouterService)
    │                                    ├─ QualificationAgent (deterministic rules, not LLM-decided)
    │                                    └─ SchedulingAgent
    │  ToolRegistry → CaseService / AppointmentService / CallLogService
    │  EventService ─────────────┬──────────────────────────────►  Postgres (CallEvent, durable)
    │                            └──────────────────────────────►  Redis `call-events` stream/pub-sub
    ▼                                                                        │
Postgres (Caller, Matter, Appointment, Call, TranscriptTurn)                 │ SSE
                                                                              ▼
                                                                   apps/web (Next.js) — live console + call history
```

**One-sentence architecture summary:** LiveKit handles realtime media and the voice pipeline; `CallOrchestrator`
owns the business state machine; agents are specialized reasoning policies; tools are the only way the model
mutates business state; Postgres is the durable source of truth; Redis carries ephemeral events; OpenRouter
provides model routing; the frontend is a thin observability/demo layer.

## Monorepo layout

```
apps/
  web/    Next.js — call console + call history/detail (live via SSE)
  api/    Express — LiveKit token minting, read models, SSE event stream
  agent/  LiveKit Agents worker — orchestrator, agents, tools, voice pipeline
packages/
  db/     Prisma schema + client + seed
  shared/ zod schemas, event/phase enums, tool contracts, shared console logger
```

## What's real here (and what's intentionally deferred)

Built and working: the full orchestrator/agent/tool/service class set from `CLAUDE.md` §7, the cascaded voice
pipeline, multi-agent handoffs with a deterministic phase machine, structured extraction validated before
persistence, Postgres + Redis persistence, interruption logging, measured (not invented) latency, and a live
frontend fed by Server-Sent Events off the Redis event stream.

Deferred to a follow-up pass (see `CLAUDE.md` §23/§32 for the full list): the 20–30 scripted eval conversations
and automated eval harness, a broader automated test suite, LiveKit's semantic turn-detector plugin (V1 uses
standard VAD-based endpointing), and an architecture diagram image / recorded demo.

## Prerequisites

You need three free-tier accounts (Postgres/Redis run locally via Docker, no account needed):

| Service | Get it at | Env vars |
|---|---|---|
| LiveKit Cloud | https://cloud.livekit.io (free project) | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` |
| OpenRouter | https://openrouter.ai/keys | `OPENROUTER_API_KEY` |
| Deepgram | https://console.deepgram.com | `DEEPGRAM_API_KEY` |

Also: [Bun](https://bun.sh) ≥ 1.3, Docker Desktop.

## Run it locally

```bash
cp .env.example .env        # fill in the three keys above
bun install

docker compose up -d postgres redis
bun run db:migrate          # applies the schema
bun run db:seed             # synthetic demo caller/matter/appointment (Sarah Miller)

bun run dev                 # web (:3000), api (:4000), agent — all with live console logs
```

Open http://localhost:3000, click **Start Call**, allow microphone access, and talk through the demo script in
`CLAUDE.md` §24 (a car-accident intake). Try interrupting the agent mid-sentence — it stops and responds to the
new input. When you're done, open **Call History** to see the persisted transcript, extracted intake fields,
tool calls, handoffs, and measured latency for that call.

**Watching it happen** (this is the point of the demo):
- The `agent` terminal prints a structured, timestamped line for every orchestration step as it happens —
  phase transitions, tool calls in/out, LLM/TTS timing, transcript turns, handoffs, interruptions.
- The web console's transcript/intake/timeline panels update live via Server-Sent Events off the same event
  stream (Redis `call-events` → `apps/api` SSE → browser), not polling.
- `bunx prisma studio` (from `packages/db`, or `bun run db:studio` from root) lets you inspect Postgres directly
  to confirm persistence is independent of the UI.

### Optional: full Docker stack

```bash
docker compose up --build
```

Builds and runs `web`/`api`/`agent` themselves inside Docker too (Postgres/Redis included). The `bun run dev`
path above is faster to iterate against and keeps all three processes' logs directly visible, so it's the
recommended day-to-day loop; the full compose stack is there for a closer-to-production smoke test.

## Environment variables

See [`.env.example`](./.env.example) for the complete, commented list. One root `.env` is shared by every app
(`web`/`api`/`agent`/`db`) via `dotenv-cli` — never commit it (already gitignored).

## Key design decisions / tradeoffs

- **Bun over pnpm.** `CLAUDE.md` suggests pnpm workspaces; the repo was already scaffolded with Bun
  (`create-turbo` default). Functionally equivalent for this monorepo — kept Bun rather than fight the scaffold.
- **Deepgram for both STT and TTS.** One API key instead of two (Deepgram Nova + Aura), still swappable —
  `apps/agent/src/entry.ts` is the only place that constructs the STT/TTS clients.
- **OpenRouter for the realtime LLM via LiveKit's OpenAI-compatible adapter**, pointed at
  `https://openrouter.ai/api/v1`. Adds one network hop versus calling a provider directly; accepted for model
  routing flexibility (swap `OPENROUTER_MODEL` without touching code).
- **VAD-based interruption, not the semantic turn-detector plugin.** Real interruption handling (the agent's
  speech is actually cancelled and the new turn processed), just without the extra cloud-inference model. See
  `apps/agent/src/entry.ts`'s `UserStateChanged` handler for the detection heuristic.
- **CallOrchestrator, not the LLM, owns phase transitions.** `packages/shared/src/phases.ts` defines the
  allowed state-machine edges; every agent's "handoff" tool calls back into
  `CallOrchestrator.prepareHandoff()`, which validates the edge before any handoff actually happens
  (`CLAUDE.md` §28/§34 — the LLM proposes, code decides).
- **Qualification is deterministic code**, not an LLM judgment call — see
  `packages/shared/src/intake.ts#evaluateQualification`. `QualificationAgent` only explains the result.
- **Idempotent appointment scheduling.** `AppointmentService.scheduleFollowUp` keys off
  `callId + appointmentRequestId` (`CLAUDE.md` §27) and returns the existing appointment on a retried call
  instead of double-booking.
- **SSE, not polling, for the live frontend.** `EventService` (agent) publishes every event to a Redis pub/sub
  channel; `apps/api` forwards it to the browser over Server-Sent Events — the timeline/intake panels update the
  moment something happens, and it doubles as a visible demonstration of the Redis event stream.
- **Docker build tradeoff:** the `Dockerfile`s copy the whole workspace and run a single `bun install` per image
  rather than a slimmed multi-stage prod-only dependency layer — simpler and reliable for a monorepo with a
  shared lockfile, at the cost of shipping devDependencies in the runtime image. Acceptable for a demo; would be
  worth tightening for a real deployment.

## Commands

```bash
bun run dev            # all apps, dev mode
bun run build           # turbo build across the workspace
bun run check-types     # turbo typecheck across the workspace
bun run lint            # turbo lint across the workspace

bun run db:migrate      # apply Prisma migrations
bun run db:seed         # seed synthetic demo data
bun run db:studio       # open Prisma Studio

docker compose up -d postgres redis   # infra only (recommended for dev)
docker compose up --build             # full stack in Docker
```

## Security / privacy

No real PII — seed data and demo usage are synthetic only. Secrets live in a single gitignored `.env`
(`.env.example` documents every variable) and are never logged (the shared logger redacts any field whose name
looks like a key/secret/token). This is a portfolio demo: it does not claim HIPAA, SOC 2, attorney-client
privilege, or production compliance.
