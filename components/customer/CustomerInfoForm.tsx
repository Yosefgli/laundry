"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CustomerInfoSchema, type CustomerInfoInput } from "@/lib/schemas/order";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useState } from "react";

interface CustomerInfoFormProps {
  orderId: string;
  translations: Record<string, string>;
  onSubmitted: (info: CustomerInfoInput) => void;
}

export function CustomerInfoForm({ orderId, translations: t, onSubmitted }: CustomerInfoFormProps) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerInfoInput>({ resolver: zodResolver(CustomerInfoSchema) });

  async function onSubmit(data: CustomerInfoInput) {
    setLoading(true);
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_customer_info", ...data }),
      });
      onSubmitted(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Input
        label={t["customer.your_name"]}
        placeholder={t["customer.your_name"]}
        error={errors.name?.message}
        {...register("name")}
      />
      <Input
        label={t["customer.phone"]}
        type="tel"
        placeholder={t["customer.phone"]}
        error={errors.phone?.message}
        {...register("phone")}
      />
      <Input
        label={t["customer.notes"]}
        placeholder={t["customer.notes"]}
        error={errors.notes?.message}
        {...register("notes")}
      />
      <Button type="submit" size="xl" loading={loading} className="w-full">
        {t["common.confirm"]}
      </Button>
    </form>
  );
}
