# 12 — Technical Talking Points (main recording document)

> Speak from these. Don't read them. Each section lists what to *establish*, what to *show*, and the
> transition into the next section.

---

## SECTION 1 — HOOK (0:00–1:00)

**Establish:**
- The interview gave you a *specific*, useful direction — not vague feedback.
- The honest gap: **"I understood the voice stack through provider abstractions. I hadn't gone deep enough into the orchestration and runtime layer underneath."**
- You decided that saying "I can learn it" was weaker than showing it.
- What you built: a working voice intake system for a plaintiff firm — real call, real orchestration, real persistence.

**Show:** your face, or the app sitting idle. Nothing complicated.

**Tone check:** grateful and matter-of-fact. Not defensive, not apologetic, no "you'll be surprised".

> ❌ Never: "I was underestimated" / "you'll see I actually knew this"
> ✅ Instead: "That question about what's under Vapi was the most useful thing I got from the conversation."

**Transition:** *"So the first thing I had to do was stop thinking of it as audio-in, audio-out."*

---

## SECTION 2 — WHAT I LEARNED (1:00–2:30)

**Establish:** the naive model vs the real one.

- Naive: `audio → LLM → audio`
- Real: transport → media → VAD → **endpointing** → STT → orchestration → context → reasoning → tools → state → TTS → observability

**The insight to land:** **"The interesting engineering isn't in the models. It's in the layer that decides what happens between them."**

Two sub-points worth making:
- VAD ≠ endpointing. "Is there sound right now" is easy; "is this person finished talking" is the hard one.
- Every boundary in that chain is a place to lose latency, lose information, or lose control.

**Show:** `03-voice-under-the-hood.html`, the pipeline strip at the top.

**Transition:** *"Once I had that map, I built a system that has all of those layers, for a real workflow."*

---

## SECTION 3 — ARCHITECTURE (2:30–4:00)

**Show:** `02-master-architecture.html`.

**Establish — say the one-sentence version early:**
> "LiveKit owns realtime media. My orchestrator owns the business state machine. Agents are reasoning policies.
> Tools are the only way the model mutates state. Postgres is durable truth, Redis is ephemeral events,
> OpenRouter is model routing, the frontend is an observability layer."

Then walk **concept → implementation** (the table at the bottom of that page). For each, answer *why*, not *what*:
- LiveKit — "I'm not rebuilding jitter buffers and NAT traversal. That'd be bad judgement, not impressive."
- OpenRouter — "model swappable by env var; no provider lock-in in code."
- Redis vs Postgres — **"Losing Redis loses the live feed. It must never lose the matter."**

**Transition:** *"Let me show you what actually happens when someone speaks."*

---

## SECTION 4 — MODEL LEVEL (4:00–5:15)

**Show:** `04-speech-models.html`.

- Cascaded vs speech-to-speech, side by side
- Define cleanly: **speech encoder**, **vocoder**, **acoustic vs semantic information**
- What's lost at STT: prosody, emotion, speaker identity. The "Fine." / "Fine!" example.
- **Why cascaded here:** for legal intake, the transcript *is* part of the deliverable. Plus swappability, mature tool calling, scriptable evals.

**⚠️ Hard boundary — say it out loud:** *"That's the general architecture. I'm not going to claim I know the internals of a specific proprietary model."* Saying this **increases** credibility.

**Transition:** *"But the models are the part I integrate. The part I actually own is orchestration."*

---

## SECTION 5 — ORCHESTRATION (5:15–7:00) ← **the most important section**

**Show:** `05-orchestration.html`, then the real code.

**Establish the core principle:**
> "An LLM is probabilistic. A business process has to be deterministic. So the model proposes, and code decides."

Land these in order:
1. **The phase machine is a data table**, not `if` statements — printable, testable, showable to a customer.
2. **`prepareHandoff()` is the gate.** An agent can *ask* to move to qualification; this returns `null` if the edge is illegal.
3. **Qualification is a pure function with zero LLM calls.** Show `evaluateQualification()`.
   → **"A law firm cannot have a language model deciding who's disqualified. That has to be a rule someone can read and version."**
4. Tools: one wrapper, four guarantees — no schema drift, everything observable, failures contained, retries safe.

**Transition:** *"All of that depends on the model getting the right context — which is its own engineering problem."*

---

## SECTION 6 — CONTEXT + DATA (7:00–8:30)

**Show:** `06-context-engineering.html`, then `07-data-pipeline.html`.

- The prompt blocks, in order
- **Spend time on the negative space** — what you exclude and why. That's the part most people skip.
- The feedback loop: extraction → merge → `missingRequiredFields` shrinks → next prompt differs → agent asks something new
- Then the data pipeline: transcript → extraction → **zod validation** → typed service → Postgres → event → context
- **"AI output is not the source of truth."** The model returns a proposal; validation and a typed service decide what becomes real.
- Why persist per-turn: **calls drop, and a dropped call should still leave a usable matter.**

**Transition:** *"Two things make or break this in practice: latency and interruptions."*

---

## SECTION 7 — LATENCY (8:30–9:30)

