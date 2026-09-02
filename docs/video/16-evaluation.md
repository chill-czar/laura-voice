# 16 — Evaluation

> **Current state, stated plainly: there are zero tests and zero evals in this repository.**
> No `*.test.ts`, no test runner, no eval harness, no scripted conversations. `CLAUDE.md` §23 asks for
> 20–30 scripted conversations; none exist.
>
> This is the **single biggest gap** in the project. Do not paper over it — but do show that you know exactly
> what belongs here and why.

---

## Why this matters more for voice than for normal software

- A voice agent fails **probabilistically**. "It worked when I tried it" is not evidence.
- Failures are **silent**: a field extracted into the wrong column, a tool called with a plausible-but-wrong
  argument, an agent that skips a required question. Nothing throws.
- You cannot manually re-run 30 conversations after every prompt change. Without evals, **every prompt edit is
  an unmeasured regression risk.**
- For a legal intake product specifically, the expensive failure isn't a crash — it's a **confidently wrong
  record** that a paralegal trusts.

**The line to say:** *"The reason evals matter here more than in normal backend work is that my failure mode
isn't an exception — it's a plausible-looking wrong answer that nothing crashes on."*

---

## What I'd build, in priority order

### Tier 1 — pure unit tests (no LLM, no network, ~2 hours)
The highest-value tests, because the most important logic is **already deterministic and pure**:

| Target | File | Cases |
|---|---|---|
| `evaluateQualification()` | `packages/shared/src/intake.ts` | attorney → DISQUALIFIED regardless of everything else; all three conditions → QUALIFIED; each missing condition → INSUFFICIENT with the right `reasons[]`; unsupported incident type |
| `isTransitionAllowed()` | `packages/shared/src/phases.ts` | every legal edge passes; a sample of illegal edges rejected; terminal states accept nothing |
| `CallState.mergeIntakeFields()` | `orchestrator/CallState.ts` | nulls skipped; empty arrays skipped; later turns don't erase earlier facts; returns correct `updatedKeys` |
| `missingRequiredFields` | same | shrinks correctly as fields land |
| `toStrictJsonSchema()` | `services/OpenRouterService.ts` | adds `additionalProperties:false` + full `required` (this is the exact bug that killed extraction) |
| Tool input schemas | `packages/shared/src/tools.ts` | malformed input rejected before touching the DB |

> **This tier alone would materially change the story** — it's a few hours and it covers the logic you'll be
> claiming is deterministic and auditable on camera.

### Tier 2 — integration tests (real Postgres, no LLM, ~half a day)
Run against the Docker Postgres, assert on rows:

1. New caller → `create_caller` + `create_matter` → both rows exist, `Call` linked to both
2. **Returning caller** → `get_caller("+1-555-0100")` returns Sarah Miller **plus** her open matter → `get_matter` loads fields
3. Intake fields persist across multiple `update_matter_intake` calls without clobbering
4. Qualification writes `qualificationStatus` to the `Matter` row
5. **`schedule_follow_up` called twice with the same `appointmentRequestId` creates exactly one row** ← proves idempotency
6. `CallEvent` rows written for every tool call, with `durationMs` populated

### Tier 3 — scripted conversation evals (the real thing, ~1–2 days)
Feed transcripts directly into the orchestrator, **bypassing audio entirely** — this is the payoff of a cascaded
architecture: text in, text out, so the whole thing is scriptable.

Scenarios (from `CLAUDE.md` §23, ~20–30 total):

| # | Scenario | Asserts |
|---|---|---|
| 1 | Simple car accident, all info given | QUALIFIED; all 5 required fields; matter + appointment created |
| 2 | Caller unsure of date | INSUFFICIENT with `incident_date_unknown`; agent asks again; no invented date |
| 3 | Already has an attorney | DISQUALIFIED immediately, reason `already_represented_by_attorney` |
| 4 | No injury reported | INSUFFICIENT with `no_injury_reported` |
| 5 | Medical malpractice | `incident_type_not_supported` |
| 6 | Info given wildly out of order | All fields still land in the right columns |
| 7 | Returning caller | Existing matter resumed; **no duplicate matter created**; no re-asking known facts |
| 8 | Caller changes a fact mid-call ("actually it was the 27th") | Field updated, not duplicated |
| 9 | Irrelevant question ("what are your hours?") | Answered from policy; no matter created |
| 10 | Angry/frustrated caller | Stays in scope; no legal promises |
| 11 | Caller asks "will I win?" | **No legal conclusion** — hard fail if it answers |
| 12 | Caller asks for a human | `HANDOFF_HUMAN` |
| 13 | Missing phone number | Doesn't fabricate one |
| 14 | Two incidents mentioned | Doesn't merge them into one matter |

---

## Metrics to report

| Metric | Definition | Target |
|---|---|---|
| **Required-field recall** | of the 5 required fields present in the script, % correctly extracted | > 95% |
| **Extraction precision** | % of extracted values that match ground truth | > 95% |
| **Hallucinated fields** | fields populated that were never stated | **0** |
| **Tool-selection accuracy** | correct tool chosen for the situation | > 90% |
| **Tool-argument correctness** | arguments match what was said | > 95% |
| **State-transition correctness** | final phase matches expected | 100% (deterministic — any failure is a real bug) |
| **Qualification correctness** | matches `evaluateQualification` ground truth | 100% |
| **Inappropriate legal claims** | any legal conclusion or guarantee | **0 — hard fail** |
| **Appointment correctness** | right slot, exactly one row | 100% |
| **Duplicate-matter rate** | returning callers given a second matter | 0 |
| **Completion rate** | calls reaching a terminal phase | > 90% |
| **p50 / p95 turn latency** | needs the aggregate event added first | p95 < 2.5s |

**Do not report a single number for any of these on camera. You have not run them.**

---

## How I'd wire it

```
packages/shared        → vitest, pure functions, runs in CI on every commit
apps/agent/evals/      → scripted transcripts as fixtures
                       → drive CallOrchestrator directly, no LiveKit, no audio
                       → real Postgres (Docker), real OpenRouter (cheap model)
                       → assert on DB rows + emitted CallEvents
                       → output a scorecard table per run
```

Two properties that make this tractable — and both are **consequences of architecture decisions I already made**:

1. **The pipeline is cascaded**, so the orchestrator's interface is text. No audio fixtures needed.
2. **Every decision emits an event**, so assertions read the same event log the UI reads. The eval harness and
   the frontend consume the identical data.

**That's the point worth making on camera:** *"I can't show you eval results. But the reason I could build this
harness quickly is that I made the qualification logic pure, the pipeline text-based, and every decision
observable. The architecture is eval-ready even though the evals aren't written."*

---

## What to actually say in the video

> "There are no automated evals yet, and that's the biggest gap in the project. I know exactly what I'd build:
> unit tests on the deterministic core — qualification rules, state transitions, field merging — then
> integration tests against Postgres for the tool paths including the idempotency case, then twenty to thirty
> scripted conversations measuring field recall, hallucination rate, tool accuracy and inappropriate legal
> claims. For a voice agent that's not optional, because the failure mode isn't a crash, it's a confidently
> wrong record. The architecture is built for it — text-based pipeline, pure rule functions, everything
> emits events — I just haven't written them yet."

**If you have a few hours before recording: write Tier 1.** Six pure-function test files would let you say
"the deterministic core is tested" instead of "there are no tests", and it's genuinely the highest
credibility-per-hour work available.
