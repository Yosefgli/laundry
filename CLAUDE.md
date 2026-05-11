# CLAUDE.md — Laundry Ops Management System

## Pre-task protocol
Before writing or modifying any code:
1. Identify which domain the task belongs to (see routing table below).
2. Read the corresponding skill file in full from `.claude/skills/`.
3. Only then proceed with implementation.

---

## `!resume` command
If the user types `!resume` at the start of a session:
- READ `docs/BIG_PICTURE.md`. Do not print it.
- Reply with a short status summary and ask: "What are we working on this session?"
- Do not read it again during the session unless explicitly asked.

---

## Session discipline
One session = one task. Do not let the conversation sprawl across multiple features or fixes.
When the task is complete, say so explicitly.

---

## Routing table

| Trigger | Skill File |
|---|---|
| `components/`, `app/` UI pages, `.tsx`/`.jsx` files, React components, employee or customer interfaces, forms, interactive workflows | `.claude/skills/frontend.md` |
| `app/api/`, server actions, business logic, order workflow, price calculation, session management, workstation pairing, employee↔customer flow control, session cancellation/recovery | `.claude/skills/backend.md` |
| Supabase schema, SQL migrations, RLS policies, Supabase client calls, table design, indexes | `.claude/skills/database.md` |
| Supabase real-time subscriptions, Broadcast channels, order status sync, live updates between tablets, degraded-mode polling | `.claude/skills/realtime.md` |
| Barcode generation, barcode scanning, receipt formatting, print triggering, label layout | `.claude/skills/printing.md` |

---

## Post-task protocol
After every completed task:
1. APPEND a 1-liner to `docs/CHANGELOG.md`. Never read it.
2. Optionally APPEND out-of-scope ideas as 1-liners to `docs/BACKLOG.md`.
3. Tell the user: "Task complete. Log updated. Please close this chat and open a new one — keep the context window clean."