**Show:** `08-latency.html`, then your **actual** call-detail latency panel.

- The turn budget: endpointing → STT → LLM TTFT → TTS TTFB
- **Streaming is the whole answer.** Never wait for a complete artifact before starting the next stage.
- The extraction story: *"I had it inline, awaited. Every turn paid for two sequential LLM calls before the agent could speak. Moving it to a tracked background promise — with qualification awaiting that exact promise — kept correctness and removed a round-trip."*
- Honest: **the aggregate end-to-end number isn't emitted as its own event yet.** Each stage is measured; I derive the total from timestamps. Next thing I'd add.

**Transition:** *"And the thing that makes it feel like a phone call rather than a voice interface — interruptions."*

---

## SECTION 8 — INTERRUPTION (9:30–10:30)

**Show:** `09-interruptions.html`.

- Why a boolean is the wrong model — four different things are in flight
- `TurnState` is **separate** from `CallPhase` — being interrupted doesn't change what stage of intake you're in
- Audio already played can't be recalled → that's *why* the truncated message goes into context
- **Tool calls deliberately run to completion** — half-done writes are worse than wasted ones; idempotency makes retry safe
- **Tell the self-interruption bug story.** The log showed `first_audio` then a user transcript one second later, every time. That pattern *was* the diagnosis. Default `minWords` is 0, so its own echo cancelled its speech.
  → **"That's observability paying for itself. I didn't guess — the timeline told me."**

**Transition:** *"Let me just show you the thing running."*

---

## SECTION 9 — DEMO (10:30–13:00)

Follow `10-demo-flow.md`. Keep narration light — let the log and panels do the work.

Beats to call out as they happen:
- transcript streaming in
- **handoff** (`phase.changed` + `agent.handoff`)
- Case Details filling **live**
- **tool calls** with visible input/output
- **the deliberate interruption**
- qualification flipping — *"decided by the rule function, not the model"*
- appointment booked with an idempotency key
- the agent deciding to end the call

Then: Activity Log → Call History → **Prisma Studio**.
> "The UI isn't the source of truth — here's the actual row in Postgres."

**Transition:** *"So what would it take to actually put this in front of a firm?"*

---

## SECTION 10 — PRODUCTION THINKING (13:00–14:00)

Go through failure boundaries concretely (table in `11-biswa-questions.md` Q22).

**Then be explicit about gaps — this is a credibility move, not a weakness:**
- **No automated evals.** Biggest gap. You know exactly what you'd build (`16-evaluation.md`) and why it matters most: *"For a voice agent, 'it worked when I tried it' isn't evidence."*
- No auth, no SIP/telephony, no retry/backoff on model calls, no p95 alerting
- Full Docker stack unverified; one open TTS-after-silence bug

> **"I'd rather tell you what's missing than have you find it."**

**Transition:** *"The reason I built it this way is the same reason I think I'd be useful in this role."*

---

## SECTION 11 — FDE FIT (14:00–15:00)

See `12b` below and the FDE section — keep it **short and concrete**, no resume reading.

**The core argument:**
- A messy human workflow ("someone answers the phone, asks the same questions, types them into a spreadsheet, calls back") became: a phase machine, 13 typed fields, 9 tools, an audit trail.
- **The parts that change per customer — rules, policy docs, required fields — I deliberately made data, not code.**
- You've done the customer-facing half before: sold automation work, sat in sales calls, translated business requirements into systems, shipped and iterated.
- You learn in public and can explain technical things clearly — briefly note the X/Instagram technical content as *evidence of communication*, one sentence, then move on.

**Close:** what you'd want to learn from the Laura team.

---

## FDE POSITIONING — the argument in one block

**The question to answer:** *"Why is this person useful when a customer hands us a messy workflow and says 'make AI do this'?"*

| FDE demand | Evidence from this project | Evidence from background |
|---|---|---|
| Understand a domain workflow fast | Modelled plaintiff intake end-to-end from public product scope | Sold and scoped automation projects for clients |
| Turn ambiguity into a data model | 9 phases, 13 fields, 4 rules, 9 tools | Built products from scratch, frontend → backend |
| Know where AI must *not* be trusted | Qualification is deterministic; LLM never writes to DB | — |
| Ship a real system, not a notebook | Turborepo, Postgres, Redis, Docker, SSE, typed contracts | Distributed/backend systems, queues, WebSockets, Redis |
| Debug live systems | Found self-interruption + silent extraction 400 via own event log | AI code-review infrastructure |
| Talk to customers | The demo *is* a customer conversation artifact | Sales calls, requirement gathering, delivery |
| Communicate technically | This video; the deep-dive pages | Public technical content on X / Instagram |
| Iterate with feedback | This whole project came from interview feedback | Startup / venture environment, MVP → customer |

**One sentence to have ready:**
> "The reason I built the qualification rules as a pure function instead of a prompt is that when a firm tells me
> their actual intake criteria — and they will, and it'll be different from my four categories — I want that to be
> a config change I can make with them on a call, not a prompt I have to re-tune and re-evaluate."

That single sentence demonstrates FDE thinking better than any list.
