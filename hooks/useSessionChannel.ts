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
type ReadyWaiter = (channel: RealtimeChannel | null) => void;

const BROADCAST_TIMEOUT_MS = 1500;

interface UseSessionChannelOptions {
  sessionId: string;
  role?: "employee" | "customer";
  onEvent?: (envelope: BroadcastEnvelope) => void;
  onStateChange?: (state: ConnectionState) => void;
  onPresenceChange?: (hasEmployee: boolean) => void;
}

export function useSessionChannel({
  sessionId,
  role,
  onEvent,
  onStateChange,
  onPresenceChange,
}: UseSessionChannelOptions) {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) {
    supabaseRef.current = createClient();
  }
  const supabase = supabaseRef.current;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onEventRef = useRef(onEvent);
  const onStateChangeRef = useRef(onStateChange);
  const onPresenceChangeRef = useRef(onPresenceChange);
  const roleRef = useRef(role);
  const retriesRef = useRef(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectionStateRef = useRef<ConnectionState>("connecting");
  const readyWaitersRef = useRef<ReadyWaiter[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");

  useEffect(() => {
    onEventRef.current = onEvent;
    onStateChangeRef.current = onStateChange;
    onPresenceChangeRef.current = onPresenceChange;
  }, [onEvent, onStateChange, onPresenceChange]);

  const updateState = useCallback(
    (s: ConnectionState) => {
      connectionStateRef.current = s;
      setConnectionState(s);
      onStateChangeRef.current?.(s);
    },
    []
  );

  const resolveReadyWaiters = useCallback((channel: RealtimeChannel | null) => {
    const waiters = readyWaitersRef.current;
    readyWaitersRef.current = [];
    waiters.forEach((resolve) => resolve(channel));
  }, []);

  const waitForReadyChannel = useCallback(() => {
    const currentChannel = channelRef.current;
    if (currentChannel && connectionStateRef.current === "connected") {
      return Promise.resolve(currentChannel);
    }

    return new Promise<RealtimeChannel | null>((resolve) => {
      let timeout: ReturnType<typeof setTimeout>;
      const done: ReadyWaiter = (channel) => {
        clearTimeout(timeout);
        resolve(channel);
      };

      timeout = setTimeout(() => {
        readyWaitersRef.current = readyWaitersRef.current.filter((waiter) => waiter !== done);
        resolve(channelRef.current);
      }, BROADCAST_TIMEOUT_MS);

      readyWaitersRef.current.push(done);
    });
  }, []);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const subscribe = useCallback(() => {
    if (channelRef.current) {
      const previousChannel = channelRef.current;
      channelRef.current = null;
      void supabase.removeChannel(previousChannel);
    }

    if (retriesRef.current === 0) {
      updateState("connecting");
    }

    const ch = supabase.channel(channelName(sessionId), {
      config: { broadcast: { self: false, ack: true } },
    });

    ch.on("broadcast", { event: "*" }, ({ event, payload }) => {
      const envelope = payload as Partial<BroadcastEnvelope>;
      onEventRef.current?.(
        envelope.type === event
          ? (envelope as BroadcastEnvelope)
          : { type: event as SessionEvent, payload, timestamp: new Date().toISOString() }
      );
    });

    if (roleRef.current) {
      const firePresence = () => {
        const state = ch.presenceState<{ role?: string }>();
        const hasEmployee = Object.values(state).flat().some((p) => p.role === "employee");
        onPresenceChangeRef.current?.(hasEmployee);
      };
      ch.on("presence", { event: "sync" }, firePresence);
      ch.on("presence", { event: "join" }, firePresence);
      ch.on("presence", { event: "leave" }, firePresence);
    }

    channelRef.current = ch;

    ch.subscribe((status) => {
      if (channelRef.current !== ch) return;

      if (status === "SUBSCRIBED") {
        retriesRef.current = 0;
        stopPolling();
        updateState("connected");
        resolveReadyWaiters(ch);
        if (roleRef.current) {
          void ch.track({ role: roleRef.current });
        }
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        const retries = ++retriesRef.current;
        if (retries >= 5) {
          updateState("error");
          resolveReadyWaiters(null);
          return;
        }
        updateState("reconnecting");
        const backoff = Math.min(500 * 2 ** retries, 8000);
        setTimeout(subscribe, backoff);
      } else if (status === "CLOSED") {
        updateState("degraded");
        resolveReadyWaiters(null);
        if (!pollIntervalRef.current) {
          pollIntervalRef.current = setInterval(() => {
            onEventRef.current?.({
              type: SessionEvent.ORDER_STATUS_CHANGED,
              payload: { _poll: true },
              timestamp: new Date().toISOString(),
            });
          }, 3000);
        }
      }
    });

  }, [resolveReadyWaiters, sessionId, stopPolling, supabase, updateState]);

  useEffect(() => {
    subscribe();
    return () => {
      stopPolling();
      resolveReadyWaiters(null);
      if (channelRef.current) {
        const channel = channelRef.current;
        channelRef.current = null;
        void supabase.removeChannel(channel);
      }
    };
  }, [resolveReadyWaiters, subscribe, stopPolling, supabase]);

  const publish = useCallback(
    async <T>(type: SessionEvent, payload: T) => {
      const channel = await waitForReadyChannel();
      if (!channel) return false;

      const result = await channel
        .send({
          type: "broadcast",
          event: type,
          payload: makeEnvelope(type, payload),
        }, { timeout: BROADCAST_TIMEOUT_MS })
        .catch(() => "error" as const);

      return result === "ok";
    },
    [waitForReadyChannel]
  );

  return { publish, connectionState };
}
