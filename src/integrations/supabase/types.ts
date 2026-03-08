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
      behavior_profiles: {
        Row: {
          archetype: string
          archetype_signals: Json | null
          block_performance: Json | null
          id: string
          predicted_score_high: number | null
          predicted_score_low: number | null
          predicted_score_potential: number | null
          recommendations: Json | null
          subject_patterns: Json | null
          trap_flags: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archetype?: string
          archetype_signals?: Json | null
          block_performance?: Json | null
          id?: string
          predicted_score_high?: number | null
          predicted_score_low?: number | null
          predicted_score_potential?: number | null
          recommendations?: Json | null
          subject_patterns?: Json | null
          trap_flags?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archetype?: string
          archetype_signals?: Json | null
          block_performance?: Json | null
          id?: string
          predicted_score_high?: number | null
          predicted_score_low?: number | null
          predicted_score_potential?: number | null
          recommendations?: Json | null
          subject_patterns?: Json | null
          trap_flags?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          question_context: Json | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          question_context?: Json | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          question_context?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clinical_stations: {
        Row: {
          created_at: string
          id: string
          scenario_data: Json
          scenario_title: string
          session_id: string
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          scenario_data?: Json
          scenario_title?: string
          session_id: string
          subject: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          scenario_data?: Json
          scenario_title?: string
          session_id?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
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
          free_trial_end: string | null
          id: string
          name: string | null
          onboarding_complete: boolean
          referral_code: string | null
          updated_at: string
          user_type: string | null
          weak_areas: string[] | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          exam_date?: string | null
          free_trial_end?: string | null
          id: string
          name?: string | null
          onboarding_complete?: boolean
          referral_code?: string | null
          updated_at?: string
          user_type?: string | null
          weak_areas?: string[] | null
        }
        Update: {
          created_at?: string
          email?: string | null
          exam_date?: string | null
          free_trial_end?: string | null
          id?: string
          name?: string | null
          onboarding_complete?: boolean
          referral_code?: string | null
          updated_at?: string
          user_type?: string | null
          weak_areas?: string[] | null
        }
        Relationships: []
      }
      psychograph_history: {
        Row: {
          archetype: string
          cognitive_stability: number
          created_at: string
          delegation_confidence: number
          emotional_reactivity: number
          id: string
          session_id: string
          silence_tolerance: number
          structure_integrity: number
          time_compression_vulnerability: number
          user_id: string
        }
        Insert: {
          archetype?: string
          cognitive_stability?: number
          created_at?: string
          delegation_confidence?: number
          emotional_reactivity?: number
          id?: string
          session_id: string
          silence_tolerance?: number
          structure_integrity?: number
          time_compression_vulnerability?: number
          user_id: string
        }
        Update: {
          archetype?: string
          cognitive_stability?: number
          created_at?: string
          delegation_confidence?: number
          emotional_reactivity?: number
          id?: string
          session_id?: string
          silence_tolerance?: number
          structure_integrity?: number
          time_compression_vulnerability?: number
          user_id?: string
        }
        Relationships: []
      }
      question_difficulty_tiers: {
        Row: {
          avg_time_seconds: number | null
          change_rate: number | null
          correct_rate: number | null
          id: string
          question_id: string
          sample_size: number | null
          tier: number
          updated_at: string
        }
        Insert: {
          avg_time_seconds?: number | null
          change_rate?: number | null
          correct_rate?: number | null
          id?: string
          question_id: string
          sample_size?: number | null
          tier?: number
          updated_at?: string
        }
        Update: {
          avg_time_seconds?: number | null
          change_rate?: number | null
          correct_rate?: number | null
          id?: string
          question_id?: string
          sample_size?: number | null
          tier?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_difficulty_tiers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
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
          difficulty_tier: number | null
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
          difficulty_tier?: number | null
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
          difficulty_tier?: number | null
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
      referrals: {
        Row: {
          created_at: string
          id: string
          referral_code: string
          referred_email: string | null
          referred_id: string | null
          referrer_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code: string
          referred_email?: string | null
          referred_id?: string | null
          referrer_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string
          referred_email?: string | null
          referred_id?: string | null
          referrer_id?: string
          status?: string
        }
        Relationships: []
      }
      shared_test_participants: {
        Row: {
          completed_at: string | null
          id: string
          joined_at: string
          score: Json | null
          shared_test_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          joined_at?: string
          score?: Json | null
          shared_test_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          joined_at?: string
          score?: Json | null
          shared_test_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_test_participants_shared_test_id_fkey"
            columns: ["shared_test_id"]
            isOneToOne: false
            referencedRelation: "shared_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_tests: {
        Row: {
          code: string
          config: Json
          created_at: string
          created_by: string
          id: string
          status: string
          test_type: string
        }
        Insert: {
          code: string
          config?: Json
          created_at?: string
          created_by: string
          id?: string
          status?: string
          test_type?: string
        }
        Update: {
          code?: string
          config?: Json
          created_at?: string
          created_by?: string
          id?: string
          status?: string
          test_type?: string
        }
        Relationships: []
      }
      station_attempts: {
        Row: {
          behavioral_signals: Json
          chat_transcript: Json
          checklist_responses: Json
          created_at: string
          id: string
          mode: string
          psychograph: Json
          scores: Json
          session_id: string
          station_index: number
          subject: string
          time_taken_seconds: number
          user_id: string
        }
        Insert: {
          behavioral_signals?: Json
          chat_transcript?: Json
          checklist_responses?: Json
          created_at?: string
          id?: string
          mode?: string
          psychograph?: Json
          scores?: Json
          session_id: string
          station_index?: number
          subject: string
          time_taken_seconds?: number
          user_id: string
        }
        Update: {
          behavioral_signals?: Json
          chat_transcript?: Json
          checklist_responses?: Json
          created_at?: string
          id?: string
          mode?: string
          psychograph?: Json
          scores?: Json
          session_id?: string
          station_index?: number
          subject?: string
          time_taken_seconds?: number
          user_id?: string
        }
        Relationships: []
      }
      study_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      study_groups: {
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
          change_sequence: Json | null
          created_at: string
          id: string
          is_correct: boolean
          pause_events: number | null
          previous_question_correct: boolean | null
          question_id: string
          question_position: number | null
          selected_answer: string
          session_id: string
          time_of_day: string | null
          time_taken_seconds: number
          time_to_first_click: number | null
          user_id: string
        }
        Insert: {
          answer_changes_count?: number
          change_sequence?: Json | null
          created_at?: string
          id?: string
          is_correct: boolean
          pause_events?: number | null
          previous_question_correct?: boolean | null
          question_id: string
          question_position?: number | null
          selected_answer: string
          session_id: string
          time_of_day?: string | null
          time_taken_seconds: number
          time_to_first_click?: number | null
          user_id: string
        }
        Update: {
          answer_changes_count?: number
          change_sequence?: Json | null
          created_at?: string
          id?: string
          is_correct?: boolean
          pause_events?: number | null
          previous_question_correct?: boolean | null
          question_id?: string
          question_position?: number | null
          selected_answer?: string
          session_id?: string
          time_of_day?: string | null
          time_taken_seconds?: number
          time_to_first_click?: number | null
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
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_test_participant: {
        Args: { _test_id: string; _user_id: string }
        Returns: boolean
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
  public: {
    Enums: {},
  },
} as const
