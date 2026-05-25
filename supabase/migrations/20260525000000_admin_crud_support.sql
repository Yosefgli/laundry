-- Rollback:
--   ALTER TABLE employees DROP COLUMN IF EXISTS email;
--   DROP POLICY IF EXISTS "employees_delete" ON employees;
--   (Note: PostgreSQL does not support removing enum values)

-- ─── New audit_action values (run outside transaction - cannot be in BEGIN/COMMIT block) ──
-- These are applied via execute_sql before this migration:
--   ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'service_type_created';
--   ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'service_type_updated';
--   ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'service_type_deleted';
--   ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'employee_deleted';

-- ─── Add email column to employees for admin display ──────────────────────────
ALTER TABLE employees ADD COLUMN IF NOT EXISTS email text;

-- Backfill email from auth.users for existing employees
UPDATE employees e
SET email = u.email
FROM auth.users u
WHERE e.user_id = u.id AND e.email IS NULL;

-- ─── Add DELETE policy for employees (admin only) ─────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'employees' AND policyname = 'employees_delete'
  ) THEN
    EXECUTE 'CREATE POLICY "employees_delete" ON employees
      FOR DELETE TO authenticated
      USING (is_admin())';
  END IF;
END $$;
