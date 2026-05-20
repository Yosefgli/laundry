/**
 * Build a 13-digit EAN-13 barcode string.
 * prefix7: exactly 7 digits (store-specific, from system_settings.ean13_prefix)
 * priceInt: integer price in local currency (e.g. 1150 → "01150")
 */
export function buildEan13(prefix7: string, priceInt: number): string {
  if (!/^\d{7}$/.test(prefix7)) throw new Error("EAN-13 prefix must be exactly 7 digits");
  const priceStr = String(Math.max(0, Math.round(priceInt))).padStart(5, "0");
  if (priceStr.length > 5) throw new Error("Price too large for EAN-13 (max 99999)");
  const first12 = prefix7 + priceStr;
  const check = ean13CheckDigit(first12);
  return first12 + check;
}

function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(first12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}
