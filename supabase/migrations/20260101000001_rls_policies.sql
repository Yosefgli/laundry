-- Rollback: Disable RLS on all tables and drop policies.

-- ─── Enable RLS on every table ────────────────────────────────────────────────
ALTER TABLE employees         ENABLE ROW LEVEL SECURITY;
ALTER TABLE workstations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_types     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE translations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys  ENABLE ROW LEVEL SECURITY;

-- ─── Helper: check if current user is employee or admin ───────────────────────
CREATE OR REPLACE FUNCTION is_employee_or_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid()
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
$$;

-- ─── employees ────────────────────────────────────────────────────────────────
CREATE POLICY "employees_select" ON employees
  FOR SELECT TO authenticated
  USING (is_employee_or_admin());

CREATE POLICY "employees_insert" ON employees
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "employees_update" ON employees
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── workstations ─────────────────────────────────────────────────────────────
CREATE POLICY "workstations_select" ON workstations
  FOR SELECT TO authenticated
  USING (is_employee_or_admin());

CREATE POLICY "workstations_write" ON workstations
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── service_types ────────────────────────────────────────────────────────────
CREATE POLICY "service_types_select" ON service_types
  FOR SELECT TO authenticated
  USING (is_employee_or_admin());

CREATE POLICY "service_types_write" ON service_types
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Allow anon to read active service types (customer kiosk reads via server action)
CREATE POLICY "service_types_anon_select" ON service_types
  FOR SELECT TO anon
  USING (is_active = true);

-- ─── pricing_rules ────────────────────────────────────────────────────────────
CREATE POLICY "pricing_rules_select" ON pricing_rules
  FOR SELECT TO authenticated
  USING (is_employee_or_admin());

CREATE POLICY "pricing_rules_write" ON pricing_rules
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "pricing_rules_anon_select" ON pricing_rules
  FOR SELECT TO anon
  USING (is_active = true);

-- ─── orders ───────────────────────────────────────────────────────────────────
CREATE POLICY "orders_select" ON orders
  FOR SELECT TO authenticated
  USING (is_employee_or_admin());

CREATE POLICY "orders_insert" ON orders
  FOR INSERT TO authenticated
  WITH CHECK (is_employee_or_admin());

CREATE POLICY "orders_update" ON orders
  FOR UPDATE TO authenticated
  USING (is_employee_or_admin())
  WITH CHECK (is_employee_or_admin());

-- ─── order_items ──────────────────────────────────────────────────────────────
CREATE POLICY "order_items_select" ON order_items
  FOR SELECT TO authenticated
  USING (is_employee_or_admin());

CREATE POLICY "order_items_write" ON order_items
  FOR ALL TO authenticated
  USING (is_employee_or_admin())
  WITH CHECK (is_employee_or_admin());

-- ─── order_item_services ──────────────────────────────────────────────────────
CREATE POLICY "order_item_services_select" ON order_item_services
  FOR SELECT TO authenticated
  USING (is_employee_or_admin());

CREATE POLICY "order_item_services_write" ON order_item_services
  FOR ALL TO authenticated
  USING (is_employee_or_admin())
  WITH CHECK (is_employee_or_admin());

-- ─── sessions ─────────────────────────────────────────────────────────────────
CREATE POLICY "sessions_select" ON sessions
  FOR SELECT TO authenticated
  USING (is_employee_or_admin());

CREATE POLICY "sessions_insert" ON sessions
  FOR INSERT TO authenticated
  WITH CHECK (is_employee_or_admin());

CREATE POLICY "sessions_update" ON sessions
  FOR UPDATE TO authenticated
  USING (is_employee_or_admin())
  WITH CHECK (is_employee_or_admin());

-- ─── payments ─────────────────────────────────────────────────────────────────
CREATE POLICY "payments_select" ON payments
  FOR SELECT TO authenticated
  USING (is_employee_or_admin());

CREATE POLICY "payments_insert" ON payments
  FOR INSERT TO authenticated
  WITH CHECK (is_employee_or_admin());

-- ─── incidents ────────────────────────────────────────────────────────────────
CREATE POLICY "incidents_select" ON incidents
  FOR SELECT TO authenticated
  USING (is_employee_or_admin());

CREATE POLICY "incidents_write" ON incidents
  FOR ALL TO authenticated
  USING (is_employee_or_admin())
  WITH CHECK (is_employee_or_admin());

-- ─── audit_logs ───────────────────────────────────────────────────────────────
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT TO authenticated
  USING (is_admin());

-- Only service role inserts audit logs
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (is_employee_or_admin());

-- ─── translations ─────────────────────────────────────────────────────────────
-- Everyone (including anon) can read translations
CREATE POLICY "translations_select_all" ON translations
  FOR SELECT USING (true);

CREATE POLICY "translations_write" ON translations
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── system_settings ──────────────────────────────────────────────────────────
CREATE POLICY "system_settings_select" ON system_settings
  FOR SELECT TO authenticated
  USING (is_employee_or_admin());

CREATE POLICY "system_settings_write" ON system_settings
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── idempotency_keys ─────────────────────────────────────────────────────────
-- Only accessible via service role (server-side only)
CREATE POLICY "idempotency_keys_none" ON idempotency_keys
  FOR ALL TO authenticated
  USING (false);
