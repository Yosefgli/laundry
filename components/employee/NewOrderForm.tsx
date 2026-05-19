"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import {
  customerDeviceChannelName,
  makeEnvelope,
  SessionEvent,
  type SessionStartedPayload,
} from "@/lib/realtime/events";
import type { RealtimeChannel } from "@supabase/supabase-js";

const schema = z.object({
  weightKg: z.number({ invalid_type_error: "Enter a number" }).positive().max(999),
});

const HANDOFF_BROADCAST_TIMEOUT_MS = 1500;

type FormData = z.infer<typeof schema>;

interface NewOrderFormProps {
  translations: Record<string, string>;
  workstationId?: string;
  employeeDeviceId: string;
  customerDeviceId: string;
  onCreated: (orderId: string, sessionId: string) => void;
}

export function NewOrderForm({
  translations: t,
  workstationId,
  employeeDeviceId,
  customerDeviceId,
  onCreated,
}: NewOrderFormProps) {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) {
    supabaseRef.current = createClient();
  }
  const supabase = supabaseRef.current;
  const handoffChannelRef = useRef<RealtimeChannel | null>(null);
  const handoffReadyRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    const channel = supabase.channel(customerDeviceChannelName(customerDeviceId), {
      config: { broadcast: { self: false, ack: true } },
    });

    handoffChannelRef.current = channel;
    handoffReadyRef.current = false;

    channel.subscribe((status) => {
      handoffReadyRef.current = status === "SUBSCRIBED";
    });

    return () => {
      handoffReadyRef.current = false;
      if (handoffChannelRef.current === channel) {
        handoffChannelRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [customerDeviceId, supabase]);

  async function sendSessionStarted(channel: RealtimeChannel, payload: SessionStartedPayload) {
    const result = await channel
      .send({
        type: "broadcast",
        event: SessionEvent.SESSION_STARTED,
        payload: makeEnvelope(SessionEvent.SESSION_STARTED, payload),
      }, { timeout: HANDOFF_BROADCAST_TIMEOUT_MS })
      .catch(() => "error" as const);

    return result === "ok";
  }

  async function publishSessionStarted(payload: SessionStartedPayload) {
    if (!payload.customerDeviceId) return false;

    if (handoffReadyRef.current && handoffChannelRef.current) {
      const delivered = await sendSessionStarted(handoffChannelRef.current, payload);
      if (delivered) return true;
    }

    const channel = supabase.channel(customerDeviceChannelName(payload.customerDeviceId), {
      config: { broadcast: { self: false, ack: true } },
    });

    const envelope = makeEnvelope(SessionEvent.SESSION_STARTED, payload);
    const result = await channel
      .httpSend(SessionEvent.SESSION_STARTED, envelope, { timeout: HANDOFF_BROADCAST_TIMEOUT_MS })
      .catch(() => ({ success: false as const, status: 0, error: "handoff failed" }));

    await supabase.removeChannel(channel);
    return result.success;
  }

  async function onSubmit(data: FormData) {
    setLoading(true);
    setError(null);
    try {
      const orderId = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const customerSessionDeviceId = customerDeviceId;

      const initialHandoff = publishSessionStarted({
        sessionId,
        orderId,
        customerDeviceId: customerSessionDeviceId,
        workflowStep: "customer_info",
        totalWeightKg: data.weightKg,
        isReady: false,
      }).catch(() => false);

      const sessionRes = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          orderId,
          weightKg: data.weightKg,
          employeeDeviceId,
          workstationId,
        }),
      });
      const sessionJson = await sessionRes.json();
      if (!sessionJson.data) throw new Error(sessionJson.error ?? t["common.error"]);

      const order = sessionJson.data.order;

      void initialHandoff;
      await publishSessionStarted({
        sessionId: sessionJson.data.id,
        orderId,
        customerDeviceId: sessionJson.data.customer_device_id ?? customerDeviceId,
        workflowStep: sessionJson.data.workflow_step ?? "customer_info",
        orderNumber: order?.order_number,
        totalWeightKg: Number(order?.total_weight_kg ?? data.weightKg),
        isReady: true,
      });

      onCreated(orderId, sessionJson.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t["common.error"]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label={t["employee.weight_kg"]}
        type="number"
        step="0.001"
        min="0.1"
        max="999"
        error={errors.weightKg?.message}
        {...register("weightKg", { valueAsNumber: true })}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" size="xl" loading={loading} className="w-full">
        {t["employee.transfer_customer"]}
      </Button>
    </form>
  );
}
