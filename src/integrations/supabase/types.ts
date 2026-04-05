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
      active_sessions: {
        Row: {
          answer_changes: Json
          answers: Json
          change_sequences: Json
          config: Json
          created_at: string
          current_index: number
          id: string
          pause_events: Json
          question_ids: Json
          question_times: Json
          restored: boolean
          session_id: string
          session_type: string
          time_remaining: number
          time_to_first_click: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          answer_changes?: Json
          answers?: Json
          change_sequences?: Json
          config?: Json
          created_at?: string
          current_index?: number
          id?: string
          pause_events?: Json
          question_ids?: Json
          question_times?: Json
          restored?: boolean
          session_id: string
          session_type?: string
          time_remaining?: number
          time_to_first_click?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          answer_changes?: Json
          answers?: Json
          change_sequences?: Json
          config?: Json
          created_at?: string
          current_index?: number
          id?: string
          pause_events?: Json
          question_ids?: Json
          question_times?: Json
          restored?: boolean
          session_id?: string
          session_type?: string
          time_remaining?: number
          time_to_first_click?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_activity_logs: {
        Row: {
          action_type: string
          admin_email: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_user_email: string | null
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          admin_email: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_user_email?: string | null
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          admin_email?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_user_email?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_message_threads: {
        Row: {
          admin_email: string
          admin_id: string
          candidate_email: string | null
          candidate_id: string
          created_at: string
          id: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          admin_email: string
          admin_id: string
          candidate_email?: string | null
          candidate_id: string
          created_at?: string
          id?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          admin_email?: string
          admin_id?: string
          candidate_email?: string | null
          candidate_id?: string
          created_at?: string
          id?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          sender_role: string
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          sender_role: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          sender_role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "admin_message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_roles: {
        Row: {
          created_at: string
          email: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          role: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      ai_training_context: {
        Row: {
          aggregate_data: Json
          candidate_count: number | null
          id: string
          updated_at: string | null
        }
        Insert: {
          aggregate_data?: Json
          candidate_count?: number | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          aggregate_data?: Json
          candidate_count?: number | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      behavior_profiles: {
        Row: {
          archetype: string
          archetype_signals: Json | null
          block_performance: Json | null
          fatigue_index: number | null
          hesitation_index: number | null
          id: string
          predicted_score_high: number | null
          predicted_score_low: number | null
          predicted_score_potential: number | null
          recommendations: Json | null
          rush_index: number | null
          subject_patterns: Json | null
          trap_flags: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archetype?: string
          archetype_signals?: Json | null
          block_performance?: Json | null
          fatigue_index?: number | null
          hesitation_index?: number | null
          id?: string
          predicted_score_high?: number | null
          predicted_score_low?: number | null
          predicted_score_potential?: number | null
          recommendations?: Json | null
          rush_index?: number | null
          subject_patterns?: Json | null
          trap_flags?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archetype?: string
          archetype_signals?: Json | null
          block_performance?: Json | null
          fatigue_index?: number | null
          hesitation_index?: number | null
          id?: string
          predicted_score_high?: number | null
          predicted_score_low?: number | null
          predicted_score_potential?: number | null
          recommendations?: Json | null
          rush_index?: number | null
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
          candidate_instructions: string | null
          created_at: string
          examiner_instructions: string | null
          id: string
          marking_checklist: Json | null
          reading_time_minutes: number | null
          scenario_data: Json
          scenario_title: string
          session_id: string
          station_time_minutes: number | null
          subject: string
          user_id: string
          zyntra_id: string | null
        }
        Insert: {
          candidate_instructions?: string | null
          created_at?: string
          examiner_instructions?: string | null
          id?: string
          marking_checklist?: Json | null
          reading_time_minutes?: number | null
          scenario_data?: Json
          scenario_title?: string
          session_id: string
          station_time_minutes?: number | null
          subject: string
          user_id: string
          zyntra_id?: string | null
        }
        Update: {
          candidate_instructions?: string | null
          created_at?: string
          examiner_instructions?: string | null
          id?: string
          marking_checklist?: Json | null
          reading_time_minutes?: number | null
          scenario_data?: Json
          scenario_title?: string
          session_id?: string
          station_time_minutes?: number | null
          subject?: string
          user_id?: string
          zyntra_id?: string | null
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          category: string
          created_at: string
          email: string
          id: string
          message: string
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
        }
        Relationships: []
      }
      data_export_history: {
        Row: {
          action_type: string
          created_at: string
          error_message: string | null
          file_name: string | null
          id: string
          merge_mode: string | null
          snapshot_data: Json
          status: string
          user_id: string
          version: number
        }
        Insert: {
          action_type?: string
          created_at?: string
          error_message?: string | null
          file_name?: string | null
          id?: string
          merge_mode?: string | null
          snapshot_data?: Json
          status?: string
          user_id: string
          version?: number
        }
        Update: {
          action_type?: string
          created_at?: string
          error_message?: string | null
          file_name?: string | null
          id?: string
          merge_mode?: string | null
          snapshot_data?: Json
          status?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      feed_submissions: {
        Row: {
          content_text: string
          created_at: string
          feed_type: string
          generated_content: Json
          id: string
          subject: string | null
          user_id: string
        }
        Insert: {
          content_text: string
          created_at?: string
          feed_type?: string
          generated_content?: Json
          id?: string
          subject?: string | null
          user_id: string
        }
        Update: {
          content_text?: string
          created_at?: string
          feed_type?: string
          generated_content?: Json
          id?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      flashcard_decks: {
        Row: {
          card_count: number
          created_at: string
          id: string
          subject: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_count?: number
          created_at?: string
          id?: string
          subject?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          card_count?: number
          created_at?: string
          id?: string
          subject?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flashcard_reviews: {
        Row: {
          created_at: string
          ease_factor: number
          flashcard_id: string
          id: string
          interval_days: number
          next_review_at: string
          repetitions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ease_factor?: number
          flashcard_id: string
          id?: string
          interval_days?: number
          next_review_at?: string
          repetitions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ease_factor?: number
          flashcard_id?: string
          id?: string
          interval_days?: number
          next_review_at?: string
          repetitions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_reviews_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back: string
          created_at: string
          deck_id: string
          front: string
          id: string
          subject: string | null
          subtopic: string | null
        }
        Insert: {
          back: string
          created_at?: string
          deck_id: string
          front: string
          id?: string
          subject?: string | null
          subtopic?: string | null
        }
        Update: {
          back?: string
          created_at?: string
          deck_id?: string
          front?: string
          id?: string
          subject?: string | null
          subtopic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "flashcard_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      ideal_candidate_profile: {
        Row: {
          description: string | null
          id: string
          max_value: number
          metric: string
          min_value: number
          target_value: number
          updated_at: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          max_value: number
          metric: string
          min_value: number
          target_value: number
          updated_at?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          max_value?: number
          metric?: string
          min_value?: number
          target_value?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      manual_overrides: {
        Row: {
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          tier: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          tier?: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          tier?: string
          user_id?: string
        }
        Relationships: []
      }
      model_answers: {
        Row: {
          created_at: string
          id: string
          model_walkthrough: Json
          scenario_title: string
          station_id: string | null
          subject: string
        }
        Insert: {
          created_at?: string
          id?: string
          model_walkthrough?: Json
          scenario_title: string
          station_id?: string | null
          subject: string
        }
        Update: {
          created_at?: string
          id?: string
          model_walkthrough?: Json
          scenario_title?: string
          station_id?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_answers_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "clinical_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          id: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_subscription_id: string | null
          status: string
          tier: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_subscription_id?: string | null
          status?: string
          tier?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_subscription_id?: string | null
          status?: string
          tier?: string
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
      piracy_strikes: {
        Row: {
          created_at: string
          id: string
          issued_by: string | null
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issued_by?: string | null
          reason?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issued_by?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          amc_candidate_id: string | null
          amc1_score: number | null
          amc2_booking_status: string | null
          country_of_graduation: string | null
          country_of_origin: string | null
          created_at: string
          current_location: string | null
          email: string | null
          exam_date: string | null
          exam_location: string | null
          exam_stage: string | null
          exam_target: string | null
          free_trial_end: string | null
          graduation_year: number | null
          id: string
          is_banned: boolean
          medical_college: string | null
          name: string | null
          onboarding_complete: boolean
          referral_code: string | null
          updated_at: string
          user_type: string | null
          weak_areas: string[] | null
        }
        Insert: {
          amc_candidate_id?: string | null
          amc1_score?: number | null
          amc2_booking_status?: string | null
          country_of_graduation?: string | null
          country_of_origin?: string | null
          created_at?: string
          current_location?: string | null
          email?: string | null
          exam_date?: string | null
          exam_location?: string | null
          exam_stage?: string | null
          exam_target?: string | null
          free_trial_end?: string | null
          graduation_year?: number | null
          id: string
          is_banned?: boolean
          medical_college?: string | null
          name?: string | null
          onboarding_complete?: boolean
          referral_code?: string | null
          updated_at?: string
          user_type?: string | null
          weak_areas?: string[] | null
        }
        Update: {
          amc_candidate_id?: string | null
          amc1_score?: number | null
          amc2_booking_status?: string | null
          country_of_graduation?: string | null
          country_of_origin?: string | null
          created_at?: string
          current_location?: string | null
          email?: string | null
          exam_date?: string | null
          exam_location?: string | null
          exam_stage?: string | null
          exam_target?: string | null
          free_trial_end?: string | null
          graduation_year?: number | null
          id?: string
          is_banned?: boolean
          medical_college?: string | null
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
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
      question_dna: {
        Row: {
          accuracy_rate: number | null
          answer_change_rate: number | null
          attempt_count: number | null
          average_time: number | null
          confidence_error_rate: number | null
          difficulty_score: number | null
          id: string
          question_id: string
          trap_type: string | null
          updated_at: string | null
        }
        Insert: {
          accuracy_rate?: number | null
          answer_change_rate?: number | null
          attempt_count?: number | null
          average_time?: number | null
          confidence_error_rate?: number | null
          difficulty_score?: number | null
          id?: string
          question_id: string
          trap_type?: string | null
          updated_at?: string | null
        }
        Update: {
          accuracy_rate?: number | null
          answer_change_rate?: number | null
          attempt_count?: number | null
          average_time?: number | null
          confidence_error_rate?: number | null
          difficulty_score?: number | null
          id?: string
          question_id?: string
          trap_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_dna_question_id_fkey"
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
          guideline_reference: string | null
          id: string
          incorrect_answer_explanations: Json | null
          key_takeaways: string[] | null
          options: Json
          question_text: string
          question_type: string
          subtopic: string | null
          system_category: string | null
          tags: string[] | null
          zyntra_id: string | null
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
          guideline_reference?: string | null
          id?: string
          incorrect_answer_explanations?: Json | null
          key_takeaways?: string[] | null
          options: Json
          question_text: string
          question_type?: string
          subtopic?: string | null
          system_category?: string | null
          tags?: string[] | null
          zyntra_id?: string | null
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
          guideline_reference?: string | null
          id?: string
          incorrect_answer_explanations?: Json | null
          key_takeaways?: string[] | null
          options?: Json
          question_text?: string
          question_type?: string
          subtopic?: string | null
          system_category?: string | null
          tags?: string[] | null
          zyntra_id?: string | null
        }
        Relationships: []
      }
      readiness_dna: {
        Row: {
          answer_stability: number | null
          attempt_count: number | null
          clinical_accuracy: number | null
          confidence_calibration: number | null
          distance_from_ideal: number | null
          id: string
          readiness_score: number | null
          time_management: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          answer_stability?: number | null
          attempt_count?: number | null
          clinical_accuracy?: number | null
          confidence_calibration?: number | null
          distance_from_ideal?: number | null
          id?: string
          readiness_score?: number | null
          time_management?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          answer_stability?: number | null
          attempt_count?: number | null
          clinical_accuracy?: number | null
          confidence_calibration?: number | null
          distance_from_ideal?: number | null
          id?: string
          readiness_score?: number | null
          time_management?: number | null
          updated_at?: string | null
          user_id?: string
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
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
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
      station_bookmarks: {
        Row: {
          created_at: string
          id: string
          station_attempt_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          station_attempt_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          station_attempt_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_bookmarks_station_attempt_id_fkey"
            columns: ["station_attempt_id"]
            isOneToOne: false
            referencedRelation: "station_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      station_notes: {
        Row: {
          created_at: string
          id: string
          note_text: string
          station_attempt_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_text?: string
          station_attempt_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_text?: string
          station_attempt_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_notes_station_attempt_id_fkey"
            columns: ["station_attempt_id"]
            isOneToOne: false
            referencedRelation: "station_attempts"
            referencedColumns: ["id"]
          },
        ]
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
      subject_dna: {
        Row: {
          accuracy: number | null
          attempt_count: number | null
          avg_time: number | null
          gap_score: number | null
          id: string
          stability: number | null
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          attempt_count?: number | null
          avg_time?: number | null
          gap_score?: number | null
          id?: string
          stability?: number | null
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          attempt_count?: number | null
          avg_time?: number | null
          gap_score?: number | null
          id?: string
          stability?: number | null
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      subtopics: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          name: string
          subject_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
          subject_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtopics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      system_error_logs: {
        Row: {
          created_at: string
          details: Json | null
          error_type: string
          id: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          error_type: string
          id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          error_type?: string
          id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      system_health_logs: {
        Row: {
          id: string
          mode: string
          overall_status: string
          steps: Json
          timestamp: string
          total_latency_ms: number
        }
        Insert: {
          id?: string
          mode?: string
          overall_status?: string
          steps?: Json
          timestamp?: string
          total_latency_ms?: number
        }
        Update: {
          id?: string
          mode?: string
          overall_status?: string
          steps?: Json
          timestamp?: string
          total_latency_ms?: number
        }
        Relationships: []
      }
      training_notifications: {
        Row: {
          body: string
          category: string
          created_at: string
          cta_label: string | null
          cta_route: string | null
          dismissed_at: string | null
          icon: string | null
          id: string
          metadata: Json | null
          priority: number
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          cta_label?: string | null
          cta_route?: string | null
          dismissed_at?: string | null
          icon?: string | null
          id?: string
          metadata?: Json | null
          priority?: number
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          cta_label?: string | null
          cta_route?: string | null
          dismissed_at?: string | null
          icon?: string | null
          id?: string
          metadata?: Json | null
          priority?: number
          read_at?: string | null
          title?: string
          type?: string
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
      user_legal_acceptance: {
        Row: {
          accepted_at: string
          id: string
          ip_address: string | null
          terms_version: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          terms_version: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          terms_version?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
      user_presence: {
        Row: {
          current_page: string | null
          id: string
          ip_address: string | null
          is_online: boolean | null
          last_seen_at: string | null
          user_id: string
        }
        Insert: {
          current_page?: string | null
          id?: string
          ip_address?: string | null
          is_online?: boolean | null
          last_seen_at?: string | null
          user_id: string
        }
        Update: {
          current_page?: string | null
          id?: string
          ip_address?: string | null
          is_online?: boolean | null
          last_seen_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_program_progress: {
        Row: {
          completed_at: string | null
          id: string
          progress_pct: number
          stage: number
          track: string
          unlocked: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          progress_pct?: number
          stage?: number
          track: string
          unlocked?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          progress_pct?: number
          stage?: number
          track?: string
          unlocked?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      user_usage_logs: {
        Row: {
          ai_prompts_used: number
          id: string
          mcq_attempts: number
          osce_attempts: number
          usage_date: string
          user_id: string
        }
        Insert: {
          ai_prompts_used?: number
          id?: string
          mcq_attempts?: number
          osce_attempts?: number
          usage_date?: string
          user_id: string
        }
        Update: {
          ai_prompts_used?: number
          id?: string
          mcq_attempts?: number
          osce_attempts?: number
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      watermark_settings: {
        Row: {
          id: string
          opacity_dark: number
          opacity_light: number
          suspended: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          opacity_dark?: number
          opacity_light?: number
          suspended?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          opacity_dark?: number
          opacity_light?: number
          suspended?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compute_distance_from_ideal: {
        Args: {
          p_accuracy: number
          p_calibration: number
          p_stability: number
          p_time: number
        }
        Returns: number
      }
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
