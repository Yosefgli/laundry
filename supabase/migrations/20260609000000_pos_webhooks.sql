-- Rollback:
--   DROP TABLE pos_webhooks;
--   DROP TYPE webhook_process_status;

CREATE TYPE webhook_process_status AS ENUM (
  'pending',
  'matched_paid',
  'already_paid',
  'no_order_found',
  'amount_mismatch',
  'error'
);

CREATE TABLE pos_webhooks (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_payload             jsonb NOT NULL,
  pos_order_id            integer,
  pos_order_name          text,
  general_note            text,
  extracted_order_number  text,
  amount_total            numeric(10,2),
  matched_order_id        uuid REFERENCES orders(id) ON DELETE SET NULL,
  process_status          webhook_process_status NOT NULL DEFAULT 'pending',
  process_result          text,
  processed_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER pos_webhooks_updated_at
  BEFORE UPDATE ON pos_webhooks
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE INDEX pos_webhooks_extracted_order_number_idx ON pos_webhooks(extracted_order_number);
CREATE INDEX pos_webhooks_process_status_idx         ON pos_webhooks(process_status);
CREATE INDEX pos_webhooks_created_at_idx             ON pos_webhooks(created_at DESC);
CREATE INDEX pos_webhooks_matched_order_id_idx       ON pos_webhooks(matched_order_id);

ALTER TABLE pos_webhooks ENABLE ROW LEVEL SECURITY;

-- Authenticated employees/admins can read webhook logs (read-only audit view)
CREATE POLICY "employees can read pos_webhooks"
  ON pos_webhooks FOR SELECT
  TO authenticated
  USING (true);

-- INSERT and UPDATE are performed exclusively by the service-role API route.
-- The service role bypasses RLS — no INSERT/UPDATE policies required.
