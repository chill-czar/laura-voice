"use client";

import { useEffect, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";

/**
 * Browsers block audio playback that isn't tied to a recent user gesture. The click on
 * "Start Call" happens before the room connects, so by the time RoomAudioRenderer
 * attaches the agent's track the gesture has expired and playback is refused — the agent
 * is publishing audio (the server-side `first_audio` events still fire) but the caller
 * hears nothing at all.
 *
 * LiveKit reports that state via `room.canPlaybackAudio` + AudioPlaybackStatusChanged;
 * `room.startAudio()` must then be called from inside a real gesture handler. This shows
 * a button only when playback is actually blocked, so in the normal case it renders
 * nothing.
 */
export function AudioUnblocker() {
  const room = useRoomContext();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const sync = () => setBlocked(!room.canPlaybackAudio);
    sync();
    room.on(RoomEvent.AudioPlaybackStatusChanged, sync);
    return () => {
      room.off(RoomEvent.AudioPlaybackStatusChanged, sync);
    };
  }, [room]);

  if (!blocked) return null;

  return (
    <button className="audioUnblock" onClick={() => void room.startAudio()}>
      🔊 Tap to enable sound
    </button>
  );
}
