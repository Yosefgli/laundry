"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  channelName,
  makeEnvelope,
  SessionEvent,
  type BroadcastEnvelope,
} from "@/lib/realtime/events";
import type { RealtimeChannel } from "@supabase/supabase-js";

type ConnectionState = "connecting" | "connected" | "reconnecting" | "degraded" | "error";

interface UseSessionChannelOptions {
  sessionId: string;
  onEvent?: (envelope: BroadcastEnvelope) => void;
  onStateChange?: (state: ConnectionState) => void;
}

export function useSessionChannel({
  sessionId,
  onEvent,
  onStateChange,
}: UseSessionChannelOptions) {
  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retriesRef = useRef(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");

  const updateState = useCallback(
    (s: ConnectionState) => {
      setConnectionState(s);
      onStateChange?.(s);
    },
    [onStateChange]
  );

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const subscribe = useCallback(() => {
    const ch = supabase.channel(channelName(sessionId), {
      config: { broadcast: { self: false } },
    });

    ch.on("broadcast", { event: "*" }, ({ event, payload }) => {
      onEvent?.({ type: event as SessionEvent, payload, timestamp: new Date().toISOString() });
    });

    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        retriesRef.current = 0;
        stopPolling();
        updateState("connected");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        const retries = ++retriesRef.current;
        if (retries >= 5) {
          updateState("error");
          return;
        }
        updateState("reconnecting");
        const backoff = Math.min(500 * 2 ** retries, 8000);
        setTimeout(subscribe, backoff);
      } else if (status === "CLOSED") {
        updateState("degraded");
        if (!pollIntervalRef.current) {
          pollIntervalRef.current = setInterval(() => {
            onEvent?.({
              type: SessionEvent.ORDER_STATUS_CHANGED,
              payload: { _poll: true },
              timestamp: new Date().toISOString(),
            });
          }, 3000);
        }
      }
    });

    channelRef.current = ch;
  }, [sessionId, onEvent, stopPolling, supabase, updateState]);

  useEffect(() => {
    subscribe();
    return () => {
      stopPolling();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [subscribe, stopPolling, supabase]);

  const publish = useCallback(
    <T>(type: SessionEvent, payload: T) => {
      channelRef.current?.send({
        type: "broadcast",
        event: type,
        payload: makeEnvelope(type, payload),
      });
    },
    []
  );

  return { publish, connectionState };
}
