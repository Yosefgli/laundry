-- Rollback: Drop all functions and triggers created in this migration.

-- ─── Auto-generate order numbers ─────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text LANGUAGE sql AS $$
  SELECT 'L-' || LPAD(nextval('order_number_seq')::text, 6, '0');
$$;

CREATE OR REPLACE FUNCTION set_order_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION set_order_number();

-- ─── Recalculate order totals when items/services change ─────────────────────
CREATE OR REPLACE FUNCTION recalculate_order_totals(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_subtotal  numeric(10,2);
  v_tax       numeric(10,2);
BEGIN
  -- Sum all line totals across all items and their services
  SELECT
    COALESCE(SUM(ois.line_total), 0),
    COALESCE(SUM(ois.line_total * pr.tax_rate), 0)
  INTO v_subtotal, v_tax
  FROM order_items oi
  JOIN order_item_services ois ON ois.order_item_id = oi.id
  JOIN pricing_rules pr ON pr.id = ois.pricing_rule_id
  WHERE oi.order_id = p_order_id;

  UPDATE orders
  SET
    subtotal     = v_subtotal,
    tax_amount   = ROUND(v_tax, 2),
    total_amount = ROUND(v_subtotal + v_tax, 2)
  WHERE id = p_order_id;
END;
$$;

-- Trigger on order_item_services changes
CREATE OR REPLACE FUNCTION trigger_recalculate_order_totals()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_order_id uuid;
BEGIN
  SELECT order_id INTO v_order_id FROM order_items
  WHERE id = COALESCE(NEW.order_item_id, OLD.order_item_id);

  PERFORM recalculate_order_totals(v_order_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_item_services_recalculate
  AFTER INSERT OR UPDATE OR DELETE ON order_item_services
  FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_order_totals();

-- ─── Recalculate per-item subtotals ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION recalculate_item_subtotal()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE order_items
  SET subtotal = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM order_item_services
    WHERE order_item_id = COALESCE(NEW.order_item_id, OLD.order_item_id)
  )
  WHERE id = COALESCE(NEW.order_item_id, OLD.order_item_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_item_services_update_item_subtotal
  AFTER INSERT OR UPDATE OR DELETE ON order_item_services
  FOR EACH ROW EXECUTE FUNCTION recalculate_item_subtotal();

-- ─── Sync order total_weight from items ──────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_order_weight()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE orders
  SET total_weight_kg = (
    SELECT COALESCE(SUM(weight_kg), 0)
    FROM order_items
    WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
  )
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_items_sync_weight
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION sync_order_weight();

-- ─── Expire stale pairing codes ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION expire_pairing_codes()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE sessions
  SET pairing_code = NULL, pairing_code_expires = NULL
  WHERE pairing_code IS NOT NULL
    AND pairing_code_expires < now();
$$;

-- ─── Validate order state transitions ────────────────────────────────────────
-- Valid transitions map encoded as JSON for maintainability
CREATE OR REPLACE FUNCTION valid_order_transition(
  p_from order_status,
  p_to   order_status
)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT p_to = ANY(CASE p_from
    WHEN 'draft'     THEN ARRAY['weighed'::order_status, 'cancelled']
    WHEN 'weighed'   THEN ARRAY['confirmed'::order_status, 'cancelled']
    WHEN 'confirmed' THEN ARRAY['paid'::order_status, 'cancelled']
    WHEN 'paid'      THEN ARRAY['washing'::order_status, 'cancelled']
    WHEN 'washing'   THEN ARRAY['drying'::order_status, 'ironing', 'ready']
    WHEN 'drying'    THEN ARRAY['ironing'::order_status, 'ready']
    WHEN 'ironing'   THEN ARRAY['ready'::order_status]
    WHEN 'ready'     THEN ARRAY['delivered'::order_status]
    ELSE ARRAY[]::order_status[]
  END);
$$;

-- ─── Cleanup expired idempotency keys ────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM idempotency_keys WHERE expires_at < now();
$$;

-- ─── Auto-create employee profile on user signup ─────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only create if metadata provides a name; otherwise let admin create manually
  IF NEW.raw_user_meta_data->>'full_name' IS NOT NULL THEN
    INSERT INTO employees (user_id, full_name, role)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'full_name',
      COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee')
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
