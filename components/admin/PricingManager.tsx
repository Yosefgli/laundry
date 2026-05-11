"use client";
import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Database } from "@/lib/db/database.types";
import type { TranslationMap } from "@/lib/i18n";

type ServiceType = Database["public"]["Tables"]["service_types"]["Row"];
type PricingRule = Database["public"]["Tables"]["pricing_rules"]["Row"] & {
  service_type?: { code: string } | null;
};

interface PricingManagerProps {
  services: ServiceType[];
  rules: PricingRule[];
  translations: TranslationMap;
}

export function PricingManager({ services, rules, translations: t }: PricingManagerProps) {
  const [saving, setSaving] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, { pricePerKg: string; flatFee: string; minimumCharge: string; taxRate: string }>>(
    Object.fromEntries(
      rules.map((r) => [
        r.service_type_id,
        {
          pricePerKg:     String(r.price_per_kg),
          flatFee:        String(r.flat_fee),
          minimumCharge:  String(r.minimum_charge),
          taxRate:        String(Number(r.tax_rate) * 100),
        },
      ])
    )
  );

  async function saveRule(serviceTypeId: string, ruleId: string) {
    setSaving(serviceTypeId);
    const v = values[serviceTypeId];
    await fetch(`/api/admin/pricing/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        price_per_kg:     parseFloat(v.pricePerKg),
        flat_fee:         parseFloat(v.flatFee),
        minimum_charge:   parseFloat(v.minimumCharge),
        tax_rate:         parseFloat(v.taxRate) / 100,
      }),
    });
    setSaving(null);
  }

  function updateField(serviceTypeId: string, field: string, val: string) {
    setValues((prev) => ({
      ...prev,
      [serviceTypeId]: { ...prev[serviceTypeId], [field]: val },
    }));
  }

  return (
    <div className="space-y-4">
      {services.filter((s) => s.is_active).map((service) => {
        const rule = rules.find((r) => r.service_type_id === service.id);
        if (!rule) return null;
        const v = values[service.id] ?? { pricePerKg: "", flatFee: "", minimumCharge: "", taxRate: "" };

        return (
          <div key={service.id} className="bg-white rounded-xl border p-5 space-y-3">
            <h3 className="font-semibold capitalize">{t[`service.${service.code}`] ?? service.code}</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t["admin.price_per_kg"]}
                type="number"
                step="0.001"
                value={v.pricePerKg}
                onChange={(e) => updateField(service.id, "pricePerKg", e.target.value)}
              />
              <Input
                label={t["admin.flat_fee"]}
                type="number"
                step="0.01"
                value={v.flatFee}
                onChange={(e) => updateField(service.id, "flatFee", e.target.value)}
              />
              <Input
                label={t["admin.minimum_charge"]}
                type="number"
                step="0.01"
                value={v.minimumCharge}
                onChange={(e) => updateField(service.id, "minimumCharge", e.target.value)}
              />
              <Input
                label={t["admin.tax_rate"]}
                type="number"
                step="0.1"
                value={v.taxRate}
                onChange={(e) => updateField(service.id, "taxRate", e.target.value)}
              />
            </div>
            <Button
              size="sm"
              loading={saving === service.id}
              onClick={() => saveRule(service.id, rule.id)}
            >
              {t["common.save"]}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
