# 10 — Demo Flow (3–5 minutes of live call)

## Pre-flight — do this 10 minutes before recording

```bash
docker compose up -d postgres redis
bun run db:migrate && bun run db:seed          # seeds Sarah Miller +1-555-0100 with an existing matter
bun run dev                                    # web :3000, api :4000, agent worker
```

Checklist:
- [ ] **Headphones on.** Not laptop speakers — the agent will interrupt itself on echo.
- [ ] Do a throwaway call first. Confirm you hear audio and that Case Details fills in.
- [ ] If the yellow **"🔊 Tap to enable sound"** button appears, click it before you start the real take.
- [ ] Terminal visible in a second window — the agent log is half the demo.
- [ ] `bunx prisma studio` open in a background tab (from `packages/db`) for the database reveal.
- [ ] Delete throwaway calls, or just remember which call ID is the real one.

**Screen layout:** browser (3/4 of screen) + terminal (1/4, right or bottom). The terminal log scrolling in
real time next to the UI is the single most convincing visual in the whole video.

---

## SCENARIO A — New caller, full happy path (~3 min)

This is the main take. Speak naturally, in your own words — the lines below are intent, not a script.

| # | You say (roughly) | What to point at on screen | Why it matters |
|---|---|---|---|
| 1 | *Click Start Call, allow mic* | Orb goes idle → connecting → listening | Real WebRTC session, real mic |
| 2 | Let the agent greet you first | `call.started`, `phase.changed GREETING→TRIAGE`, `agent.entered [TRIAGE]` in the log | The state machine is already running |
| 3 | "Hi — I was in a car accident yesterday and I hurt my back." | Watch `user.transcript.partial` → `final` stream in | Streaming STT, partials then final |
| 4 | *(agent asks a follow-up)* | `phase.changed TRIAGE→INTAKE` + `agent.handoff` | **First handoff.** Triage classified an injury case and routed |
| 5 | "It was around 6pm at the intersection of 5th and Main." | **Case Details panel fills in live** — location, date | Structured extraction → DB → SSE, all mid-call |
| 6 | "My name is Sarthak, my number is 555-0142." | `tool.started get_caller` → `tool.completed` → `create_caller` → `create_matter` | **Tool calls visible.** Point at input/output in the log |
| 7 | "I went to the ER, they did X-rays. Police came and filed a report." | More fields land: treatment, police report | Out-of-order collection still lands in the right column |
| 8 | **INTERRUPT HERE** — while the agent is mid-sentence, cut in: "Sorry — actually no, I haven't spoken to any attorney." | `interruption.detected` appears in the log; agent stops talking and responds to the new input | **Barge-in.** Do this deliberately, it's a headline moment |
| 9 | Let it move on | `phase.changed INTAKE→QUALIFICATION` | Second handoff |
| 10 | *(agent explains the outcome)* | Qualification pill flips to **QUALIFIED** | Deterministic rules decided this, not the LLM — say so |
| 11 | "Thursday afternoon works." | `tool.started check_appointment_availability` → slots returned → `schedule_follow_up` | Mock calendar + **idempotency key** |
| 12 | "That's all, thanks." | Agent gives a closing line, calls `end_call`, UI flips to **Call ended** with everything still on screen | AI decided to end the call |

**Then, without starting a new call:** scroll the Activity Log, open Call History → the call → show transcript,
intake fields, latency panel, full event timeline.

---

## SCENARIO B — Returning caller (~45 sec, optional but strong)

Only if time allows. This proves structured retrieval.

1. Start a new call.
2. Say: *"Hi, I called last week — my number is 555-0100."*
3. Agent calls `get_caller` → returns Sarah Miller **plus her existing open matter**
4. Agent calls `get_matter` → loads what's already on file
5. Agent should say something like *"I have your motor vehicle accident from August on file"* and only ask for
   what's missing — **it should not re-ask questions already answered**

> ⚠️ **This path was broken until very recently** — `get_caller` returned a caller with no way to reach their
> matter. It's fixed and verified against the seed data, but **rehearse it once** before recording. If it
> misbehaves on the day, cut this scenario rather than fighting it on camera.

---

## SCENARIO C — Disqualification (~30 sec, optional)

Shows the rules engine refusing a case:

1. New call, describe an accident normally.
2. When asked, say: **"I already have an attorney handling this."**
3. Qualification flips to **DISQUALIFIED**, reason `already_represented_by_attorney`.
4. Point out: this happens *regardless* of how good the rest of the case looks — it's a hard rule in
   `evaluateQualification()`, not a model judgement.

---

## What to show after the call

| Order | Screen | Say |
|---|---|---|
| 1 | Activity Log, scrolled to the top | "This is every orchestration decision, in order, with timings." |
| 2 | Call History → call detail | "The whole call is reconstructable from persisted state." |
| 3 | Latency panel | Read *your actual numbers* — TTFT, TTS first byte |
| 4 | Prisma Studio → `Matter` row | "The UI isn't the source of truth. Here's the actual database row." |
| 5 | Prisma Studio → `CallEvent` rows | "Every event is durable, not just streamed to a browser." |
| 6 | Prisma Studio → `Appointment` | Point at `idempotencyKey` |

---

## If something breaks live

Do not panic-debug on camera. Say the true thing and move on:

- **No audio** → "Autoplay's blocked, one click." Click the enable-sound button.
- **Agent interrupts itself** → "That's echo — I'm on speakers." Switch to headphones. (Better: just don't record on speakers.)
- **Extraction doesn't fire** → check the terminal for an `error` event with `source: intake_extraction`. That
  visibility is itself a point worth making — the failure is *observable*.
- **Anything else** → "That's a bug — here's what I'd look at in the event log." Then actually look. Debugging
  calmly on camera with your own observability is a *strength*, not a failure. It proves the traces work.

**Have a backup recording of a successful call** so you're never forced to do it live twice.
