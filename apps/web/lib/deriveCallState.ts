import type { CallEventPayload } from "@repo/shared";

export interface DerivedCallState {
  phase: string;
  activeAgent: string | null;
  intakeFields: Record<string, unknown>;
  qualificationStatus: string | null;
  ended: boolean;
  finalSummary: string | null;
}

/**
 * Reconstructs the current call state purely from the CallEvent log — the
 * same events shown on the timeline. Nothing here is "extra" business logic;
 * it's just picking the latest values out of metadata the backend already
 * computed, so the intake panel and the timeline never disagree.
 */
export function deriveCallState(events: CallEventPayload[]): DerivedCallState {
  const state: DerivedCallState = {
    phase: "GREETING",
    activeAgent: null,
    intakeFields: {},
    qualificationStatus: null,
    ended: false,
    finalSummary: null,
  };

  for (const e of events) {
    if (e.phase) state.phase = e.phase;
    if (e.agent) state.activeAgent = e.agent;

    if (e.type === "intake.fields_extracted" && e.metadata?.values && typeof e.metadata.values === "object") {
      Object.assign(state.intakeFields, e.metadata.values as Record<string, unknown>);
    }
    if (e.type === "phase.changed" && typeof e.metadata?.qualificationStatus === "string") {
      state.qualificationStatus = e.metadata.qualificationStatus;
    }
    if (e.type === "call.ended") {
      state.ended = true;
      state.finalSummary = typeof e.metadata?.summary === "string" ? e.metadata.summary : null;
    }
  }

  return state;
}
