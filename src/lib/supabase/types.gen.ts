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
      expense_splits: {
        Row: {
          amount: number
          expense_id: string
          id: string
          user_id: string
        }
        Insert: {
          amount: number
          expense_id: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          expense_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_splits_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          created_at: string
          created_by: string
          description: string
          group_id: string | null
          id: string
          paid_by: string
          split_config: Json
          split_type: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          group_id?: string | null
          id?: string
          paid_by: string
          split_config?: Json
          split_type: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          group_id?: string | null
          id?: string
          paid_by?: string
          split_config?: Json
          split_type?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_invites: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          inviter_id: string
          token: string
          used_by: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          inviter_id: string
          token?: string
          used_by?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          inviter_id?: string
          token?: string
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "friend_invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          display_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      settlements: {
        Row: {
          amount: number
          created_at: string
          from_user_id: string
          group_id: string | null
          id: string
          note: string | null
          to_user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          from_user_id: string
          group_id?: string | null
          id?: string
          note?: string | null
          to_user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          from_user_id?: string
          group_id?: string | null
          id?: string
          note?: string | null
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_friend_invite: {
        Args: { p_token: string }
        Returns: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "friendships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_friend_by_id: {
        Args: { p_friend_id: string }
        Returns: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "friendships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_access_expense: { Args: { p_expense_id: string }; Returns: boolean }
      create_expense: {
        Args: {
          p_description: string
          p_group_id: string
          p_paid_by: string
          p_split_config: Json
          p_split_type: string
          p_splits: Json
          p_total_amount: number
        }
        Returns: {
          created_at: string
          created_by: string
          description: string
          group_id: string | null
          id: string
          paid_by: string
          split_config: Json
          split_type: string
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_friend_invite: {
        Args: never
        Returns: {
          created_at: string
          expires_at: string
          id: string
          inviter_id: string
          token: string
          used_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "friend_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_group: {
        Args: { p_member_ids?: string[]; p_name: string }
        Returns: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "groups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_app_setting: { Args: { p_key: string }; Returns: string }
      is_group_member: { Args: { p_group_id: string }; Returns: boolean }
      search_user_by_email: {
        Args: { p_email: string }
        Returns: {
          display_name: string
          email: string
          user_id: string
        }[]
      }
      update_expense: {
        Args: {
          p_description: string
          p_expense_id: string
          p_paid_by: string
          p_split_config: Json
          p_split_type: string
          p_splits: Json
          p_total_amount: number
        }
        Returns: {
          created_at: string
          created_by: string
          description: string
          group_id: string | null
          id: string
          paid_by: string
          split_config: Json
          split_type: string
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

