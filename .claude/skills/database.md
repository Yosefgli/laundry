# Skill: Database

## Trigger
Any work with Supabase schema, SQL migrations, RLS policies, or any file calling
the Supabase client for reads/writes.

---

## Rules

### Migrations
- All schema changes go through versioned SQL migration files in `supabase/migrations/`. Never use the Supabase dashboard to alter production schema — dashboard changes that aren't reflected in migration files will cause drift.
- Migration filenames: `YYYYMMDDHHMMSS_short_description.sql`. One logical change per file.
- Every migration must be reversible: include a rollback comment block at the top even if you don't write a down migration file.
- Never alter a column type in place on a table with live data. Add new column, backfill, then drop old column in separate migrations.

### Row-Level Security (RLS)
- RLS must be enabled on every table. A table without RLS is a bug.
- Employee-facing tables: restrict to authenticated users with role `employee` or `admin`.
- Customer-facing tables: customers may only read rows where `customer_id = auth.uid()`. They never write directly to `orders`, `payments`, or `sessions` — only the backend (service role) does.
- The Supabase service role key is used only in server-side API routes via the server client. Never expose it to the browser.

### Supabase client usage
- Browser components use the anon-key Supabase client (`lib/supabase/client.ts`).
- Server actions and API routes use the service-role client (`lib/supabase/server.ts`).
- Never import the server client in a file that could be bundled for the browser.
- All Supabase calls must handle the `{ data, error }` return shape — never destructure `data` without first checking `error`.

### Schema conventions
- All tables use `id uuid DEFAULT gen_random_uuid() PRIMARY KEY`.
- All tables have `created_at timestamptz DEFAULT now()` and `updated_at timestamptz DEFAULT now()`.
- `updated_at` is maintained by a `moddatetime` trigger, not by the application layer.
- Enum-like values (order status, service type) are stored as Postgres `ENUM` types, not free-text strings. Add new enum values via migration, not ad hoc.
- Foreign keys are always named `<referencing_table>_<referenced_table>_fk` and have explicit `ON DELETE` behavior defined (never rely on the default).

### Indexes
- Add an index on every foreign key column and every column used in a `WHERE` clause for high-frequency queries (order lookups by status, session lookups by device ID).
- Do not add indexes speculatively — only when a query pattern is confirmed.

### Forbidden patterns
- No `SELECT *` in application code — always select specific columns.
- No N+1 queries. If you're looping and querying inside the loop, restructure to a single query with joins or `IN`.
- No upserts that silently overwrite protected fields (`id`, `created_at`, `payment_status` after confirmed).
