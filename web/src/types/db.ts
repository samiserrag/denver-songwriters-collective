export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      event_slots: {
        Row: {
          created_at: string | null
          end_time: string
          event_id: string
          id: string
          performer_id: string | null
          slot_index: number
          start_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_time: string
          event_id: string
          id?: string
          performer_id?: string | null
          slot_index: number
          start_time: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_time?: string
          event_id?: string
          id?: string
          performer_id?: string | null
          slot_index?: number
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_slots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_slots_performer_id_fkey"
            columns: ["performer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          description: string | null
          end_time: string
          event_date: string
          featured_rank: number | null
          host_id: string
          id: string
          is_featured: boolean | null
          is_showcase: boolean | null
          start_time: string
          title: string
          updated_at: string | null
          venue_address: string | null
          venue_name: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_time: string
          event_date: string
          featured_rank?: number | null
          host_id: string
          id?: string
          is_featured?: boolean | null
          is_showcase?: boolean | null
          start_time: string
          title: string
          updated_at?: string | null
          venue_address?: string | null
          venue_name?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_time?: string
          event_date?: string
          featured_rank?: number | null
          host_id?: string
          id?: string
          is_featured?: boolean | null
          is_showcase?: boolean | null
          start_time?: string
          title?: string
          updated_at?: string | null
          venue_address?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          featured_rank: number | null
          full_name: string | null
          id: string
          is_featured: boolean | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          featured_rank?: number | null
          full_name?: string | null
          id?: string
          is_featured?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          featured_rank?: number | null
          full_name?: string | null
          id?: string
          is_featured?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      spotlights: {
        Row: {
          artist_id: string
          created_at: string | null
          id: string
          reason: string | null
          spotlight_date: string
        }
        Insert: {
          artist_id: string
          created_at?: string | null
          id?: string
          reason?: string | null
          spotlight_date: string
        }
        Update: {
          artist_id?: string
          created_at?: string | null
          id?: string
          reason?: string | null
          spotlight_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "spotlights_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_appointments: {
        Row: {
          appointment_time: string
          created_at: string | null
          id: string
          note: string | null
          performer_id: string
          service_id: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string | null
        }
        Insert: {
          appointment_time: string
          created_at?: string | null
          id?: string
          note?: string | null
          performer_id: string
          service_id: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string | null
        }
        Update: {
          appointment_time?: string
          created_at?: string | null
          id?: string
          note?: string | null
          performer_id?: string
          service_id?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_appointments_performer_id_fkey"
            columns: ["performer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "studio_services"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_services: {
        Row: {
          created_at: string | null
          description: string | null
          duration_min: number
          id: string
          name: string
          price_cents: number
          studio_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_min: number
          id?: string
          name: string
          price_cents: number
          studio_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_min?: number
          id?: string
          name?: string
          price_cents?: number
          studio_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_services_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      rpc_admin_set_showcase_lineup: {
        Args: { event_id: string; performer_ids: string[] }
        Returns: {
          created_at: string | null
          end_time: string
          event_id: string
          id: string
          performer_id: string | null
          slot_index: number
          start_time: string
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "event_slots"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      rpc_book_studio_service: {
        Args: { desired_time: string; service_id: string }
        Returns: {
          appointment_time: string
          created_at: string | null
          id: string
          note: string | null
          performer_id: string
          service_id: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "studio_appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_claim_open_mic_slot: {
        Args: { slot_id: string }
        Returns: {
          created_at: string | null
          end_time: string
          event_id: string
          id: string
          performer_id: string | null
          slot_index: number
          start_time: string
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "event_slots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_get_all_slots_for_event: {
        Args: { event_id: string }
        Returns: {
          created_at: string | null
          end_time: string
          event_id: string
          id: string
          performer_id: string | null
          slot_index: number
          start_time: string
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "event_slots"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      rpc_get_available_slots_for_event: {
        Args: { event_id: string }
        Returns: {
          created_at: string | null
          end_time: string
          event_id: string
          id: string
          performer_id: string | null
          slot_index: number
          start_time: string
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "event_slots"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      rpc_unclaim_open_mic_slot: {
        Args: { slot_id: string }
        Returns: {
          created_at: string | null
          end_time: string
          event_id: string
          id: string
          performer_id: string | null
          slot_index: number
          start_time: string
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "event_slots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      appointment_status: "pending" | "confirmed" | "completed" | "cancelled"
      user_role: "performer" | "host" | "studio" | "admin"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      appointment_status: ["pending", "confirmed", "completed", "cancelled"],
      user_role: ["performer", "host", "studio", "admin"],
    },
  },
} as const

export type EventWithVenue = {
  id: string
  slug?: string | null
  title: string
  description?: string | null
  event_date?: string | null
  start_time?: string | null
  end_time?: string | null
  recurrence_rule?: string | null
  day_of_week?: string | null
  status?: string | null
  notes?: string | null

  venue?: {
    id?: string
    name?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    map_link?: string | null
    website?: string | null
    phone?: string | null
  } | null

  venue_id?: string | null
  venue_name?: string | null
  venue_address?: string | null
}
