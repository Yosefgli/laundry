# Skill: Frontend

## Trigger
Any work in `components/`, `app/` UI pages, or `.tsx`/`.jsx` files rendering
employee or customer interfaces, forms, or interactive workflows.

---

## Rules

### Component structure
- Every interactive component must be a named export. No default exports on components that receive props.
- Employee interface components live in `components/employee/`. Customer interface components live in `components/customer/`. Shared primitives live in `components/ui/`. Never cross-import between `employee/` and `customer/` — go through `components/ui/` or a shared hook.
- Page-level components in `app/` must stay thin: fetch/subscribe at the page level, pass data down. No data fetching inside deep child components.

### State and forms
- Use `react-hook-form` for all forms. No uncontrolled inputs with manual `useState` for form fields.
- Form validation schemas live in `lib/schemas/` as Zod schemas, imported by both frontend and server actions. Never duplicate validation logic.
- Local UI state (open/closed, selected tab) stays in the component. Order/session state is always server-authoritative — never derive order state from local state alone.

### Real-time UI
- When displaying order status, weight, or price: always subscribe to the Supabase real-time channel, never rely on stale props. Mark stale data visually if the subscription drops.
- The customer screen may submit customer-input data during an active paired session only: personal details, selected services, and order confirmation. It must not read or modify other orders, payments, sessions, or any operational/admin state outside its own active session.
- Customer-screen writes go through server actions or API routes that verify the session is active and the caller owns that session. Never allow the customer tablet to write directly to the DB via the anon client.
- If a real-time subscription is lost, show a visible reconnecting indicator. Never silently show stale data as current.

### Barcode scanning
- Barcode scanner input is treated as a keyboard event stream on a hidden input field that always holds focus on the scan screen. Never use `prompt()` or `alert()`.
- Debounce scan input with a 50ms trailing debounce to absorb multi-character scanner bursts before processing.

### Printing
- Trigger print via `window.print()` inside a dedicated print-layout component. Never inline print styles — use a `@media print` stylesheet.
- Receipt and barcode label components must render correctly at 80mm thermal width. Test with browser print preview at that paper size before shipping.

### Forbidden patterns
- No `any` types. Use `unknown` and narrow explicitly.
- No `useEffect` for data fetching — use server components or `useSWR`/React Query.
- No hardcoded currency symbols or price formatting — always use `Intl.NumberFormat` with locale and currency config from a central constant.
- No `console.log` left in committed code.
