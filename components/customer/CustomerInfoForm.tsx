"use client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getCountries, getCountryCallingCode } from "libphonenumber-js/min";
import type { CountryCode } from "libphonenumber-js/min";
import type { CustomerInfoInput } from "@/lib/schemas/order";
import { DEFAULT_PHONE_COUNTRY } from "@/lib/phoneCountryCodes";
import { CountryPicker } from "@/components/ui/CountryPicker";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";

const CUSTOMER_INFO_RETRY_ATTEMPTS = 25;
const CUSTOMER_INFO_RETRY_MS = 150;

const VALID_COUNTRIES = new Set<string>(getCountries());

const CustomerInfoFormSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  selectedCountry: z.string().refine((c) => VALID_COUNTRIES.has(c), { message: "Invalid country" }),
  phoneNumber: z.string().min(4).max(20).regex(/^[\d\s-]+$/),
  notes: z.string().max(500).optional(),
});

type CustomerInfoFormInput = z.infer<typeof CustomerInfoFormSchema>;

interface CustomerInfoFormProps {
  orderId: string;
  translations: Record<string, string>;
  locale: Locale;
  onSubmitted: (info: CustomerInfoInput) => void | Promise<void>;
  disabled?: boolean;
}

export function CustomerInfoForm({
  orderId,
  translations: t,
  locale,
  onSubmitted,
  disabled = false,
}: CustomerInfoFormProps) {
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<CustomerInfoFormInput>({
    resolver: zodResolver(CustomerInfoFormSchema),
    defaultValues: { selectedCountry: DEFAULT_PHONE_COUNTRY },
  });

  function wait(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function submitCustomerInfo(customerInfo: CustomerInfoInput): Promise<"ok" | "not_ready" | "failed"> {
    for (let attempt = 1; attempt <= CUSTOMER_INFO_RETRY_ATTEMPTS; attempt += 1) {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_customer_info", ...customerInfo }),
      });

      if (res.ok) return "ok";
      if (res.status !== 404 && res.status !== 409 && res.status !== 500) return "failed";
      if (attempt < CUSTOMER_INFO_RETRY_ATTEMPTS) await wait(CUSTOMER_INFO_RETRY_MS);
    }

    return "not_ready";
  }

  async function onSubmit(data: CustomerInfoFormInput) {
    if (disabled) return;

    setLoading(true);
    setSubmitError(null);
    try {
      const localNumber = data.phoneNumber.replace(/\D/g, "").replace(/^0+/, "");
      if (localNumber.length < 4) {
        setError("phoneNumber", { type: "manual", message: t["customer.phone_invalid"] });
        return;
      }

      const dialCode = `+${getCountryCallingCode(data.selectedCountry as CountryCode)}`;
      const customerInfo: CustomerInfoInput = {
        name: data.name,
        phone: `${dialCode}${localNumber}`,
        notes: data.notes,
      };

      const submitted = await submitCustomerInfo(customerInfo);
      if (submitted === "not_ready") {
        setSubmitError(t["common.reconnecting"] ?? t["common.error"]);
        return;
      }
      if (submitted !== "ok") {
        setError("phoneNumber", { type: "manual", message: t["customer.phone_invalid"] });
        return;
      }
      await onSubmitted(customerInfo);
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
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          {t["customer.phone_country_code"]}
        </label>
        <Controller
          name="selectedCountry"
          control={control}
          render={({ field }) => (
            <CountryPicker
              value={field.value}
              onChange={field.onChange}
              locale={locale}
              translations={t}
              error={errors.selectedCountry?.message}
            />
          )}
        />
      </div>
      <Input
        label={t["customer.phone"]}
        type="tel"
        placeholder={t["customer.phone_number"]}
        error={errors.phoneNumber?.message}
        {...register("phoneNumber")}
      />
      <Input
        label={t["customer.notes"]}
        placeholder={t["customer.notes"]}
        error={errors.notes?.message}
        {...register("notes")}
      />
      {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      <Button type="submit" size="xl" loading={loading || disabled} className="w-full">
        {t["common.confirm"]}
      </Button>
    </form>
  );
}
