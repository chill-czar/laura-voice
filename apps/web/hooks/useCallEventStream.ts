"use client";

import { useEffect, useRef, useState } from "react";
import type { CallEventPayload } from "@repo/shared";
import { apiClient } from "@/lib/api-client";

/**
 * Live event timeline for one call — Redis pub/sub -> apps/api SSE -> here.
 * This is what makes the intake/timeline panels update as the call happens,
 * instead of polling (CLAUDE.md §12/§19).
 */
export function useCallEventStream(callId: string | null) {
  const [events, setEvents] = useState<CallEventPayload[]>([]);
  const [connected, setConnected] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!callId) {
      setEvents([]);
      return;
    }
    setEvents([]);
    seenIds.current = new Set();

    const source = new EventSource(apiClient.eventStreamUrl(callId));

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.addEventListener("call-event", (raw) => {
      try {
        const event = JSON.parse((raw as MessageEvent).data) as CallEventPayload;
        const key = event.id ?? `${event.type}-${event.timestamp}-${Math.random()}`;
        if (seenIds.current.has(key)) return;
        seenIds.current.add(key);
        setEvents((prev) => [...prev, event]);
      } catch {
        // ignore malformed frames
      }
    });

    return () => {
      source.close();
      setConnected(false);
    };
  }, [callId]);

  return { events, connected };
}
