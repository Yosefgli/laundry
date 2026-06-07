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

  async function onSubmit(data: CustomerInfoFormInput) {
    if (disabled) return;

    setLoading(true);
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
      <Button type="submit" size="xl" loading={loading || disabled} className="w-full">
        {t["common.confirm"]}
      </Button>
    </form>
  );
}
