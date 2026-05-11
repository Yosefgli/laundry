"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  customerDeviceChannelName,
  makeEnvelope,
  SessionEvent,
  type SessionStartedPayload,
} from "@/lib/realtime/events";

const schema = z.object({
  weightKg: z.number({ invalid_type_error: "Enter a number" }).positive().max(999),
});

type FormData = z.infer<typeof schema>;

interface NewOrderFormProps {
  translations: Record<string, string>;
  workstationId?: string;
  employeeDeviceId: string;
  onCreated: (orderId: string, sessionId: string) => void;
}

export function NewOrderForm({
  translations: t,
  workstationId,
  employeeDeviceId,
  onCreated,
}: NewOrderFormProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function publishSessionStarted(payload: SessionStartedPayload) {
    if (!payload.customerDeviceId) return;

    const channel = supabase.channel(customerDeviceChannelName(payload.customerDeviceId));
    let completed = false;

    await new Promise<void>((resolve) => {
      const done = () => {
        if (completed) return;
        completed = true;
        resolve();
      };
      const timeout = window.setTimeout(done, 1200);

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          window.clearTimeout(timeout);
          await channel.send({
            type: "broadcast",
            event: SessionEvent.SESSION_STARTED,
            payload: makeEnvelope(SessionEvent.SESSION_STARTED, payload),
          });
          done();
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          window.clearTimeout(timeout);
          done();
        }
      });
    });

    await supabase.removeChannel(channel);
  }

  async function onSubmit(data: FormData) {
    setLoading(true);
    setError(null);
    try {
      const idempotencyKey = `new-order-${Date.now()}`;

      // 1. Create order
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify({ workstationId }),
      });
      const orderJson = await orderRes.json();
      if (!orderJson.data) throw new Error(orderJson.error ?? t["common.error"]);

      const orderId: string = orderJson.data.id;

      // 2. Store weight and advance to 'weighed'
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_weight", weightKg: data.weightKg }),
      });

      // 4. Create session
      const sessionRes = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, employeeDeviceId, workstationId }),
      });
      const sessionJson = await sessionRes.json();
      if (!sessionJson.data) throw new Error(sessionJson.error ?? t["common.error"]);

      void publishSessionStarted({
        sessionId: sessionJson.data.id,
        orderId,
        customerDeviceId: sessionJson.data.customer_device_id ?? undefined,
        workflowStep: sessionJson.data.workflow_step ?? "customer_info",
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
