-- Rollback: DROP TABLE printer_employees; DROP TABLE printers;

-- ─── Printers ────────────────────────────────────────────────────────────────
CREATE TABLE printers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  ip_address  text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER printers_updated_at
  BEFORE UPDATE ON printers
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ─── Printer ↔ Employee assignments ──────────────────────────────────────────
CREATE TABLE printer_employees (
  printer_id   uuid NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  employee_id  uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  PRIMARY KEY (printer_id, employee_id)
);

CREATE INDEX printer_employees_employee_id_idx ON printer_employees(employee_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE printer_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "printers_admin_all" ON printers
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Employees can read printers assigned to them (for /api/print lookups via browser client if ever needed)
CREATE POLICY "printers_employee_read" ON printers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM printer_employees pe
      JOIN employees e ON e.id = pe.employee_id
      WHERE pe.printer_id = printers.id AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "printer_employees_admin_all" ON printer_employees
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "printer_employees_employee_read" ON printer_employees
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees WHERE id = printer_employees.employee_id AND user_id = auth.uid()
    )
  );
