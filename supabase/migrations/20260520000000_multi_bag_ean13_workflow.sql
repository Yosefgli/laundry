-- Rollback:
-- ALTER TABLE order_items DROP COLUMN IF EXISTS color_type;
-- ALTER TABLE order_items DROP COLUMN IF EXISTS bag_number;
-- DROP TYPE IF EXISTS bag_color_type;
-- ALTER TABLE sessions DROP COLUMN IF EXISTS pending_item_id;
-- DELETE FROM system_settings WHERE key = 'ean13_prefix';

-- ─── Bag color enum ───────────────────────────────────────────────────────────
CREATE TYPE bag_color_type AS ENUM ('white', 'colorful', 'dark');

-- ─── Add color_type and bag_number to order_items ────────────────────────────
ALTER TABLE order_items
  ADD COLUMN color_type bag_color_type,
  ADD COLUMN bag_number integer NOT NULL DEFAULT 1;

-- ─── Add pending_item_id to sessions (tracks the bag currently being selected) ──
ALTER TABLE sessions
  ADD COLUMN pending_item_id uuid REFERENCES order_items(id) ON DELETE SET NULL;

CREATE INDEX sessions_pending_item_id_idx
  ON sessions(pending_item_id)
  WHERE pending_item_id IS NOT NULL;

-- ─── EAN-13 payment barcode prefix (7 digits, configured per-store) ───────────
INSERT INTO system_settings (key, value, description)
VALUES (
  'ean13_prefix',
  '',
  'First 7 digits of the EAN-13 payment barcode printed on receipts. Leave empty to disable the payment barcode. Must be exactly 7 digits when set.'
)
ON CONFLICT (key) DO NOTHING;
