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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      characters: {
        Row: {
          age: number
          avatar_url: string | null
          city: string | null
          created_at: string
          eye_color: string | null
          favorite_color: string | null
          favorite_companion: string | null
          future_dream: string | null
          gender: string
          hair_color: string
          hairstyle: string | null
          id: string
          interests: string[]
          name: string
          skin_tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          age: number
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          eye_color?: string | null
          favorite_color?: string | null
          favorite_companion?: string | null
          future_dream?: string | null
          gender: string
          hair_color: string
          hairstyle?: string | null
          id?: string
          interests?: string[]
          name: string
          skin_tone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: number
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          eye_color?: string | null
          favorite_color?: string | null
          favorite_companion?: string | null
          future_dream?: string | null
          gender?: string
          hair_color?: string
          hairstyle?: string | null
          id?: string
          interests?: string[]
          name?: string
          skin_tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "characters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      illustration_library: {
        Row: {
          created_at: string
          description: string
          description_hash: string
          generation_params: Json | null
          id: string
          image_url: string | null
          provider: string
          provider_model: string | null
          scene_type: string | null
          status: string
          tags: string[]
          template_id: string | null
          updated_at: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          description: string
          description_hash: string
          generation_params?: Json | null
          id?: string
          image_url?: string | null
          provider?: string
          provider_model?: string | null
          scene_type?: string | null
          status?: string
          tags?: string[]
          template_id?: string | null
          updated_at?: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          description?: string
          description_hash?: string
          generation_params?: Json | null
          id?: string
          image_url?: string | null
          provider?: string
          provider_model?: string | null
          scene_type?: string | null
          status?: string
          tags?: string[]
          template_id?: string | null
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          subscribed_at: string | null
        }
        Insert: {
          email: string
          id?: string
          subscribed_at?: string | null
        }
        Update: {
          email?: string
          id?: string
          subscribed_at?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          addons: Json
          created_at: string
          currency: string
          format: string
          gelato_order_id: string | null
          id: string
          pdf_url: string | null
          shipping_address: Json | null
          shipping_name: string | null
          status: string
          story_id: string
          stripe_checkout_session_id: string | null
          stripe_payment_id: string | null
          subtotal: number
          total: number
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          addons?: Json
          created_at?: string
          currency?: string
          format: string
          gelato_order_id?: string | null
          id?: string
          pdf_url?: string | null
          shipping_address?: Json | null
          shipping_name?: string | null
          status?: string
          story_id: string
          stripe_checkout_session_id?: string | null
          stripe_payment_id?: string | null
          subtotal: number
          total: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          addons?: Json
          created_at?: string
          currency?: string
          format?: string
          gelato_order_id?: string | null
          id?: string
          pdf_url?: string | null
          shipping_address?: Json | null
          shipping_name?: string | null
          status?: string
          story_id?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_id?: string | null
          subtotal?: number
          total?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      sagas: {
        Row: {
          character_id: string
          created_at: string
          id: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          character_id: string
          created_at?: string
          id?: string
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          character_id?: string
          created_at?: string
          id?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sagas_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sagas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          art_style: string | null
          character_id: string
          character_portrait_url: string | null
          cover_image_url: string | null
          created_at: string
          creation_mode: string
          dedication_text: string | null
          ending_choice: string | null
          generated_text: Json | null
          id: string
          is_showcase: boolean
          locale: string
          pdf_url: string | null
          recraft_style_id: string | null
          saga_id: string | null
          saga_order: number | null
          sender_name: string | null
          status: string
          story_decisions: Json
          template_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          art_style?: string | null
          character_id: string
          character_portrait_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          creation_mode: string
          dedication_text?: string | null
          ending_choice?: string | null
          generated_text?: Json | null
          id?: string
          is_showcase?: boolean
          locale?: string
          pdf_url?: string | null
          recraft_style_id?: string | null
          saga_id?: string | null
          saga_order?: number | null
          sender_name?: string | null
          status?: string
          story_decisions?: Json
          template_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          art_style?: string | null
          character_id?: string
          character_portrait_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          creation_mode?: string
          dedication_text?: string | null
          ending_choice?: string | null
          generated_text?: Json | null
          id?: string
          is_showcase?: boolean
          locale?: string
          pdf_url?: string | null
          recraft_style_id?: string | null
          saga_id?: string | null
          saga_order?: number | null
          sender_name?: string | null
          status?: string
          story_decisions?: Json
          template_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stories_saga_id_fkey"
            columns: ["saga_id"]
            isOneToOne: false
            referencedRelation: "sagas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_illustrations: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          prompt_used: string
          scene_number: number
          status: string
          story_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          prompt_used: string
          scene_number: number
          status?: string
          story_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          prompt_used?: string
          scene_number?: number
          status?: string
          story_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_illustrations_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
