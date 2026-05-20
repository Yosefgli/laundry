"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PHONE_COUNTRY_CODES, type CustomerInfoInput } from "@/lib/schemas/order";
import { getPhoneCountryCodeOptions } from "@/lib/phoneCountryCodes";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";

const CustomerInfoFormSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  phoneCountryCode: z.string().refine((code) => PHONE_COUNTRY_CODES.includes(code)),
  phoneNumber: z.string().min(4).max(20).regex(/^[\d\s-]+$/),
  notes: z.string().max(500).optional(),
});

type CustomerInfoFormInput = z.infer<typeof CustomerInfoFormSchema>;

interface CustomerInfoFormProps {
  orderId: string;
  translations: Record<string, string>;
  locale: Locale;
  onSubmitted: (info: CustomerInfoInput) => void;
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
  const phoneCountryOptions = getPhoneCountryCodeOptions(locale);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CustomerInfoFormInput>({
    resolver: zodResolver(CustomerInfoFormSchema),
    defaultValues: { phoneCountryCode: "" },
  });

  async function onSubmit(data: CustomerInfoFormInput) {
    if (disabled) return;

    setLoading(true);
    try {
      const localNumber = data.phoneNumber.replace(/\D/g, "").replace(/^0+/, "");
      if (localNumber.length < 4) {
        setError("phoneNumber", { type: "manual", message: t["customer.phone_invalid"] });
        return;
      }

      const customerInfo: CustomerInfoInput = {
        name: data.name,
        phone: `${data.phoneCountryCode}${localNumber}`,
        notes: data.notes,
      };

      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_customer_info", ...customerInfo }),
      });
      if (!res.ok) {
        setError("phoneNumber", { type: "manual", message: t["customer.phone_invalid"] });
        return;
      }
      onSubmitted(customerInfo);
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
        <label htmlFor="phoneCountryCode" className="text-sm font-medium text-gray-700">
          {t["customer.phone_country_code"]}
        </label>
        <select
          id="phoneCountryCode"
          className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
          {...register("phoneCountryCode")}
        >
          <option value="" disabled>
            {t["customer.select_phone_country_code"]}
          </option>
          {phoneCountryOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.phoneCountryCode && (
          <p className="text-xs text-red-600">{errors.phoneCountryCode.message}</p>
        )}
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
      <Button type="submit" size="xl" loading={loading || disabled} className="w-full">
        {t["common.confirm"]}
      </Button>
    </form>
  );
}
