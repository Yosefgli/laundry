-- rollback: ALTER TABLE orders DROP COLUMN IF EXISTS terms_accepted;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false;
