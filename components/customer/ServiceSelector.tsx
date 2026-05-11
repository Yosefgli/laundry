"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatWeight } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { Database } from "@/lib/db/database.types";

type ServiceType = Database["public"]["Tables"]["service_types"]["Row"] & {
  pricing_rules?: Database["public"]["Tables"]["pricing_rules"]["Row"][];
};

interface OrderItem {
  id: string;
  weightKg: number;
  selectedServiceIds: Set<string>;
}

interface ServiceSelectorProps {
  orderId: string;
  serviceTypes: ServiceType[];
  initialItems: Array<{ id: string; weightKg: number }>;
  translations: Record<string, string>;
  locale: Locale;
  onConfirmed: (total: number) => void;
}

export function ServiceSelector({
  orderId,
  serviceTypes,
  initialItems,
  translations: t,
  locale,
  onConfirmed,
}: ServiceSelectorProps) {
  const [items, setItems] = useState<OrderItem[]>(
    initialItems.map((item) => ({
      id: item.id,
      weightKg: item.weightKg,
      selectedServiceIds: new Set<string>(),
    }))
  );
  const [liveTotal, setLiveTotal] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  async function refreshPrice(updatedItems: OrderItem[]) {
    const payload = updatedItems.map((item) => ({
      weightKg: item.weightKg,
      serviceTypeIds: [...item.selectedServiceIds],
    }));
    if (payload.every((p) => p.serviceTypeIds.length === 0)) {
      setLiveTotal(0);
      return;
    }
    const res = await fetch("/api/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: payload }),
    });
    const json = await res.json();
    if (json.data) setLiveTotal(json.data.total);
  }

  function toggleService(itemIdx: number, serviceId: string) {
    setItems((prev) => {
      const next = prev.map((item, i) => {
        if (i !== itemIdx) return item;
        const ids = new Set(item.selectedServiceIds);
        ids.has(serviceId) ? ids.delete(serviceId) : ids.add(serviceId);
        return { ...item, selectedServiceIds: ids };
      });
      refreshPrice(next);
      return next;
    });
  }

  function addBag() {
    // Adding a bag without weight for now — employee will have entered the weight
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), weightKg: 0, selectedServiceIds: new Set() },
    ]);
  }

  async function confirmOrder() {
    setSubmitting(true);
    try {
      // Write services for each item
      for (const item of items) {
        if (item.selectedServiceIds.size === 0) continue;
        await fetch(`/api/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add_item",
            weightKg: item.weightKg,
            serviceTypeIds: [...item.selectedServiceIds],
          }),
        });
      }

      // Advance to confirmed
      await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      });

      onConfirmed(liveTotal);
    } finally {
      setSubmitting(false);
    }
  }

  const hasServices = items.some((item) => item.selectedServiceIds.size > 0);

  return (
    <div className="space-y-6">
      {items.map((item, idx) => (
        <div key={item.id} className="bg-white rounded-xl border p-4 space-y-3">
          <div className="font-semibold text-gray-700">
            {t["customer.bag"]} {idx + 1} — {formatWeight(item.weightKg, locale, t["unit.kg"])}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {serviceTypes.filter((s) => s.is_active).map((service) => {
              const selected = item.selectedServiceIds.has(service.id);
              const price = service.pricing_rules?.[0];
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => toggleService(idx, service.id)}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-lg border-2 transition-all text-left",
                    selected
                      ? "border-brand-600 bg-brand-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  )}
                >
                  <span className="font-medium text-sm">
                    {t[`service.${service.code}`] ?? service.code}
                  </span>
                  {price && (
                    <span className="text-xs text-gray-500 mt-0.5">
                      {formatCurrency(Number(price.price_per_kg), locale)}/kg
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <Button variant="secondary" size="lg" onClick={addBag} className="w-full">
        + {t["customer.add_bag"]}
      </Button>

      <div className="bg-white rounded-xl border p-4">
        <div className="flex justify-between items-center text-lg font-bold">
          <span>{t["customer.total"]}</span>
          <span className="text-brand-700">{formatCurrency(liveTotal, locale)}</span>
        </div>
      </div>

      <Button
        size="xl"
        className="w-full"
        disabled={!hasServices}
        loading={submitting}
        onClick={confirmOrder}
      >
        {t["customer.confirm_order"]}
      </Button>
    </div>
  );
}
