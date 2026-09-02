"use client";

import { useTrackVolume, useVoiceAssistant } from "@livekit/components-react";
import { VoiceOrb, type OrbState } from "./VoiceOrb";

const STATE_LABELS: Record<OrbState, string> = {
  idle: "Ready when you are",
  connecting: "Connecting…",
  listening: "Listening",
  thinking: "Thinking…",
  speaking: "Speaking",
  error: "Connection issue",
};

/** Must be rendered inside <LiveKitRoom> — reads the live agent state + its actual
 * audio amplitude so the orb's motion is driven by what's really happening, not a
 * canned animation loop. */
export function AgentOrb() {
  const { state: agentState, audioTrack } = useVoiceAssistant();
  const volume = useTrackVolume(audioTrack);

  const orbState = mapAgentState(agentState);

  return (
    <div className="orbColumn">
      <VoiceOrb state={orbState} volume={orbState === "speaking" ? volume : 0} />
      <p className="orbLabel">{STATE_LABELS[orbState]}</p>
    </div>
  );
}

function mapAgentState(state: string): OrbState {
  switch (state) {
    // LiveKit's "idle" means connected-and-ready-between-turns, not "no call yet" — that
    // pre-call state is handled separately in CallConsole with its own VoiceOrb. Both
    // read as "waiting on the caller" visually, so they share the listening look here.
    case "listening":
    case "idle":
    case "initializing":
      return "listening";
    case "thinking":
      return "thinking";
    case "speaking":
      return "speaking";
    case "failed":
      return "error";
    case "connecting":
    case "pre-connect-buffering":
    default:
      return "connecting";
  }
}
