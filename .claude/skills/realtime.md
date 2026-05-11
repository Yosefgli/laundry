# Skill: Realtime

## Trigger
Any work with Supabase real-time subscriptions, order status sync, or any feature
requiring live updates across workstations (employee ↔ customer tablets).

---

## Rules

### Channel structure
- Each paired session gets one Supabase Broadcast channel named `session:<session_id>`. No shared channels between sessions.
- The employee tablet publishes operational state-change events. The customer tablet may publish only customer-input events (personal details submitted, services selected, order confirmed) for its own active session. No other publish rights for the customer tablet.
- Presence is used to track which devices are currently connected to a session. Check presence before sending state-change events — if the customer tablet is not present, queue the event or hold the transition until it reconnects.

### Event schema
- Every broadcast event has the shape: `{ type: EventType, payload: unknown, timestamp: string (ISO 8601) }`.
- Define all event types as a TypeScript `const` enum in `lib/realtime/events.ts`. Never use raw string literals for event types in channel subscriptions.
- Keep the event schema flat and minimal for MVP. Do not add sequencing, buffering, or ordering logic unless out-of-order delivery becomes a confirmed problem.

### Connection lifecycle
- Subscribe to a channel only after the session is confirmed paired. Subscribing before pairing wastes a channel slot and creates a race condition.
- Unsubscribe and remove the channel on: session complete, session cancelled, component unmount, or page unload (`beforeunload`). Leaked channels will exhaust the connection limit.
- On subscription error or unexpected disconnect: attempt reconnect with exponential backoff (base 500ms, max 8s, 5 attempts). After 5 failed attempts, surface a hard error UI — do not silently retry indefinitely.

### State sync
- Real-time events are notifications, not the source of truth. After receiving an event, always re-fetch the relevant order/session row from the database to confirm the current state before updating UI.
- Never derive order state purely from the sequence of received events. The DB row is authoritative.
- If the customer tablet reconnects mid-session, it must re-fetch the full current order/session state on reconnect, not rely on replayed events.

### Degraded mode
- Real-time is the primary sync mechanism. If real-time disconnects, the app may fall back to polling every 2–5 seconds. Show a visible degraded-mode banner while polling — never silently operate in degraded mode.
- Polling in degraded mode hits a lightweight status endpoint (order + session row only). Do not replicate full real-time event logic in the polling path.
- When real-time reconnects, cancel the poll interval immediately and re-fetch current state once to reconcile before resuming event-driven updates.

### Forbidden patterns
- No Supabase Postgres Changes (database webhooks) for the employee↔customer communication path — use Broadcast only. Postgres Changes are for internal server-side triggers, not low-latency UI sync.
- No storing real-time event payloads in local state as a cache — always treat them as triggers to re-fetch, not as data to persist.
