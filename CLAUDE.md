from pathlib import Path

content = """# CLAUDE.md — Laura Voice Intake Orchestrator (V1)

## 0. Mission

Build a small but genuinely working end-to-end voice-AI intake system for a plaintiff law firm, inspired by the public product scope of Laura.

The goal is not to clone Laura's proprietary system. The goal is to demonstrate that the developer understands the abstraction layers underneath a voice-agent platform:

- realtime media
- voice pipeline
- turn detection / interruption
- orchestration
- agent handoffs
- context engineering
- tool calling
- structured data extraction
- persistence
- retrieval
- event logging
- observability
- evaluation

The demo must let a user open the React app, start a realtime voice session, speak as a new prospective client, and have the AI conduct an intake conversation. During and after the call, the system must persist structured intake data, transcript turns, orchestration events, tool calls, and a final case/intake summary. The frontend must show the call log and extracted case state.

This is a demo/portfolio system using synthetic data. It must NOT provide legal advice or make legal conclusions.

---

## 1. Product Context

Publicly available Laura material describes an AI system for plaintiff law firms that:

- conducts initial client screenings through voice
- gathers case details
- schedules follow-ups
- moves qualified leads into a new matter with information already filled in
- logs calls and updates case-management systems
- coordinates clients and appointments
- supports workflows around treatment and record retrieval

The V1 should demonstrate the intake/onboarding slice of that workflow.

Do not claim that this implementation reproduces Laura's internal architecture.

---

## 2. Core Demo

The demo scenario is:

> A prospective plaintiff calls a law firm. The AI receptionist/intake agent answers, understands why they are calling, collects the required intake information, asks sensible follow-up questions, qualifies the lead according to explicit demo rules, creates/updates a matter, schedules a follow-up when appropriate, and records everything.

Example:

1. Caller: "I was in a car accident yesterday and I hurt my back."
2. Agent identifies a potential motor-vehicle personal-injury intake.
3. Agent collects:
   - name
   - phone/email if needed
   - incident date
   - incident location
   - incident type
   - what happened
   - injuries
   - treatment/medical attention
   - whether emergency services/police were involved
   - insurance information when volunteered/appropriate
   - whether the caller already has an attorney
   - preferred follow-up time
4. Agent confirms important facts instead of silently assuming them.
5. Agent uses tools to persist structured information.
6. Agent can retrieve previously stored caller/matter information during the same call.
7. Agent can schedule a mock follow-up appointment.
8. Agent ends with a concise summary and next step.
9. Frontend shows the complete call timeline and structured intake result.

---

## 3. Non-Goals for V1

Do NOT build:

- a production telephony carrier/SIP server
- a custom VAD model
- a custom speech encoder
- a custom vocoder
- model training
- Kubernetes
- microservices everywhere
- a vector database unless retrieval actually requires it
- real law-firm integrations
- real client PII
- legal advice
- legal eligibility determinations presented as legal conclusions
- autonomous insurance/court/medical-portal actions
- browser agents
- record retrieval automation
- payment systems

Keep the architecture extensible, but keep the running V1 small.

---

## 4. Technical Direction

### Required stack

- TypeScript
- React
- Turborepo
- LiveKit Agents for Node.js
- PostgreSQL
- Prisma
- Redis
- OpenRouter
- Docker / Docker Compose
- class-based application architecture

### Realtime voice

Use LiveKit as the realtime media/voice abstraction.

Use the current LiveKit Agents 1.x APIs and `AgentSession`, not deprecated LiveKit 0.x `VoicePipelineAgent` APIs.

Preferred V1 pipeline:

    Browser microphone
        ↓
    LiveKit / WebRTC
        ↓
    VAD / turn detection
        ↓
    Streaming STT
        ↓
    Orchestrator / Agent
        ↓
    OpenRouter LLM
        ↓
    Streaming TTS
        ↓
    LiveKit / WebRTC
        ↓
    Browser speaker

LiveKit owns realtime media transport and low-level voice pipeline mechanics. Our code owns the business orchestration and data layer.

### Model routing

Use OpenRouter as the model gateway.

Use:

- `@openrouter/sdk` for explicit application-level LLM, structured extraction, classification, and evaluation calls.
- LiveKit's OpenAI-compatible LLM adapter pointed at OpenRouter when necessary for the realtime AgentSession LLM integration. Do not duplicate model logic.
- Keep model names in environment variables so models can be swapped without code changes.

The architecture must not be hard-coded around one model.

Suggested environment variables:

    OPENROUTER_API_KEY=
    OPENROUTER_MODEL=
    OPENROUTER_EXTRACTION_MODEL=
    LIVEKIT_URL=
    LIVEKIT_API_KEY=
    LIVEKIT_API_SECRET=
    DATABASE_URL=
    REDIS_URL=

For STT/TTS, choose providers that integrate cleanly with LiveKit's streaming pipeline. Do not use non-streaming OpenRouter STT as the primary realtime STT path if it introduces avoidable latency. OpenRouter can still be used for offline/post-call transcription or extraction if useful.

---

## 5. Monorepo

Keep the repository intentionally small.

Preferred structure:

    .
    ├── apps/
    │   ├── web/
    │   │   ├── src/
    │   │   ├── Dockerfile
    │   │   └── package.json
    │   │
    │   ├── api/
    │   │   ├── src/
    │   │   ├── Dockerfile
    │   │   └── package.json
    │   │
    │   └── agent/
    │       ├── src/
    │       ├── Dockerfile
    │       └── package.json
    │
    ├── packages/
    │   ├── db/
    │   │   ├── prisma/
    │   │   ├── src/
    │   │   └── package.json
    │   │
    │   └── shared/
    │       ├── src/
    │       └── package.json
    │
    ├── docker-compose.yml
    ├── turbo.json
    ├── pnpm-workspace.yaml
    ├── package.json
    ├── tsconfig.json
    ├── .env.example
    ├── .gitignore
    └── CLAUDE.md

Do not create dozens of packages.

---

## 6. Application Responsibilities

### apps/web

React frontend.

Responsibilities:

- connect to LiveKit room
- microphone permission
- start/end call
- show agent speaking/listening state
- show live transcript
- show current intake fields
- show call events
- show final case summary
- show previous call logs
- allow opening a call and inspecting its transcript/events

Do not put business logic in React.

Use a small API client and local UI state.

### apps/api

HTTP API.

Responsibilities:

- create LiveKit access token for demo room
- return call logs
- return call details
- return current matter/intake
- expose simple health endpoint
- optionally expose seed/reset endpoint for demo data
- receive/persist agent events if the agent does not directly write to DB
- serve structured read models to frontend

Example endpoints:

    GET  /health
    POST /api/calls/session
    GET  /api/calls
    GET  /api/calls/:id
    GET  /api/matters/:id
    GET  /api/calls/:id/events

Do not expose database credentials to the browser.

### apps/agent

LiveKit Agent server.

Responsibilities:

- join LiveKit room
- manage AgentSession
- run realtime voice pipeline
- maintain call state
- route between agents
- call business tools
- persist transcript/events
- hand off between specialized agents
- emit structured observability events

This is the main orchestration application.

---

## 7. Class-Based Architecture

Keep classes simple and purposeful.

Required classes:

### `CallOrchestrator`

Owns the high-level workflow.

Responsibilities:

- start/end call
- maintain phase
- choose active agent
- build context
- invoke tools
- handle handoffs
- persist state changes
- emit events

Example phases:

    GREETING
    TRIAGE
    INTAKE
    QUALIFICATION
    SCHEDULING
    CONFIRMATION
    COMPLETED
    HANDOFF_HUMAN

The orchestrator is the business control plane.

### `CallState`

A typed state object, not a database service.

Contains:

- callId
- callerId
- matterId
- currentPhase
- activeAgent
- collectedFields
- missingRequiredFields
- conversation summary
- lastUserTurn
- pendingAction
- interruption state

### `ContextService`

Responsible for deciding what context reaches the LLM.

It must:

- load caller/matter information
- select relevant intake fields
- include prior conversation summary
- include current missing fields
- include tool results
- avoid sending the entire database blindly

This is a key demonstration of context engineering.

### `IntakeAgent`

Handles initial intake.

Goal:

- understand the caller's reason for calling
- collect facts conversationally
- never invent missing information
- ask one useful question at a time
- confirm critical facts

### `QualificationAgent`

Handles demo qualification rules.

Rules must be explicit and deterministic where possible.

The LLM can extract facts, but business rules decide qualification.

Example:

    has_injury
    incident_type_supported
    incident_date_known
    representedByAttorney != true

Do not ask the LLM to invent legal eligibility rules.

### `SchedulingAgent`

Handles:

- preferred callback time
- mock calendar availability
- appointment creation
- confirmation

### `ToolRegistry`

Central place to expose tools to agents.

Tools should have typed inputs/outputs.

### `CaseService`

Handles caller/matter persistence.

### `AppointmentService`

Handles appointment lookup/creation.

### `CallLogService`

Handles calls, transcript turns, and events.

### `EventService`

Writes structured orchestration events to Redis and/or PostgreSQL.

### `OpenRouterService`

Thin wrapper around `@openrouter/sdk`.

Responsibilities:

- structured extraction
- classification
- summarization
- evaluation
- optional non-realtime model calls

Do not let arbitrary application code instantiate OpenRouter clients everywhere.

---

## 8. Agents and Handoffs

Use a small multi-agent workflow.

    Receptionist / Triage
            │
            ├── general question → answer/end
            │
            └── potential case
                    ↓
                 Intake
                    │
                    ↓
              Qualification
                    │
              ┌─────┴─────┐
              │           │
           qualified    insufficient
              │           │
              ▼           ▼
         Scheduling    Intake
              │
              ▼
          Confirmation
              │
              ▼
             END

The agents should share the typed call state.

Preserve conversation context during handoff.

Do not create an agent for every tiny operation. Agents exist only where instructions, permissions, or reasoning behavior materially differ.

---

## 9. Tools

V1 should include these tools.

### `get_caller`

Input:

    phone or caller identifier

Output:

    caller record or null

### `create_caller`

Input:

    name
    phone
    email?

Output:

    callerId

### `create_matter`

Input:

    callerId
    matterType

Output:

    matterId

### `update_matter_intake`

Input:

    matterId
    structured intake fields

Output:

    updated matter summary

### `get_matter`

Input:

    matterId

Output:

    current structured case state

### `check_appointment_availability`

Input:

    preferred date/time window

Output:

    available mock slots

### `schedule_follow_up`

Input:

    matterId
    slot

Output:

    appointment confirmation

### `add_call_note`

Input:

    callId
    note

Output:

    saved note

### `end_call`

Input:

    reason

Output:

    call completion state

Tool calls must be logged.

Tool inputs and outputs must be validated.

Tool execution must be idempotent where possible.

---

## 10. Intake Data Model

V1 should collect structured information relevant to a plaintiff intake without pretending to provide legal advice.

### Caller

    id
    name
    phone
    email
    preferredLanguage

### Matter

    id
    callerId
    status
    incidentType
    incidentDate
    incidentLocation
    incidentDescription
    injuries
    treatmentReceived
    emergencyServicesInvolved
    policeReport
    insuranceInformation
    otherPartyInformation
    witnesses
    lostWages
    representedByAttorney
    notes
    qualificationStatus

### Appointment

    id
    matterId
    scheduledAt
    type
    status

### Call

    id
    callerId
    matterId
    roomName
    startedAt
    endedAt
    status
    finalSummary

### TranscriptTurn

    id
    callId
    speaker
    text
    timestamp

### CallEvent

    id
    callId
    type
    agent
    phase
    metadata
    timestamp
    durationMs

Event types can include:

    call.started
    agent.entered
    user.speech.started
    user.transcript.partial
    user.transcript.final
    context.retrieved
    llm.started
    llm.completed
    tool.started
    tool.completed
    tool.failed
    agent.handoff
    interruption.detected
    speech.cancelled
    tts.started
    first_audio
    call.ended
    error

---

## 11. Database

Use PostgreSQL + Prisma.

Keep the schema small and normalized enough to demonstrate good engineering.

Do not create a huge legal CRM schema.

Every call must be traceable:

    Call
      ↓
    Caller
      ↓
    Matter
      ↓
    Appointment

And:

    Call
      ├── TranscriptTurn[]
      └── CallEvent[]

Use Prisma migrations.

Seed synthetic example data.

No real PII.

---

## 12. Redis

Use Redis for ephemeral/session-oriented state and event streaming.

V1 uses Redis for:

- active call state
- recent conversation state if useful
- event stream
- optional pub/sub for frontend updates

Suggested stream:

    call-events

Event payload:

    {
      callId,
      eventType,
      timestamp,
      phase,
      agent,
      payload
    }

PostgreSQL remains the source of truth for durable records.

Redis is not the permanent database.

---

## 13. RAG / Retrieval

Do not add a vector database by default.

V1 retrieval should demonstrate two types of context:

### Structured retrieval

Retrieve:

- existing caller
- existing matter
- previous appointment
- previously collected intake fields

### Knowledge retrieval

If a knowledge base is needed, start with a small local set of Markdown/JSON documents containing:

- firm intake policy
- supported case categories
- office hours
- escalation rules
- appointment rules
- communication policy

Use simple keyword/metadata retrieval first.

Only introduce embeddings/vector DB if the simple retrieval is insufficient.

The important demo is:

    user turn
      ↓
    intent
      ↓
    context retrieval
      ↓
    context assembly
      ↓
    LLM

Not "we use Pinecone".

---

## 14. Context Engineering

The LLM must not receive an uncontrolled giant prompt.

Build context from:

1. agent instructions
2. current phase
3. caller summary
4. matter fields
5. missing required fields
6. recent conversation turns
7. relevant retrieved policy
8. available tools

Example conceptual prompt:

    SYSTEM
    You are the plaintiff-firm intake assistant...

    CURRENT PHASE
    INTAKE

    KNOWN CALLER
    ...

    KNOWN MATTER
    ...

    REQUIRED MISSING FIELDS
    ...

    RELEVANT POLICY
    ...

    RECENT CONVERSATION
    ...

    TOOLS
    ...

Rules:

- never invent facts
- never give legal advice
- never claim attorney-client privilege
- never guarantee representation
- do not state that a case is legally valid
- ask for clarification when uncertain
- confirm critical extracted information
- minimize unnecessary collection of sensitive information
- hand off when outside scope

---

## 15. Structured Extraction

Do not rely on free-form LLM text to update the database.

Use structured output.

Example:

    {
      "incidentType": "motor_vehicle_accident",
      "incidentDate": "2026-08-12",
      "injuries": ["back pain"],
      "policeReport": true,
      "representedByAttorney": false
    }

Validate the result before persistence.

The database should only be updated through typed services/tools.

The voice agent should not directly write arbitrary JSON into PostgreSQL.

---

## 16. Voice Pipeline

Use a cascaded STT → LLM → TTS pipeline for V1.

Reason:

- easiest to understand
- explicit transcript
- easier debugging
- easy model swapping
- mature tool calling
- strong auditability

Do NOT implement a custom speech encoder or vocoder.

Those are model-internals topics, not required for this portfolio V1.

Keep the architecture swappable so a speech-to-speech model could be added later.

---

## 17. Interruptions

Interruption is a first-class realtime behavior.

Example:

    Agent:
    "Your follow-up is scheduled for Thurs—"

    User:
    "Wait, Friday instead."

The system should:

1. detect user speech
2. stop/cancel agent speech
3. cancel or invalidate the stale response
4. process the new user turn
5. update state
6. continue naturally

Do not model this as only:

    interruption: boolean

Use an explicit call/turn state.

Example:

    LISTENING
    THINKING
    SPEAKING
    INTERRUPTED
    TOOL_EXECUTING
    ENDED

Log interruption events.

---

## 18. Latency Observability

Measure actual latency. Do not invent numbers.

Track at minimum:

- user speech end → final STT
- final STT → LLM first token
- LLM first token → TTS first audio
- total user-turn → first agent audio
- tool execution latency
- database latency
- retrieval latency

Example event chain:

    user.transcript.final
          ↓
    llm.started
          ↓
    llm.first_token
          ↓
    tts.started
          ↓
    first_audio

Frontend should display these metrics for a call.

---

## 19. Frontend

The frontend is a simple demo console, not a full CRM.

Main screen:

    ┌─────────────────────────────────────────┐
    │ Laura Voice Intake Demo                │
    │                                         │
    │ [ Start Call ] [ End Call ]             │
    │                                         │
    │ Agent: LISTENING / SPEAKING             │
    │                                         │
    │ Live Transcript                         │
    │ ─────────────────────────────────────   │
    │ Caller: ...                             │
    │ Agent: ...                              │
    │                                         │
    │ Intake State                             │
    │ Name: ...                               │
    │ Incident: ...                           │
    │ Injury: ...                             │
    │ Date: ...                               │
    │ Location: ...                           │
    │ Qualification: ...                      │
    │                                         │
    │ Timeline                                │
    │ 12:31 transcript.final                  │
    │ 12:32 context.retrieved                 │
    │ 12:32 tool.completed                    │
    │                                         │
    └─────────────────────────────────────────┘

Second view:

    Calls
      ↓
    Call detail
      ├── summary
      ├── transcript
      ├── intake data
      ├── tools
      ├── agent handoffs
      ├── latency
      └── errors

---

## 20. API Design

Keep API endpoints boring.

Example:

    POST /api/calls/session
    GET  /api/calls
    GET  /api/calls/:id
    GET  /api/calls/:id/events
    GET  /api/matters/:id

The frontend must never connect directly to PostgreSQL or Redis.

---

## 21. Docker

Provide:

### `apps/web/Dockerfile`

Production-ish React build:

    install
    build
    serve

### `apps/api/Dockerfile`

Build TypeScript and run Node server.

### `apps/agent/Dockerfile`

Build TypeScript and run LiveKit agent server.

### `docker-compose.yml`

Local infrastructure:

    postgres
    redis
    api
    agent
    web

LiveKit should use LiveKit Cloud for V1 unless a local LiveKit server is genuinely needed.

Do not add a self-hosted LiveKit server unless required.

`.env` is supplied locally and never committed.

Provide `.env.example`.

---

## 22. Development Commands

Root commands should be approximately:

    pnpm dev
    pnpm build
    pnpm lint
    pnpm typecheck
    pnpm test

Useful app-specific commands:

    pnpm --filter web dev
    pnpm --filter api dev
    pnpm --filter agent dev

Database:

    pnpm db:migrate
    pnpm db:seed

Docker:

    docker compose up --build

---

## 23. Testing

V1 must have tests for business-critical behavior.

### Unit tests

Test:

- intake field extraction validation
- qualification rules
- state transitions
- context construction
- appointment rules
- tool input validation

### Integration tests

Test:

    transcript
      ↓
    orchestrator
      ↓
    tool
      ↓
    database

At minimum:

1. new caller creates caller + matter
2. existing caller retrieves existing matter
3. intake fields persist
4. qualification updates
5. appointment is created
6. call events are persisted

### Voice/evaluation tests

Create 20–30 scripted conversations.

Examples:

- simple car accident
- caller unsure of date
- existing attorney
- no injury
- caller interrupts agent
- caller changes appointment preference
- caller gives information out of order
- existing caller with previous matter
- missing required information
- irrelevant question
- angry/frustrated caller
- multilingual request if supported

Measure:

- required-field recall
- incorrect field extraction
- tool-call accuracy
- hallucination count
- inappropriate legal claims
- successful completion rate
- interruption recovery
- appointment correctness

Do not optimize for "sounds cool".

Optimize for correctness.

---

## 24. Demo Script

The final demo should take 3–5 minutes.

### Scenario

Caller:

> "Hi, I was in a car accident yesterday and I think I hurt my back."

Agent should:

1. greet
2. explain it is an intake assistant
3. collect name
4. collect incident date
5. collect location
6. understand accident description
7. ask about injuries/treatment
8. ask about police/emergency involvement
9. ask whether represented by another attorney
10. collect contact information
11. qualify using explicit demo rules
12. create/update matter
13. retrieve the stored matter
14. offer follow-up appointment
15. schedule a mock slot
16. confirm
17. summarize
18. end call

During the demo, intentionally interrupt the agent once.

Show that it stops speaking and responds to the new request.

Then show the frontend call log.

---

## 25. Demo Data

Seed synthetic records such as:

Caller:

    Sarah Miller
    +1-555-0100

Existing matter:

    motor vehicle accident
    status: INTAKE

Appointment:

    future mock appointment

Use obviously fake data.

Never use real people's legal/medical information.

---

## 26. Security / Privacy

This is a portfolio demo.

Requirements:

- never commit API keys
- never log secrets
- never use real client PII
- redact sensitive fields in application logs
- do not store raw audio by default
- store transcript only for synthetic demo calls
- validate all tool inputs
- never expose internal service credentials to React
- use environment variables
- clearly label the system as a demo

Do not claim HIPAA, SOC 2, attorney-client privilege, or production compliance.

---

## 27. Error Handling

Every external boundary must have:

- timeout
- retry where safe
- structured error
- event log
- user-friendly fallback

Boundaries include:

- LiveKit
- STT
- LLM
- TTS
- Redis
- PostgreSQL
- calendar service

Never retry non-idempotent actions blindly.

For example, appointment creation must have an idempotency key:

    callId + appointmentRequestId

---

## 28. State Machine

Use explicit transitions.

Example:

    GREETING
       ↓
    TRIAGE
       ↓
    INTAKE
       ↓
    QUALIFICATION
       ↓
    SCHEDULING
       ↓
    CONFIRMATION
       ↓
    COMPLETED

Possible alternate paths:

    INTAKE → HANDOFF_HUMAN
    INTAKE → COMPLETED
    SCHEDULING → INTAKE
    ANY_STATE → ERROR_RECOVERY

Do not let the LLM arbitrarily mutate the phase.

The LLM proposes actions; the orchestrator validates whether the transition is allowed.

---

## 29. Source of Truth

Use this rule:

    LLM = reasoning / extraction / language

    Orchestrator = control flow

    Tools = actions

    PostgreSQL = durable business state

    Redis = ephemeral state/events

    LiveKit = realtime media/session transport

    React = presentation

Never let the LLM become the source of truth.

---

## 30. Architecture Principle

The system should be explainable in an interview:

> "LiveKit handles realtime media and the voice pipeline. My orchestrator owns the business state machine. Agents are specialized reasoning policies. Tools are the only way the model mutates business state. PostgreSQL is the durable source of truth, Redis handles ephemeral state/events, and OpenRouter provides model routing. The frontend is a thin observability/demo layer."

This sentence should remain true after implementation.

---

## 31. What To Show Biswa

The final repository should contain:

1. architecture diagram
2. working browser voice call
3. realtime transcript
4. explicit state machine
5. agent handoffs
6. structured intake extraction
7. database persistence
8. retrieval of existing matter
9. tool calls
10. appointment scheduling
11. interruption handling
12. Redis event stream
13. call timeline
14. latency metrics
15. evaluation results
16. Docker setup
17. short README demo instructions

The most important artifact is not the UI.

It is the architecture + trace proving that the system works end to end.

---

## 32. Implementation Order

Do not build everything at once.

### Step 1 — Monorepo

Create:

    apps/web
    apps/api
    apps/agent
    packages/db
    packages/shared

Make TypeScript/builds work.

### Step 2 — Database

Create Prisma schema.

Run migrations.

Seed synthetic caller/matter.

### Step 3 — API

Implement health + calls + matters endpoints.

### Step 4 — LiveKit

Create the simplest browser voice agent.

Verify:

    browser → LiveKit → agent → speech

### Step 5 — OpenRouter

Connect the LLM through OpenRouter.

Keep model configurable.

### Step 6 — Orchestrator

Implement:

    CallState
    CallOrchestrator
    phase transitions

### Step 7 — Intake

Implement IntakeAgent and structured field collection.

### Step 8 — Tools

Implement caller/matter/appointment tools.

### Step 9 — Persistence

Persist transcript + events + structured intake.

### Step 10 — Retrieval

Retrieve existing caller/matter context.

### Step 11 — Handoffs

Add QualificationAgent and SchedulingAgent.

### Step 12 — Interruptions

Test and log interruption/cancellation.

### Step 13 — Frontend

Show transcript, state, intake data, events, and calls.

### Step 14 — Observability

Add latency metrics and structured event logs.

### Step 15 — Evals

Run scripted conversations.

Fix failures.

### Step 16 — Docker

Make the whole V1 run with Docker Compose.

### Step 17 — Polish

Architecture diagram + README + demo recording.

---

## 33. Coding Rules

- TypeScript strict mode.
- Prefer classes for domain/application services.
- Keep functions small.
- Use Zod for external input validation.
- No `any` unless unavoidable and documented.
- No direct DB calls from agents.
- No direct Redis calls from React.
- No model calls scattered throughout the codebase.
- No business logic inside UI components.
- No hidden global mutable state.
- Use dependency injection through constructors where practical.
- Use interfaces around external services where swapping providers is likely.
- Prefer composition over inheritance.
- Keep domain classes framework-light.
- Comments should explain WHY, not WHAT.
- Do not over-engineer.

---

## 34. Important Engineering Judgment

When choosing between:

    "add another AI agent"

and:

    "add deterministic code"

prefer deterministic code for:

- validation
- state transitions
- qualification rules
- persistence
- permissions
- idempotency
- appointment creation
- required fields

Use LLMs for:

- understanding natural language
- extracting structured facts
- conversational phrasing
- deciding which allowed tool/agent is relevant
- summarization

The architecture should demonstrate that the LLM is powerful but not trusted with everything.

---

## 35. Definition of Done

V1 is complete only when:

- [ ] `docker compose up --build` starts local infrastructure/services
- [ ] frontend loads
- [ ] user can start a LiveKit voice session
- [ ] agent hears user
- [ ] agent responds with speech
- [ ] transcript appears
- [ ] intake fields are extracted
- [ ] fields persist to PostgreSQL
- [ ] existing caller/matter can be retrieved
- [ ] tools are visibly invoked
- [ ] qualification state is updated
- [ ] appointment can be scheduled
- [ ] agent can hand off between intake/qualification/scheduling behavior
- [ ] interruption works
- [ ] call events are persisted
- [ ] call history appears in frontend
- [ ] latency is measured
- [ ] scripted evaluations run
- [ ] no real PII is used
- [ ] README explains architecture and tradeoffs
- [ ] architecture diagram exists
- [ ] no secrets are committed

---

## 36. Final Quality Bar

Before calling the project finished, ask:

### Realtime

Can I actually have a natural conversation?

### Orchestration

Can I explain exactly why the next agent/tool/phase was selected?

### State

Can I reconstruct the call from persisted state and events?

### Context

Can I explain exactly what context was sent to the model and why?

### Data

If the caller gives information in a different order, does the correct database field still get updated?

### Reliability

What happens if the model fails?

What happens if the database fails?

What happens if the user interrupts?

What happens if the appointment tool is called twice?

### Evaluation

How do I know the system is correct?

### Interview

Can I whiteboard the entire system from:

    microphone
      ↓
    realtime transport
      ↓
    VAD / turn detection
      ↓
    STT
      ↓
    orchestrator
      ↓
    context
      ↓
    LLM
      ↓
    tools / agents
      ↓
    TTS
      ↓
    user

and explain the tradeoffs at every boundary?

If yes, the V1 has achieved its purpose.
"""

path = Path("/mnt/data/CLAUDE.md")
path.write_text(content, encoding="utf-8")
print(f"Created {path} ({len(content.splitlines())} lines)")
