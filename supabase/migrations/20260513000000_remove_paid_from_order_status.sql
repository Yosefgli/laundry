-- Rollback: see bottom of this file

-- ─── Step 1: Create replacement enum without 'paid' ──────────────────────────
CREATE TYPE order_status_new AS ENUM (
  'draft', 'weighed', 'confirmed',
  'washing', 'drying', 'ironing', 'ready', 'delivered',
  'cancelled', 'void'
);

-- ─── Step 2: Migrate data — 'paid' orders revert to 'confirmed' ──────────────
-- Payment is already faithfully recorded in payment_status / paid_at.
UPDATE orders SET status = 'confirmed' WHERE status = 'paid';

-- ─── Step 3: Swap the column type ────────────────────────────────────────────
ALTER TABLE orders ALTER COLUMN status DROP DEFAULT;

ALTER TABLE orders
  ALTER COLUMN status TYPE order_status_new
  USING status::text::order_status_new;

-- ─── Step 4: Drop the old type (function must go first) ──────────────────────
DROP FUNCTION IF EXISTS valid_order_transition(order_status, order_status);
DROP TYPE order_status;
ALTER TYPE order_status_new RENAME TO order_status;

-- ─── Step 5: Restore column default ──────────────────────────────────────────
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'draft'::order_status;

-- ─── Step 6: Recreate transition validator ────────────────────────────────────
-- 'confirmed' now goes straight to 'washing'.
-- 'delivered' is only reachable from 'ready'; the API additionally requires
-- payment_status = 'paid' before allowing this transition.
CREATE OR REPLACE FUNCTION valid_order_transition(
  p_from order_status,
  p_to   order_status
)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT p_to = ANY(CASE p_from
    WHEN 'draft'     THEN ARRAY['weighed'::order_status,   'cancelled']
    WHEN 'weighed'   THEN ARRAY['confirmed'::order_status, 'cancelled']
    WHEN 'confirmed' THEN ARRAY['washing'::order_status,   'cancelled']
    WHEN 'washing'   THEN ARRAY['drying'::order_status,    'ironing', 'ready']
    WHEN 'drying'    THEN ARRAY['ironing'::order_status,   'ready']
    WHEN 'ironing'   THEN ARRAY['ready'::order_status]
    WHEN 'ready'     THEN ARRAY['delivered'::order_status]
    ELSE ARRAY[]::order_status[]
  END);
$$;

-- ─── Step 7: Remove stale translation keys from the DB ──────────────────────
DELETE FROM translations WHERE key = 'status.paid';

-- ─── Rollback (run manually if needed) ───────────────────────────────────────
-- DROP FUNCTION IF EXISTS valid_order_transition(order_status, order_status);
-- CREATE TYPE order_status_old AS ENUM (
--   'draft','weighed','confirmed','paid','washing','drying','ironing','ready','delivered','cancelled','void'
-- );
-- ALTER TABLE orders ALTER COLUMN status DROP DEFAULT;
-- ALTER TABLE orders ALTER COLUMN status TYPE order_status_old USING status::text::order_status_old;
-- DROP TYPE order_status; ALTER TYPE order_status_old RENAME TO order_status;
-- ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'draft'::order_status;
-- (then recreate original valid_order_transition with 'paid' rows)
