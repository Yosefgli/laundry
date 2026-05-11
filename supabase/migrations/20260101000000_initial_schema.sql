-- Rollback: DROP SCHEMA public CASCADE; CREATE SCHEMA public;

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS moddatetime;

-- ─── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE order_status AS ENUM (
  'draft', 'weighed', 'confirmed', 'paid',
  'washing', 'drying', 'ironing', 'ready', 'delivered',
  'cancelled', 'void'
);

CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded');

CREATE TYPE session_status AS ENUM ('active', 'completed', 'cancelled', 'expired');

CREATE TYPE user_role AS ENUM ('admin', 'employee');

CREATE TYPE incident_type AS ENUM (
  'missing_item', 'damaged_clothing', 'customer_complaint', 'refund_issued', 'other'
);

CREATE TYPE audit_action AS ENUM (
  'order_created', 'order_status_changed', 'payment_confirmed', 'delivery_confirmed',
  'session_created', 'session_cancelled', 'session_completed',
  'refund_created', 'incident_created',
  'printer_config_changed', 'workstation_config_changed', 'setting_changed',
  'employee_created', 'employee_updated'
);

-- ─── Employees (profiles for auth.users) ─────────────────────────────────────
CREATE TABLE employees (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    text NOT NULL,
  role         user_role NOT NULL DEFAULT 'employee',
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ─── Workstations ─────────────────────────────────────────────────────────────
CREATE TABLE workstations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  printer_ip         text,
  printer_port       integer NOT NULL DEFAULT 9100,
  printer_http_url   text,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER workstations_updated_at
  BEFORE UPDATE ON workstations
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ─── Service Types ────────────────────────────────────────────────────────────
CREATE TABLE service_types (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text UNIQUE NOT NULL,       -- e.g. 'regular', 'ironing', 'express'
  display_order   integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER service_types_updated_at
  BEFORE UPDATE ON service_types
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ─── Pricing Rules ────────────────────────────────────────────────────────────
CREATE TABLE pricing_rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type_id   uuid NOT NULL REFERENCES service_types(id) ON DELETE RESTRICT,
  price_per_kg      numeric(10,3) NOT NULL DEFAULT 0,
  flat_fee          numeric(10,2) NOT NULL DEFAULT 0,
  minimum_charge    numeric(10,2) NOT NULL DEFAULT 0,
  tax_rate          numeric(5,4) NOT NULL DEFAULT 0,  -- e.g. 0.17 for 17%
  is_active         boolean NOT NULL DEFAULT true,
  effective_from    timestamptz NOT NULL DEFAULT now(),
  effective_to      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER pricing_rules_updated_at
  BEFORE UPDATE ON pricing_rules
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE INDEX pricing_rules_service_type_id_idx ON pricing_rules(service_type_id);

-- ─── Orders ───────────────────────────────────────────────────────────────────
CREATE TABLE orders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number       text UNIQUE NOT NULL,      -- human-readable e.g. "L-000042"
  employee_id        uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  workstation_id     uuid REFERENCES workstations(id) ON DELETE SET NULL,
  customer_name      text,
  customer_phone     text,
  customer_notes     text,
  status             order_status NOT NULL DEFAULT 'draft',
  payment_status     payment_status NOT NULL DEFAULT 'pending',
  total_weight_kg    numeric(8,3) NOT NULL DEFAULT 0,
  subtotal           numeric(10,2) NOT NULL DEFAULT 0,
  tax_amount         numeric(10,2) NOT NULL DEFAULT 0,
  total_amount       numeric(10,2) NOT NULL DEFAULT 0,
  paid_at            timestamptz,
  delivered_at       timestamptz,
  delivered_by       uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE INDEX orders_status_idx ON orders(status);
CREATE INDEX orders_employee_id_idx ON orders(employee_id);
CREATE INDEX orders_order_number_idx ON orders(order_number);
CREATE INDEX orders_created_at_idx ON orders(created_at DESC);

-- ─── Order Items (laundry bags/groups within an order) ────────────────────────
CREATE TABLE order_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  weight_kg       numeric(8,3) NOT NULL,
  notes           text,
  subtotal        numeric(10,2) NOT NULL DEFAULT 0,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER order_items_updated_at
  BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE INDEX order_items_order_id_idx ON order_items(order_id);

-- ─── Order Item Services ──────────────────────────────────────────────────────
CREATE TABLE order_item_services (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id     uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  service_type_id   uuid NOT NULL REFERENCES service_types(id) ON DELETE RESTRICT,
  pricing_rule_id   uuid NOT NULL REFERENCES pricing_rules(id) ON DELETE RESTRICT,
  price_per_kg      numeric(10,3) NOT NULL,
  flat_fee          numeric(10,2) NOT NULL DEFAULT 0,
  line_total        numeric(10,2) NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_item_id, service_type_id)
);

CREATE INDEX order_item_services_order_item_id_idx ON order_item_services(order_item_id);

-- ─── Sessions ─────────────────────────────────────────────────────────────────
CREATE TABLE sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              uuid REFERENCES orders(id) ON DELETE SET NULL,
  employee_device_id    text NOT NULL,
  customer_device_id    text,
  workstation_id        uuid REFERENCES workstations(id) ON DELETE SET NULL,
  pairing_code          text,                 -- short-lived code for customer tablet
  pairing_code_expires  timestamptz,
  status                session_status NOT NULL DEFAULT 'active',
  workflow_step         text NOT NULL DEFAULT 'order_creation',
  completed_at          timestamptz,
  cancelled_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE INDEX sessions_employee_device_id_idx ON sessions(employee_device_id);
CREATE INDEX sessions_customer_device_id_idx ON sessions(customer_device_id);
CREATE INDEX sessions_order_id_idx ON sessions(order_id);
CREATE INDEX sessions_status_idx ON sessions(status);
CREATE INDEX sessions_pairing_code_idx ON sessions(pairing_code) WHERE pairing_code IS NOT NULL;

-- ─── Payments ─────────────────────────────────────────────────────────────────
CREATE TABLE payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  employee_id       uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  amount            numeric(10,2) NOT NULL,
  idempotency_key   text UNIQUE NOT NULL,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payments_order_id_idx ON payments(order_id);

-- ─── Incidents ────────────────────────────────────────────────────────────────
CREATE TABLE incidents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  employee_id      uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  incident_type    incident_type NOT NULL,
  notes            text NOT NULL,
  compensation     numeric(10,2) NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER incidents_updated_at
  BEFORE UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE INDEX incidents_order_id_idx ON incidents(order_id);

-- ─── Audit Logs ───────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  uuid REFERENCES employees(id) ON DELETE SET NULL,
  action       audit_action NOT NULL,
  entity_type  text NOT NULL,    -- 'order', 'session', 'workstation', etc.
  entity_id    uuid,
  old_values   jsonb,
  new_values   jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_employee_id_idx ON audit_logs(employee_id);
CREATE INDEX audit_logs_entity_id_idx ON audit_logs(entity_id);
CREATE INDEX audit_logs_created_at_idx ON audit_logs(created_at DESC);
CREATE INDEX audit_logs_action_idx ON audit_logs(action);

-- ─── Translations (dynamic i18n) ─────────────────────────────────────────────
CREATE TABLE translations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL,
  locale      text NOT NULL,   -- 'en', 'he', 'my'
  value       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, locale)
);

CREATE TRIGGER translations_updated_at
  BEFORE UPDATE ON translations
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE INDEX translations_locale_idx ON translations(locale);

-- ─── System Settings ──────────────────────────────────────────────────────────
CREATE TABLE system_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text UNIQUE NOT NULL,
  value       text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ─── Idempotency Keys ─────────────────────────────────────────────────────────
CREATE TABLE idempotency_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text UNIQUE NOT NULL,
  response_body jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX idempotency_keys_expires_at_idx ON idempotency_keys(expires_at);
