import type { Database } from "@/lib/db/database.types";

type PricingRule = Database["public"]["Tables"]["pricing_rules"]["Row"];

export interface LineItem {
  serviceTypeId: string;
  serviceCode: string;
  pricePerKg: number;
  flatFee: number;
  weightKg: number;
  lineTotal: number;
}

export interface PriceBreakdown {
  lineItems: LineItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
}

export interface ServiceInput {
  serviceTypeId: string;
  serviceCode: string;
  pricingRule: PricingRule;
}

export interface ItemInput {
  weightKg: number;
  services: ServiceInput[];
}

export function calculateItemPrice(
  weightKg: number,
  service: ServiceInput
): LineItem {
  const rule = service.pricingRule;
  const raw = Number(rule.price_per_kg) * weightKg + Number(rule.flat_fee);
  const lineTotal = Math.max(raw, Number(rule.minimum_charge));

  return {
    serviceTypeId: service.serviceTypeId,
    serviceCode: service.serviceCode,
    pricePerKg: Number(rule.price_per_kg),
    flatFee: Number(rule.flat_fee),
    weightKg,
    lineTotal: round2(lineTotal),
  };
}

export function calculateOrderPrice(items: ItemInput[]): PriceBreakdown {
  const lineItems: LineItem[] = [];

  for (const item of items) {
    for (const service of item.services) {
      lineItems.push(calculateItemPrice(item.weightKg, service));
    }
  }

  const subtotal = round2(lineItems.reduce((s, l) => s + l.lineTotal, 0));

  // Tax is calculated per line item rule and summed
  const taxAmount = round2(
    lineItems.reduce((s, l) => {
      const rule = items
        .flatMap((i) => i.services)
        .find((sv) => sv.serviceTypeId === l.serviceTypeId)?.pricingRule;
      return s + l.lineTotal * Number(rule?.tax_rate ?? 0);
    }, 0)
  );

  return {
    lineItems,
    subtotal,
    taxAmount,
    total: round2(subtotal + taxAmount),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
