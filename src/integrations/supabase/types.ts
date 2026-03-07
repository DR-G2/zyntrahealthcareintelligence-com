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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      bookmarks: {
        Row: {
          created_at: string
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_profiles: {
        Row: {
          clinical_accuracy: number | null
          confidence_gap: number | null
          id: string
          readiness_score: number | null
          stability_score: number | null
          time_sensitivity: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          clinical_accuracy?: number | null
          confidence_gap?: number | null
          id?: string
          readiness_score?: number | null
          stability_score?: number | null
          time_sensitivity?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          clinical_accuracy?: number | null
          confidence_gap?: number | null
          id?: string
          readiness_score?: number | null
          stability_score?: number | null
          time_sensitivity?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          exam_date: string | null
          id: string
          name: string | null
          onboarding_complete: boolean
          updated_at: string
          user_type: string | null
          weak_areas: string[] | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          exam_date?: string | null
          id: string
          name?: string | null
          onboarding_complete?: boolean
          updated_at?: string
          user_type?: string | null
          weak_areas?: string[] | null
        }
        Update: {
          created_at?: string
          email?: string | null
          exam_date?: string | null
          id?: string
          name?: string | null
          onboarding_complete?: boolean
          updated_at?: string
          user_type?: string | null
          weak_areas?: string[] | null
        }
        Relationships: []
      }
      questions: {
        Row: {
          avg_time_seconds: number | null
          best_treatment: string | null
          category: string
          clinical_vignette: boolean | null
          correct_answer: string
          created_at: string
          diagnosis_explanation: string | null
          differential_diagnoses: Json | null
          difficulty: string
          explanation: string | null
          first_line_investigation: string | null
          gold_standard_investigation: string | null
          id: string
          incorrect_answer_explanations: Json | null
          key_takeaways: string[] | null
          options: Json
          question_text: string
          tags: string[] | null
        }
        Insert: {
          avg_time_seconds?: number | null
          best_treatment?: string | null
          category: string
          clinical_vignette?: boolean | null
          correct_answer: string
          created_at?: string
          diagnosis_explanation?: string | null
          differential_diagnoses?: Json | null
          difficulty?: string
          explanation?: string | null
          first_line_investigation?: string | null
          gold_standard_investigation?: string | null
          id?: string
          incorrect_answer_explanations?: Json | null
          key_takeaways?: string[] | null
          options: Json
          question_text: string
          tags?: string[] | null
        }
        Update: {
          avg_time_seconds?: number | null
          best_treatment?: string | null
          category?: string
          clinical_vignette?: boolean | null
          correct_answer?: string
          created_at?: string
          diagnosis_explanation?: string | null
          differential_diagnoses?: Json | null
          difficulty?: string
          explanation?: string | null
          first_line_investigation?: string | null
          gold_standard_investigation?: string | null
          id?: string
          incorrect_answer_explanations?: Json | null
          key_takeaways?: string[] | null
          options?: Json
          question_text?: string
          tags?: string[] | null
        }
        Relationships: []
      }
      study_plans: {
        Row: {
          focus_areas: string[] | null
          generated_at: string
          id: string
          tasks: Json
          user_id: string
        }
        Insert: {
          focus_areas?: string[] | null
          generated_at?: string
          id?: string
          tasks?: Json
          user_id: string
        }
        Update: {
          focus_areas?: string[] | null
          generated_at?: string
          id?: string
          tasks?: Json
          user_id?: string
        }
        Relationships: []
      }
      user_attempts: {
        Row: {
          answer_changes_count: number
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          selected_answer: string
          session_id: string
          time_taken_seconds: number
          user_id: string
        }
        Insert: {
          answer_changes_count?: number
          created_at?: string
          id?: string
          is_correct: boolean
          question_id: string
          selected_answer: string
          session_id: string
          time_taken_seconds: number
          user_id: string
        }
        Update: {
          answer_changes_count?: number
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_answer?: string
          session_id?: string
          time_taken_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notes: {
        Row: {
          created_at: string
          id: string
          note_text: string
          question_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_text: string
          question_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_text?: string
          question_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          accuracy_rate: number
          id: string
          last_active: string | null
          streak_days: number
          total_questions: number
          user_id: string
        }
        Insert: {
          accuracy_rate?: number
          id?: string
          last_active?: string | null
          streak_days?: number
          total_questions?: number
          user_id: string
        }
        Update: {
          accuracy_rate?: number
          id?: string
          last_active?: string | null
          streak_days?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
