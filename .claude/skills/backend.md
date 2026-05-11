# Skill: Backend

## Trigger
Any work in `app/api/`, server actions, or business logic files. Covers order creation,
price calculation, order state transitions, active session management, workstation/device
pairing, employee↔customer screen communication, session cancellation/recovery, and
workflow state machine transitions between tablets.

---

## Rules

### API routes
- All API route handlers are in `app/api/`. Each route file exports only `GET`, `POST`, `PATCH`, `DELETE` — no utility functions. Move shared logic to `lib/`.
- Every route must validate its request body against a Zod schema before touching the database. Return `400` with a structured error if validation fails. Never pass raw request data to Supabase.
- Return consistent response shapes: `{ data, error }`. Never return naked objects or arrays at the top level.
- All mutating routes (`POST`, `PATCH`, `DELETE`) must verify the caller's session and role via Supabase Auth before acting. A missing or invalid session returns `401` immediately — no partial execution.

### Order workflow state machine
- Valid order states: `draft → weighed → priced → confirmed → paid → ready → delivered`.
- State transitions are enforced server-side only. The client sends an intent; the server validates the current state before advancing. Never trust client-supplied `from` state.
- Each transition must be atomic: update order state and emit the real-time event in the same operation (use a Supabase RPC/transaction). A transition that updates the DB but fails to notify is a bug, not a degraded mode.
- Forbidden transitions must return `409 Conflict` with the current state in the response body so the client can reconcile.

### Session and workstation management
- A "session" is the pairing of one employee device and one customer device for a single order lifecycle. Store session records in a dedicated `sessions` table with `employee_device_id`, `customer_device_id`, `order_id`, `status`, and `created_at`.
- Device pairing is initiated by the employee tablet via a short-lived pairing code (≤ 5 min TTL). The customer tablet claims the code. After claiming, the code is invalidated — never reuse it.
- Session state is the source of truth for which screen shows what. If a session is orphaned (employee disconnects mid-flow), the recovery path must: (1) preserve the order in its last valid state, (2) allow the employee to re-pair, (3) resume from that saved state. Never auto-cancel an order on disconnect alone.
- Session cancellation requires an explicit employee action. On cancel: mark the session `cancelled`, mark the order `void`, and push a cancel event to the customer channel.

### Price calculation
- All price calculation happens server-side in `lib/pricing.ts`. Never calculate final prices on the client — the client displays a server-computed value.
- Pricing logic takes `(serviceId, weightKg, extras[])` and returns `{ lineItems, subtotal, tax, total }`. The shape is fixed — do not add fields without updating all consumers.
- Weight is stored and calculated in kilograms (float, 3 decimal places). Display conversion to other units is a frontend concern only.

### Idempotency
- Order creation and payment recording must be idempotent. Accept an `idempotency-key` header on `POST /api/orders` and `POST /api/payments`. Store keys with a 24h TTL. Return the original response if the key is replayed.
- Never process a payment twice for the same order. Check `orders.payment_status` inside the payment handler before writing.

### Forbidden patterns
- No business logic in API route files — only validation, auth check, call to `lib/`, return response.
- No `try/catch` that swallows errors silently. Every `catch` must either re-throw or return a structured error response.
- No raw SQL strings outside of `lib/db/` or Supabase RPC definitions.
