import type { CSSProperties } from "react";

export type OrbState = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";

/**
 * The animated "Siri-style" blob. Deliberately has zero LiveKit/data dependency —
 * it just renders whatever state + volume it's given, so it can be reused for the
 * pre-call idle state (no room yet) and the live in-call state (driven by real
 * mic/agent audio via AgentOrb) with the same visual language.
 *
 * Built from layered blurred radial gradients animating at different speeds/directions
 * (classic "liquid blob" technique) rather than a canvas/WebGL shader — cheap, and the
 * organic motion reads the same as the reference Siri orb at this size.
 */
export function VoiceOrb({ state, volume = 0 }: { state: OrbState; volume?: number }) {
  return (
    <div className={`orbWrap orb-${state}`} style={{ "--volume": volume } as CSSProperties}>
      <div className="orbGlow" />
      <div className="orbSphere">
        <div className="orbLayer l1" />
        <div className="orbLayer l2" />
        <div className="orbLayer l3" />
        <div className="orbShine" />
      </div>
    </div>
  );
}
