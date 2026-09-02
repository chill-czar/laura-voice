# 14 — Recording Plan

**Target: 13–15 minutes.** A dense 13 minutes beats a rambling 30. If you overrun, cut Section 4 (speech models)
to 45 seconds — the orchestration and demo sections are what earn the role.

---

## Timeline

| # | Section | Time | Duration | Screen |
|---|---|---|---|---|
| 1 | Hook — the gap and the decision | 0:00 | 1:00 | You / idle app |
| 2 | What I learned — the real layer stack | 1:00 | 1:30 | `03-voice-under-the-hood.html` (top strip) |
| 3 | Architecture | 2:30 | 1:30 | `02-master-architecture.html` |
| 4 | Model level — cascaded vs S2S | 4:00 | 1:15 | `04-speech-models.html` + your Excalidraw |
| 5 | **Orchestration** ⭐ | 5:15 | 1:45 | `05-orchestration.html` → real code |
| 6 | Context + data pipeline | 7:00 | 1:30 | `06-` then `07-` |
| 7 | Latency | 8:30 | 1:00 | `08-latency.html` → your call detail |
| 8 | Interruption | 9:30 | 1:00 | `09-interruptions.html` |
| 9 | **LIVE DEMO** ⭐ | 10:30 | 2:30 | Browser + terminal split |
| 10 | Traces / DB | 13:00 | 0:45 | Call detail + Prisma Studio |
| 11 | Production thinking + gaps | 13:45 | 0:45 | Back to you or architecture |
| 12 | FDE fit + close | 14:30 | 0:45 | You |

**Two starred sections carry the video.** If anything gets squeezed, protect 5 and 9.

---

## Screen setup

**Layout A — narration** (sections 1–8, 11–12): browser full-screen with the HTML page.
**Layout B — demo** (sections 9–10): browser ~70% left, terminal ~30% right, agent log visible and scrolling.

Set up Layout B **before** you start recording and practise switching once.

Prep before hitting record:
- Browser zoom ~110–125% — code and log text must be readable when compressed by video encoding
- Terminal font bumped up; dark theme
- Close Slack/mail/notifications; hide bookmarks bar
- Tabs pre-opened in order: `02` … `09`, `localhost:3000`, Prisma Studio
- Editor open on `CallOrchestrator.ts` and `intake.ts` (the two files you'll actually show)

---

## When to show what

| Show | During | For how long |
|---|---|---|
| Your Excalidraw: cascaded vs S2S | Section 4 | ~30s |
| Your Excalidraw: realtime voice pipeline | Section 2 | ~20s |
| Your Excalidraw: "under Vapi" | Section 3, as a lead-in | ~20s |
| `evaluateQualification()` in the editor | Section 5 | ~20s — the single best code moment |
| `PHASE_TRANSITIONS` table | Section 5 | ~15s |
| `prepareHandoff()` | Section 5 | ~20s |
| `ContextService.buildInstructions()` | Section 6 | ~20s |
| Live agent terminal | Section 9 | continuously |
| Prisma Studio | Section 10 | ~30s |

**Do not** scroll through files you aren't discussing. Four code moments total, each deliberate.

---

## Your Excalidraw diagrams — which to use

| Diagram | Verdict | Why |
|---|---|---|
| **Cascaded vs speech-to-speech** | ✅ **Show** | Directly answers Q13–16. Your own drawing beats my HTML here — it shows you worked it out. |
| **Realtime voice pipeline** | ✅ **Show** | Perfect for Section 2. Establishes the layer stack fast. |
| **Vapi underneath / voice architecture** | ✅ **Show briefly** | Strong lead-in to Section 3, then cut to the real architecture page. |
| **Speech encoder / vocoder** | ⚠️ **Only if clean** | High risk of overclaiming. Use it only to define the two terms, then move on. If it implies you know a specific model's internals, **skip it**. |
| **Meeting bot architecture** | ❌ **Skip** | Different product, dilutes the story. Nothing to do with intake. |

**Check before showing any diagram:**
- Does it draw VAD and endpointing as the *same* box? → Say aloud that they're different; that nuance is a plus.
- Does it show STT→LLM→TTS as non-streaming boxes? → Clarify that every boundary streams.
- Does it label anything as "how OpenAI does it"? → Relabel as "general architecture" before recording.

---

## Recording mechanics

- **Record in segments**, not one take. Sections 1–8 can each be redone independently.
- **Do the demo separately** and keep a known-good backup take.
- 1080p minimum. Check the *smallest* text is legible after export.
- Test mic level — you're demoing a *voice* product; bad audio undercuts you.
- Leave a beat of silence between sections for clean cuts.

---

## Order of recording (not the order of the video)

1. **Demo first**, while the system is warm and you know it works. Record 2–3 takes.
2. Then the narration sections in order — you'll reference what actually happened in the demo.
3. Hook last. You'll be warmed up and it's the part that needs the most natural delivery.

---

## Pre-flight checklist

**System**
- [ ] `docker compose up -d postgres redis`
- [ ] `bun run db:migrate && bun run db:seed`
- [ ] `bun run dev` — all three apps up
- [ ] Throwaway call completed successfully: audio heard, fields extracted, no errors
- [ ] **Headphones on**
- [ ] Rehearsed the returning-caller path once (`+1-555-0100`) — cut it if flaky

**Content**
- [ ] Read `13-avoid.md` immediately before recording
- [ ] `15-cheat-sheet.md` printed or on a second screen
- [ ] Know your three stories: silent extraction 400 · self-interruption · blocking extraction latency
- [ ] Know your actual latency numbers from *your* demo call
- [ ] Can state the one-sentence architecture from memory

**Honesty**
- [ ] You will say "no automated evals yet" at least once
- [ ] You will say "I don't know proprietary model internals" at least once
- [ ] You will not imply the demo rules are real legal criteria
