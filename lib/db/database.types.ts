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
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at: string
          employee_id: string | null
          entity_id: string | null
          entity_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          employee_id?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          employee_id?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          key: string
          response_body: Json
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          key: string
          response_body: Json
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          key?: string
          response_body?: Json
        }
        Relationships: []
      }
      incidents: {
        Row: {
          compensation: number
          created_at: string
          employee_id: string
          id: string
          incident_type: Database["public"]["Enums"]["incident_type"]
          notes: string
          order_id: string
          updated_at: string
        }
        Insert: {
          compensation?: number
          created_at?: string
          employee_id: string
          id?: string
          incident_type: Database["public"]["Enums"]["incident_type"]
          notes: string
          order_id: string
          updated_at?: string
        }
        Update: {
          compensation?: number
          created_at?: string
          employee_id?: string
          id?: string
          incident_type?: Database["public"]["Enums"]["incident_type"]
          notes?: string
          order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_services: {
        Row: {
          created_at: string
          flat_fee: number
          id: string
          line_total: number
          order_item_id: string
          price_per_kg: number
          pricing_rule_id: string
          service_type_id: string
        }
        Insert: {
          created_at?: string
          flat_fee?: number
          id?: string
          line_total: number
          order_item_id: string
          price_per_kg: number
          pricing_rule_id: string
          service_type_id: string
        }
        Update: {
          created_at?: string
          flat_fee?: number
          id?: string
          line_total?: number
          order_item_id?: string
          price_per_kg?: number
          pricing_rule_id?: string
          service_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_services_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_services_pricing_rule_id_fkey"
            columns: ["pricing_rule_id"]
            isOneToOne: false
            referencedRelation: "pricing_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_services_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          bag_number: number
          color_type: Database["public"]["Enums"]["bag_color_type"] | null
          created_at: string
          id: string
          notes: string | null
          order_id: string
          sort_order: number
          subtotal: number
          updated_at: string
          weight_kg: number
        }
        Insert: {
          bag_number?: number
          color_type?: Database["public"]["Enums"]["bag_color_type"] | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          sort_order?: number
          subtotal?: number
          updated_at?: string
          weight_kg: number
        }
        Update: {
          bag_number?: number
          color_type?: Database["public"]["Enums"]["bag_color_type"] | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          sort_order?: number
          subtotal?: number
          updated_at?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_notes: string | null
          customer_phone: string | null
          delivered_at: string | null
          delivered_by: string | null
          employee_id: string
          id: string
          order_number: string
          paid_at: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax_amount: number
          terms_accepted: boolean
          total_amount: number
          total_weight_kg: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivered_by?: string | null
          employee_id: string
          id?: string
          order_number?: string
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_amount?: number
          terms_accepted?: boolean
          total_amount?: number
          total_weight_kg?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivered_by?: string | null
          employee_id?: string
          id?: string
          order_number?: string
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_amount?: number
          terms_accepted?: boolean
          total_amount?: number
          total_weight_kg?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_delivered_by_fkey"
            columns: ["delivered_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          employee_id: string
          id: string
          idempotency_key: string
          notes: string | null
          order_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          employee_id: string
          id?: string
          idempotency_key: string
          notes?: string | null
          order_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          employee_id?: string
          id?: string
          idempotency_key?: string
          notes?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_webhooks: {
        Row: {
          amount_total: number | null
          created_at: string
          extracted_order_number: string | null
          general_note: string | null
          id: string
          matched_order_id: string | null
          pos_order_id: number | null
          pos_order_name: string | null
          process_result: string | null
          process_status: Database["public"]["Enums"]["webhook_process_status"]
          processed_at: string | null
          raw_payload: Json
          updated_at: string
        }
        Insert: {
          amount_total?: number | null
          created_at?: string
          extracted_order_number?: string | null
          general_note?: string | null
          id?: string
          matched_order_id?: string | null
          pos_order_id?: number | null
          pos_order_name?: string | null
          process_result?: string | null
          process_status?: Database["public"]["Enums"]["webhook_process_status"]
          processed_at?: string | null
          raw_payload: Json
          updated_at?: string
        }
        Update: {
          amount_total?: number | null
          created_at?: string
          extracted_order_number?: string | null
          general_note?: string | null
          id?: string
          matched_order_id?: string | null
          pos_order_id?: number | null
          pos_order_name?: string | null
          process_result?: string | null
          process_status?: Database["public"]["Enums"]["webhook_process_status"]
          processed_at?: string | null
          raw_payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_webhooks_matched_order_id_fkey"
            columns: ["matched_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          flat_fee: number
          id: string
          is_active: boolean
          minimum_charge: number
          price_per_kg: number
          service_type_id: string
          tax_rate: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          flat_fee?: number
          id?: string
          is_active?: boolean
          minimum_charge?: number
          price_per_kg?: number
          service_type_id: string
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          flat_fee?: number
          id?: string
          is_active?: boolean
          minimum_charge?: number
          price_per_kg?: number
          service_type_id?: string
          tax_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_employees: {
        Row: {
          employee_id: string
          printer_id: string
        }
        Insert: {
          employee_id: string
          printer_id: string
        }
        Update: {
          employee_id?: string
          printer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "printer_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_employees_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      printers: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_types: {
        Row: {
          code: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          customer_device_id: string | null
          employee_device_id: string
          id: string
          order_id: string | null
          pairing_code: string | null
          pairing_code_expires: string | null
          pending_item_id: string | null
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
          workflow_step: string
        }
        Insert: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_device_id?: string | null
          employee_device_id: string
          id?: string
          order_id?: string | null
          pairing_code?: string | null
          pairing_code_expires?: string | null
          pending_item_id?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
          workflow_step?: string
        }
        Update: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_device_id?: string | null
          employee_device_id?: string
          id?: string
          order_id?: string | null
          pairing_code?: string | null
          pairing_code_expires?: string | null
          pending_item_id?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
          workflow_step?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_pending_item_id_fkey"
            columns: ["pending_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      translations: {
        Row: {
          created_at: string
          id: string
          key: string
          locale: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          locale: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          locale?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_idempotency_keys: { Args: never; Returns: undefined }
      expire_pairing_codes: { Args: never; Returns: undefined }
      generate_order_number: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_employee_or_admin: { Args: never; Returns: boolean }
      recalculate_order_totals: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      valid_order_transition: {
        Args: {
          p_from: Database["public"]["Enums"]["order_status"]
          p_to: Database["public"]["Enums"]["order_status"]
        }
        Returns: boolean
      }
    }
    Enums: {
      audit_action:
        | "order_created"
        | "order_status_changed"
        | "payment_confirmed"
        | "delivery_confirmed"
        | "session_created"
        | "session_cancelled"
        | "session_completed"
        | "refund_created"
        | "incident_created"
        | "printer_config_changed"
        | "workstation_config_changed"
        | "setting_changed"
        | "employee_created"
        | "employee_updated"
        | "service_type_created"
        | "service_type_updated"
        | "service_type_deleted"
        | "employee_deleted"
      bag_color_type: "white" | "colorful" | "dark"
      incident_type:
        | "missing_item"
        | "damaged_clothing"
        | "customer_complaint"
        | "refund_issued"
        | "other"
      order_status:
        | "draft"
        | "weighed"
        | "confirmed"
        | "washing"
        | "drying"
        | "ironing"
        | "ready"
        | "delivered"
        | "cancelled"
        | "void"
      payment_status: "pending" | "paid" | "refunded"
      session_status: "active" | "completed" | "cancelled" | "expired"
      user_role: "admin" | "employee"
      webhook_process_status:
        | "pending"
        | "matched_paid"
        | "already_paid"
        | "no_order_found"
        | "amount_mismatch"
        | "error"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      audit_action: [
        "order_created",
        "order_status_changed",
        "payment_confirmed",
        "delivery_confirmed",
        "session_created",
        "session_cancelled",
        "session_completed",
        "refund_created",
        "incident_created",
        "printer_config_changed",
        "workstation_config_changed",
        "setting_changed",
        "employee_created",
        "employee_updated",
        "service_type_created",
        "service_type_updated",
        "service_type_deleted",
        "employee_deleted",
      ],
      bag_color_type: ["white", "colorful", "dark"],
      incident_type: [
        "missing_item",
        "damaged_clothing",
        "customer_complaint",
        "refund_issued",
        "other",
      ],
      order_status: [
        "draft",
        "weighed",
        "confirmed",
        "washing",
        "drying",
        "ironing",
        "ready",
        "delivered",
        "cancelled",
        "void",
      ],
      payment_status: ["pending", "paid", "refunded"],
      session_status: ["active", "completed", "cancelled", "expired"],
      user_role: ["admin", "employee"],
      webhook_process_status: [
        "pending",
        "matched_paid",
        "already_paid",
        "no_order_found",
        "amount_mismatch",
        "error",
      ],
    },
  },
} as const
