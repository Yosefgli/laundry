/**
 * Auto-generated Supabase types.
 * Run `npm run db:types` after schema changes to regenerate.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          role: "admin" | "employee";
          is_active: boolean;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["employees"]["Row"], "id" | "created_at" | "updated_at">> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["employees"]["Insert"]>;
        Relationships: [];
      };
      printers: {
        Row: {
          id: string;
          name: string;
          ip_address: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["printers"]["Row"], "id" | "created_at" | "updated_at">> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["printers"]["Insert"]>;
        Relationships: [];
      };
      printer_employees: {
        Row: {
          printer_id: string;
          employee_id: string;
        };
        Insert: {
          printer_id: string;
          employee_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["printer_employees"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "printer_employees_printer_id_fk";
            columns: ["printer_id"];
            isOneToOne: false;
            referencedRelation: "printers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "printer_employees_employee_id_fk";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };
      service_types: {
        Row: {
          id: string;
          code: string;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["service_types"]["Row"], "id" | "created_at" | "updated_at">> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["service_types"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "pricing_rules_service_type_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "pricing_rules";
            referencedColumns: ["service_type_id"];
          }
        ];
      };
      pricing_rules: {
        Row: {
          id: string;
          service_type_id: string;
          price_per_kg: number;
          flat_fee: number;
          minimum_charge: number;
          tax_rate: number;
          is_active: boolean;
          effective_from: string;
          effective_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["pricing_rules"]["Row"], "id" | "created_at" | "updated_at">> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["pricing_rules"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "pricing_rules_service_type_id_fkey";
            columns: ["service_type_id"];
            isOneToOne: false;
            referencedRelation: "service_types";
            referencedColumns: ["id"];
          }
        ];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          employee_id: string;
          customer_name: string | null;
          customer_phone: string | null;
          customer_notes: string | null;
          status: "draft" | "weighed" | "confirmed" | "washing" | "drying" | "ironing" | "ready" | "delivered" | "cancelled" | "void";
          payment_status: "pending" | "paid" | "refunded";
          total_weight_kg: number;
          subtotal: number;
          tax_amount: number;
          total_amount: number;
          paid_at: string | null;
          delivered_at: string | null;
          delivered_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["orders"]["Row"], "id" | "order_number" | "created_at" | "updated_at">> & { id?: string; order_number?: string };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "orders_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["order_id"];
          }
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          weight_kg: number;
          notes: string | null;
          subtotal: number;
          sort_order: number;
          bag_number: number;
          color_type: "white" | "colorful" | "dark" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["order_items"]["Row"], "id" | "created_at" | "updated_at">> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_item_services_order_item_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "order_item_services";
            referencedColumns: ["order_item_id"];
          }
        ];
      };
      order_item_services: {
        Row: {
          id: string;
          order_item_id: string;
          service_type_id: string;
          pricing_rule_id: string;
          price_per_kg: number;
          flat_fee: number;
          line_total: number;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["order_item_services"]["Row"], "id" | "created_at">> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["order_item_services"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "order_item_services_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_item_services_service_type_id_fkey";
            columns: ["service_type_id"];
            isOneToOne: false;
            referencedRelation: "service_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_item_services_pricing_rule_id_fkey";
            columns: ["pricing_rule_id"];
            isOneToOne: false;
            referencedRelation: "pricing_rules";
            referencedColumns: ["id"];
          }
        ];
      };
      sessions: {
        Row: {
          id: string;
          order_id: string | null;
          employee_device_id: string;
          customer_device_id: string | null;
          pairing_code: string | null;
          pairing_code_expires: string | null;
          status: "active" | "completed" | "cancelled" | "expired";
          workflow_step: string;
          pending_item_id: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["sessions"]["Row"], "id" | "created_at" | "updated_at">> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["sessions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "sessions_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          employee_id: string;
          amount: number;
          idempotency_key: string;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["payments"]["Row"], "id" | "created_at">> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };
      incidents: {
        Row: {
          id: string;
          order_id: string;
          employee_id: string;
          incident_type: "missing_item" | "damaged_clothing" | "customer_complaint" | "refund_issued" | "other";
          notes: string;
          compensation: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["incidents"]["Row"], "id" | "created_at" | "updated_at">> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["incidents"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "incidents_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "incidents_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          employee_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          old_values: Json | null;
          new_values: Json | null;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["audit_logs"]["Row"], "id" | "created_at">> & { id?: string };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "audit_logs_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };
      translations: {
        Row: {
          id: string;
          key: string;
          locale: string;
          value: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["translations"]["Row"], "id" | "created_at" | "updated_at">> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["translations"]["Insert"]>;
        Relationships: [];
      };
      system_settings: {
        Row: {
          id: string;
          key: string;
          value: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["system_settings"]["Row"], "id" | "created_at" | "updated_at">> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["system_settings"]["Insert"]>;
        Relationships: [];
      };
      idempotency_keys: {
        Row: {
          id: string;
          key: string;
          response_body: Json;
          created_at: string;
          expires_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["idempotency_keys"]["Row"], "id" | "created_at">> & { id?: string };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_employee_or_admin: { Args: Record<string, never>; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      valid_order_transition: { Args: { p_from: string; p_to: string }; Returns: boolean };
      recalculate_order_totals: { Args: { p_order_id: string }; Returns: void };
      generate_order_number: { Args: Record<string, never>; Returns: string };
    };
    Enums: {
      order_status: "draft" | "weighed" | "confirmed" | "washing" | "drying" | "ironing" | "ready" | "delivered" | "cancelled" | "void";
      payment_status: "pending" | "paid" | "refunded";
      session_status: "active" | "completed" | "cancelled" | "expired";
      user_role: "admin" | "employee";
      incident_type: "missing_item" | "damaged_clothing" | "customer_complaint" | "refund_issued" | "other";
      audit_action: string;
    };
  };
};
