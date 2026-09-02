import {
  AgentName,
  CallPhase,
  REQUIRED_INTAKE_FIELDS,
  TurnState,
  type CallerContact,
  type IntakeFields,
  type QualificationStatus,
} from "@repo/shared";

const RECENT_USER_TURN_WINDOW = 6;

/**
 * Typed call state (CLAUDE.md §7 `CallState`) — a plain data object, not a
 * database service. CallOrchestrator owns mutating it; ContextService reads
 * it to build prompts; tools read/write it through the orchestrator.
 */
export class CallState {
  callId: string;
  roomName: string;
  callerId: string | null = null;
  matterId: string | null = null;
  currentPhase: CallPhase = CallPhase.GREETING;
  activeAgent: AgentName = AgentName.TRIAGE;
  turnState: TurnState = TurnState.LISTENING;

  callerContact: CallerContact = {};
  collectedFields: IntakeFields = {};
  qualificationStatus: QualificationStatus | null = null;

  conversationSummary: string | null = null;
  lastUserTurn: string | null = null;
  pendingAction: string | null = null;

  interruptionCount = 0;

  /**
   * Structured-extraction runs as a background LLM call after each user turn (see
   * IntakeAgent) rather than blocking the spoken reply — but qualification must not
   * evaluate against stale fields, so it awaits this before reading collectedFields.
   */
  pendingExtraction: Promise<void> | null = null;

  /**
   * Rolling window of recent caller utterances used as the extraction excerpt. Streaming
   * STT splits one spoken thought into several finals ("I had a car accident." / "On
   * 05/26/2026." / "In Mumbai."), so extracting from a single turn in isolation loses the
   * context that makes those fragments interpretable.
   */
  readonly recentUserTurns: string[] = [];

  pushRecentUserTurn(text: string): void {
    this.recentUserTurns.push(text);
    if (this.recentUserTurns.length > RECENT_USER_TURN_WINDOW) {
      this.recentUserTurns.shift();
    }
  }

  constructor(params: { callId: string; roomName: string }) {
    this.callId = params.callId;
    this.roomName = params.roomName;
  }

  /** Required fields not yet collected — drives IntakeAgent's next question and QualificationAgent's checks. */
  get missingRequiredFields(): string[] {
    return REQUIRED_INTAKE_FIELDS.filter((field) => {
      const value = this.collectedFields[field];
      if (Array.isArray(value)) return value.length === 0;
      return value === undefined || value === null || value === "";
    });
  }

  mergeIntakeFields(fields: Partial<IntakeFields>): string[] {
    const updated: string[] = [];
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      (this.collectedFields as Record<string, unknown>)[key] = value;
      updated.push(key);
    }
    return updated;
  }
}
