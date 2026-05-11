# Skill: Printing

## Trigger
Any work with barcode generation, barcode scanning input handling, receipt formatting,
or print-trigger logic.

---

## Rules

### Barcode generation
- Use `bwip-js` for barcode rendering (Code 128 format for order barcodes). Do not introduce a second barcode library.
- Barcodes encode the order ID only (UUID). Never encode PII, pricing, or service details in the barcode — those are looked up server-side on scan.
- Render barcodes as SVG, not canvas, for reliable thermal printer output. PNG export is allowed only for label printers that reject SVG.
- Barcode component lives in `components/printing/Barcode.tsx`. Never render barcodes inline in order or receipt components — always import the dedicated component.

### Barcode scanning
- The scan screen mounts a hidden `<input type="text" autoFocus>` that captures the scanner's keyboard stream. This input must reclaim focus if the user clicks elsewhere (attach a `blur` → `focus` handler).
- A complete scan is detected when the input receives a value ≥ 36 characters (UUID length) or when the Enter key fires after any input. Process on either trigger.
- After a successful scan: clear the input, look up the order server-side, and display the result. If the lookup fails (not found, network error): show a visible error with the raw scanned value for manual recovery — never silently fail.
- Duplicate scans within 2 seconds of the same barcode are ignored (debounce by value + timestamp).

### Receipt formatting
- Receipts render in a dedicated `<PrintLayout>` component in `components/printing/PrintLayout.tsx`. This component is invisible on screen and visible only in `@media print`.
- Receipt line items mirror the `{ lineItems, subtotal, tax, total }` shape from the pricing API exactly. Never reformat or re-sum on the client.
- Shop name, address, and tax ID are loaded from environment variables (`NEXT_PUBLIC_SHOP_NAME`, `NEXT_PUBLIC_SHOP_ADDRESS`, `NEXT_PUBLIC_TAX_ID`). Never hardcode them.
- Thermal receipt width is 80mm (48 characters at 10pt monospace). Validate layout at this width before shipping any receipt change.

### Print triggering
- Call `window.print()` only from a user gesture handler (button click). Never auto-print on page load or on state change.
- Before calling `window.print()`, ensure `<PrintLayout>` is mounted and populated. Use a `ref` + `useEffect` to confirm the DOM is ready; do not use `setTimeout`.
- If the browser print dialog is cancelled, no retry or error is shown — this is expected user behavior.

### Forbidden patterns
- No third-party print services or cloud print APIs — printing is always local via the browser print dialog.
- No PDF generation libraries unless the user explicitly requests PDF receipts as a feature — `window.print()` to a PDF printer covers the standard case.
- No barcode scanning logic outside `components/printing/` or the dedicated scan page — do not scatter scan handlers across the app.
