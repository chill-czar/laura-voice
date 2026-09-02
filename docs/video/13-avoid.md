# 13 — What NOT To Say

> The fastest way to lose a technical interviewer is one overclaim. Biswa challenged you on fundamentals —
> he will notice. Every ✅ below is *more* impressive than its ❌, not less.

---

## Overclaiming what you built

| ❌ Don't say | ✅ Say instead |
|---|---|
| "I built Vapi." | "I built a small Vapi-*like* orchestration layer on top of existing realtime infrastructure." |
| "I built a voice AI platform." | "I built the intake slice of one: orchestration, state, context, tools, persistence, observability." |
| "I built the realtime infrastructure." | "LiveKit owns media transport. Rebuilding that would be bad engineering judgement, not an achievement." |
| "It's production-ready." | "It runs end-to-end. Here's the specific list of what it needs before it goes near a real firm." |
| "I implemented VAD / STT / TTS." | "I integrated Silero, Deepgram STT and Deepgram TTS, and I own the turn logic around them." |

---

## Overclaiming model knowledge

| ❌ Don't say | ✅ Say instead |
|---|---|
| "I understand how GPT-4o voice works internally." | "Publicly it's described as natively multimodal. The encoder, tokenisation and decoder aren't public, and I won't invent detail I can't source." |
| "Speech-to-speech models work like this…" (stated as fact about a specific product) | "The general architecture class is encoder → model → representation → vocoder. What any specific proprietary model does inside, I can't tell you." |
| "I trained / fine-tuned a speech model." | "I haven't trained speech models. I understand the architecture well enough to reason about the tradeoffs and pick the right one." |
| "Vocoders work by…" (over-detailed, shaky) | Give the clean one-liner: "It converts a predicted intermediate representation back into a playable waveform." Stop there. |

**Rule:** if you'd be uncomfortable being asked one follow-up question about it, don't assert it.
**"I don't know, but here's how I'd find out"** is a strong answer in an FDE interview.

---

## Legal claims — non-negotiable

| ❌ Don't say | ✅ Say instead |
|---|---|
| "It qualifies cases." | "It applies four explicit, synthetic demo rules that I wrote. A real firm's criteria would be different — that's a config change." |
| "It knows legal eligibility." | "It makes no legal determination. It collects structured facts and flags them against demo rules." |
| "It gives legal advice." | "It's explicitly instructed not to, and the UI carries a disclaimer." |
| Using anything resembling real client data | Say plainly: "All synthetic. Sarah Miller and +1-555-0100 are fake seed data." |

The app already shows the disclaimer — **point at it once**, briefly. It reads as maturity, not hedging.

---

## Tone — never sound like you're settling a score

| ❌ Don't say | ✅ Say instead |
|---|---|
| "You said I lacked fundamentals, so…" | "The interview gave me a very specific area to go deeper on." |
| "I was underestimated." | "That question about what's underneath Vapi was the most useful thing I took from the conversation." |
| "You'll be surprised." | Nothing. Let the demo do it. |
| "This proves I can do the job." | "This is the closest thing I could build to the actual work." |
| "I built all this in X days!" | Mention timeframe *once*, plainly, if at all. Let the density of the work imply the speed. |

---

## Don't oversell the artifact

| ❌ | ✅ |
|---|---|
| "Look how much I built." | "Let me show you the architecture and the decisions." |
| Listing every file | Show three things deeply: orchestration, context, the event trace. |
| Reading your resume | One line of relevant background, tied to a concrete FDE demand. |
| Long social-media section | One sentence: "I write about what I build publicly." Move on. |
| Narrating every log line during the demo | Let it scroll. Call out four or five moments. |

---

## Things that are currently FALSE — do not claim them

Verified against the codebase. Saying any of these would be a factual error:

- ❌ "It has automated tests." — **There are zero test files.**
- ❌ "I ran scripted evaluations." — **No eval harness exists.**
- ❌ "You can see `context.retrieved` on the timeline." — Defined in the enum, **never emitted**.
- ❌ "There's an `llm.first_token` event." — Also never emitted. *(TTFT **is** measured — as `metadata.ttftMs` on `llm.completed`. Say that instead.)*
- ❌ "It handles phone calls." — **Browser WebRTC only. No SIP, no PSTN.**
- ❌ "The whole thing runs in Docker." — Postgres and Redis do; the **full app stack build has never been verified**.
- ❌ "It uses semantic turn detection." — Plain VAD endpointing.
- ❌ "It does diarization." — Not configured.
- ❌ "The API is secured." — **No authentication anywhere.**
- ❌ "It measures end-to-end turn latency." — Each *stage* is measured; the aggregate is derived from timestamps, not emitted.

---

## When something breaks on camera

❌ Panic-debugging in silence, or cutting the recording.

✅ **"That's a bug — let me show you how I'd find it."** Then open the Activity Log and actually trace it.

Debugging your own system calmly, using observability you built, is one of the most FDE things you can
demonstrate. Two of your best stories (self-interruption, the silent extraction 400) are exactly that.

---

## Final gut-check before you upload

- [ ] Did I claim any test/eval that doesn't exist?
- [ ] Did I imply I know proprietary model internals?
- [ ] Did I say anything that sounds like a legal determination?
- [ ] Did I say anything that sounds like scorekeeping?
- [ ] Did I state gaps clearly at least once?
- [ ] Did I explain *why* for every major component, not just *what*?
