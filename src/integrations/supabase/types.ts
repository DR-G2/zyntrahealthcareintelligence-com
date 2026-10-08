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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      amc_adapter_evaluation: {
        Row: {
          adapter_context: Json
          candidate_state_id: string | null
          created_at: string
          environment_id: string
          evaluated_at: string
          evidence_count: number
          evidence_quality: number | null
          id: string
          identification_status: string
          lower_bound: number | null
          model_version: string | null
          plugin_version_id: string
          provenance: Json
          readiness_basis: string | null
          readiness_index: number | null
          readiness_index_lower: number | null
          readiness_index_upper: number | null
          readiness_status: string
          state_snapshot: Json
          target_probability: number | null
          uncertainty_measure: number | null
          upper_bound: number | null
          user_id: string
        }
        Insert: {
          adapter_context?: Json
          candidate_state_id?: string | null
          created_at?: string
          environment_id: string
          evaluated_at?: string
          evidence_count?: number
          evidence_quality?: number | null
          id?: string
          identification_status?: string
          lower_bound?: number | null
          model_version?: string | null
          plugin_version_id: string
          provenance?: Json
          readiness_basis?: string | null
          readiness_index?: number | null
          readiness_index_lower?: number | null
          readiness_index_upper?: number | null
          readiness_status?: string
          state_snapshot?: Json
          target_probability?: number | null
          uncertainty_measure?: number | null
          upper_bound?: number | null
          user_id: string
        }
        Update: {
          adapter_context?: Json
          candidate_state_id?: string | null
          created_at?: string
          environment_id?: string
          evaluated_at?: string
          evidence_count?: number
          evidence_quality?: number | null
          id?: string
          identification_status?: string
          lower_bound?: number | null
          model_version?: string | null
          plugin_version_id?: string
          provenance?: Json
          readiness_basis?: string | null
          readiness_index?: number | null
          readiness_index_lower?: number | null
          readiness_index_upper?: number | null
          readiness_status?: string
          state_snapshot?: Json
          target_probability?: number | null
          uncertainty_measure?: number | null
          upper_bound?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "amc_adapter_evaluation_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "amc_exam_environment_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amc_adapter_evaluation_plugin_version_id_fkey"
            columns: ["plugin_version_id"]
            isOneToOne: false
            referencedRelation: "amc_plugin_version"
            referencedColumns: ["id"]
          },
        ]
      }
      amc_blueprint: {
        Row: {
          blueprint_version: string
          created_at: string
          exam_mode: string
          id: string
          item_target: number | null
          metadata: Json
          patient_group: string
          plugin_version_id: string
          proportion: number | null
          task_domain: string | null
        }
        Insert: {
          blueprint_version: string
          created_at?: string
          exam_mode: string
          id?: string
          item_target?: number | null
          metadata?: Json
          patient_group: string
          plugin_version_id: string
          proportion?: number | null
          task_domain?: string | null
        }
        Update: {
          blueprint_version?: string
          created_at?: string
          exam_mode?: string
          id?: string
          item_target?: number | null
          metadata?: Json
          patient_group?: string
          plugin_version_id?: string
          proportion?: number | null
          task_domain?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amc_blueprint_plugin_version_id_fkey"
            columns: ["plugin_version_id"]
            isOneToOne: false
            referencedRelation: "amc_plugin_version"
            referencedColumns: ["id"]
          },
        ]
      }
      amc_dwig_context: {
        Row: {
          created_at: string
          decision_context: string
          environment_id: string
          expected_decision_uncertainty_reduction: number | null
          id: string
          pie_dwig_candidate_id: string | null
          plugin_version_id: string
          rationale: Json
          selected_question_id: string | null
          selected_task_code: string | null
          selection_uncertainty: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          decision_context: string
          environment_id: string
          expected_decision_uncertainty_reduction?: number | null
          id?: string
          pie_dwig_candidate_id?: string | null
          plugin_version_id: string
          rationale?: Json
          selected_question_id?: string | null
          selected_task_code?: string | null
          selection_uncertainty?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          decision_context?: string
          environment_id?: string
          expected_decision_uncertainty_reduction?: number | null
          id?: string
          pie_dwig_candidate_id?: string | null
          plugin_version_id?: string
          rationale?: Json
          selected_question_id?: string | null
          selected_task_code?: string | null
          selection_uncertainty?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "amc_dwig_context_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "amc_exam_environment_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amc_dwig_context_plugin_version_id_fkey"
            columns: ["plugin_version_id"]
            isOneToOne: false
            referencedRelation: "amc_plugin_version"
            referencedColumns: ["id"]
          },
        ]
      }
      amc_exam_environment_v1: {
        Row: {
          blueprint: Json
          created_at: string
          difficulty_distribution: Json
          duration_seconds: number | null
          environment_code: string
          environment_version: string
          exam_mode: string
          id: string
          plugin_version_id: string
          source_manifest: Json
          status: string
          target_definition: Json
          task_mix: Json
          timing: Json
        }
        Insert: {
          blueprint?: Json
          created_at?: string
          difficulty_distribution?: Json
          duration_seconds?: number | null
          environment_code: string
          environment_version: string
          exam_mode: string
          id?: string
          plugin_version_id: string
          source_manifest?: Json
          status?: string
          target_definition?: Json
          task_mix?: Json
          timing?: Json
        }
        Update: {
          blueprint?: Json
          created_at?: string
          difficulty_distribution?: Json
          duration_seconds?: number | null
          environment_code?: string
          environment_version?: string
          exam_mode?: string
          id?: string
          plugin_version_id?: string
          source_manifest?: Json
          status?: string
          target_definition?: Json
          task_mix?: Json
          timing?: Json
        }
        Relationships: [
          {
            foreignKeyName: "amc_exam_environment_v1_plugin_version_id_fkey"
            columns: ["plugin_version_id"]
            isOneToOne: false
            referencedRelation: "amc_plugin_version"
            referencedColumns: ["id"]
          },
        ]
      }
      amc_intervention_catalog_v1: {
        Row: {
          active: boolean
          created_at: string
          delivery_type: string
          eligible_exam_modes: string[]
          evidence_level: string
          id: string
          intervention_code: string
          label: string
          metadata: Json
          outcome_definition: Json
          plugin_version_id: string
          target_states: string[]
        }
        Insert: {
          active?: boolean
          created_at?: string
          delivery_type: string
          eligible_exam_modes?: string[]
          evidence_level?: string
          id?: string
          intervention_code: string
          label: string
          metadata?: Json
          outcome_definition?: Json
          plugin_version_id: string
          target_states?: string[]
        }
        Update: {
          active?: boolean
          created_at?: string
          delivery_type?: string
          eligible_exam_modes?: string[]
          evidence_level?: string
          id?: string
          intervention_code?: string
          label?: string
          metadata?: Json
          outcome_definition?: Json
          plugin_version_id?: string
          target_states?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "amc_intervention_catalog_v1_plugin_version_id_fkey"
            columns: ["plugin_version_id"]
            isOneToOne: false
            referencedRelation: "amc_plugin_version"
            referencedColumns: ["id"]
          },
        ]
      }
      amc_model_registry: {
        Row: {
          activated_at: string | null
          calibration_run_id: string | null
          id: string
          model_type: string
          model_version: string
          pass_probability_calibrated: boolean
          plugin_version_id: string
          provenance: Json
          retired_at: string | null
          status: string
        }
        Insert: {
          activated_at?: string | null
          calibration_run_id?: string | null
          id?: string
          model_type: string
          model_version: string
          pass_probability_calibrated?: boolean
          plugin_version_id: string
          provenance?: Json
          retired_at?: string | null
          status?: string
        }
        Update: {
          activated_at?: string | null
          calibration_run_id?: string | null
          id?: string
          model_type?: string
          model_version?: string
          pass_probability_calibrated?: boolean
          plugin_version_id?: string
          provenance?: Json
          retired_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "amc_model_registry_calibration_run_id_fkey"
            columns: ["calibration_run_id"]
            isOneToOne: false
            referencedRelation: "amc_validation_run"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amc_model_registry_plugin_version_id_fkey"
            columns: ["plugin_version_id"]
            isOneToOne: false
            referencedRelation: "amc_plugin_version"
            referencedColumns: ["id"]
          },
        ]
      }
      amc_plugin_version: {
        Row: {
          assumptions: Json
          blueprint_version: string
          contract_version: string
          created_at: string
          environment_version: string
          id: string
          model_family: string
          plugin_code: string
          plugin_version: string
          source_manifest: Json
          status: string
          target_version: string
          taxonomy_version: string
        }
        Insert: {
          assumptions?: Json
          blueprint_version: string
          contract_version: string
          created_at?: string
          environment_version: string
          id?: string
          model_family: string
          plugin_code: string
          plugin_version: string
          source_manifest?: Json
          status?: string
          target_version: string
          taxonomy_version: string
        }
        Update: {
          assumptions?: Json
          blueprint_version?: string
          contract_version?: string
          created_at?: string
          environment_version?: string
          id?: string
          model_family?: string
          plugin_code?: string
          plugin_version?: string
          source_manifest?: Json
          status?: string
          target_version?: string
          taxonomy_version?: string
        }
        Relationships: []
      }
      amc_task_taxonomy: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          exam_mode: string
          id: string
          label: string
          metadata: Json
          parent_code: string | null
          plugin_version_id: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          exam_mode: string
          id?: string
          label: string
          metadata?: Json
          parent_code?: string | null
          plugin_version_id: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          exam_mode?: string
          id?: string
          label?: string
          metadata?: Json
          parent_code?: string | null
          plugin_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "amc_task_taxonomy_plugin_version_id_fkey"
            columns: ["plugin_version_id"]
            isOneToOne: false
            referencedRelation: "amc_plugin_version"
            referencedColumns: ["id"]
          },
        ]
      }
      amc_validation_run: {
        Row: {
          auc: number | null
          brier: number | null
          candidate_count: number
          created_at: string
          criteria: Json
          dataset_approved: boolean
          dataset_id: string
          ece: number | null
          external_review_complete: boolean
          gate_status: string
          holdout_complete: boolean
          holdout_count: number
          id: string
          independent_calibration_complete: boolean
          log_loss: number | null
          notes: string | null
          plugin_version_id: string
          reviewed_at: string | null
          spearman_theta: number | null
        }
        Insert: {
          auc?: number | null
          brier?: number | null
          candidate_count?: number
          created_at?: string
          criteria?: Json
          dataset_approved?: boolean
          dataset_id: string
          ece?: number | null
          external_review_complete?: boolean
          gate_status?: string
          holdout_complete?: boolean
          holdout_count?: number
          id?: string
          independent_calibration_complete?: boolean
          log_loss?: number | null
          notes?: string | null
          plugin_version_id: string
          reviewed_at?: string | null
          spearman_theta?: number | null
        }
        Update: {
          auc?: number | null
          brier?: number | null
          candidate_count?: number
          created_at?: string
          criteria?: Json
          dataset_approved?: boolean
          dataset_id?: string
          ece?: number | null
          external_review_complete?: boolean
          gate_status?: string
          holdout_complete?: boolean
          holdout_count?: number
          id?: string
          independent_calibration_complete?: boolean
          log_loss?: number | null
          notes?: string | null
          plugin_version_id?: string
          reviewed_at?: string | null
          spearman_theta?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "amc_validation_run_plugin_version_id_fkey"
            columns: ["plugin_version_id"]
            isOneToOne: false
            referencedRelation: "amc_plugin_version"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "bookmarks_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_learner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_stations: {
        Row: {
          candidate_instructions: string | null
          created_at: string
          examiner_instructions: string | null
          id: string
          marking_checklist: Json | null
          provenance: Json
          reading_time_minutes: number | null
          scenario_data: Json
          scenario_title: string
          station_time_minutes: number | null
          status: string
          subject: string
          updated_at: string
          version: number
          zyntra_id: string | null
        }
        Insert: {
          candidate_instructions?: string | null
          created_at?: string
          examiner_instructions?: string | null
          id?: string
          marking_checklist?: Json | null
          provenance?: Json
          reading_time_minutes?: number | null
          scenario_data?: Json
          scenario_title: string
          station_time_minutes?: number | null
          status?: string
          subject: string
          updated_at?: string
          version?: number
          zyntra_id?: string | null
        }
        Update: {
          candidate_instructions?: string | null
          created_at?: string
          examiner_instructions?: string | null
          id?: string
          marking_checklist?: Json | null
          provenance?: Json
          reading_time_minutes?: number | null
          scenario_data?: Json
          scenario_title?: string
          station_time_minutes?: number | null
          status?: string
          subject?: string
          updated_at?: string
          version?: number
          zyntra_id?: string | null
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
          snapshot_data: Json
          status: string
          user_id: string
          version: number
        }
        Insert: {
          action_type: string
          created_at?: string
          error_message?: string | null
          file_name?: string | null
          id?: string
          snapshot_data?: Json
          status: string
          user_id: string
          version?: number
        }
        Update: {
          action_type?: string
          created_at?: string
          error_message?: string | null
          file_name?: string | null
          id?: string
          snapshot_data?: Json
          status?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "data_export_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          external_transaction_id: string
          id: string
          metadata: Json
          product_key: string | null
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          external_transaction_id: string
          id?: string
          metadata?: Json
          product_key?: string | null
          provider: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          external_transaction_id?: string
          id?: string
          metadata?: Json
          product_key?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_session_questions: {
        Row: {
          answered_at: string | null
          created_at: string
          id: string
          position: number
          presented_at: string | null
          question_id: string
          session_id: string
        }
        Insert: {
          answered_at?: string | null
          created_at?: string
          id?: string
          position: number
          presented_at?: string | null
          question_id: string
          session_id: string
        }
        Update: {
          answered_at?: string | null
          created_at?: string
          id?: string
          position?: number
          presented_at?: string | null
          question_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_session_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_session_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_learner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_session_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_sessions: {
        Row: {
          completed_at: string | null
          config: Json
          created_at: string
          id: string
          last_activity_at: string | null
          session_type: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          config?: Json
          created_at?: string
          id?: string
          last_activity_at?: string | null
          session_type: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          config?: Json
          created_at?: string
          id?: string
          last_activity_at?: string | null
          session_type?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_sessions_user_id_fkey"
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
          country: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          role: string | null
          status: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          role?: string | null
          status?: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: string | null
          status?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          subscription: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          subscription: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          subscription?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          correct_answer: string
          created_at: string
          difficulty_tier: string | null
          explanation: string | null
          id: string
          options: Json
          provenance: Json
          status: string
          stem: string
          subject_id: string
          subtopic_id: string | null
          updated_at: string
          version: number
          zyntra_id: string | null
        }
        Insert: {
          correct_answer: string
          created_at?: string
          difficulty_tier?: string | null
          explanation?: string | null
          id?: string
          options: Json
          provenance?: Json
          status?: string
          stem: string
          subject_id: string
          subtopic_id?: string | null
          updated_at?: string
          version?: number
          zyntra_id?: string | null
        }
        Update: {
          correct_answer?: string
          created_at?: string
          difficulty_tier?: string | null
          explanation?: string | null
          id?: string
          options?: Json
          provenance?: Json
          status?: string
          stem?: string
          subject_id?: string
          subtopic_id?: string | null
          updated_at?: string
          version?: number
          zyntra_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          id: string
          is_public: boolean
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          id?: string
          is_public?: boolean
          setting_key: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          is_public?: boolean
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      station_attempts: {
        Row: {
          candidate_response: Json | null
          checklist_result: Json | null
          completed_at: string | null
          created_at: string
          duration_seconds: number | null
          evaluation: Json | null
          evaluator_type: string | null
          evaluator_version: string | null
          id: string
          provenance: Json
          score: number | null
          session_id: string | null
          started_at: string | null
          station_id: string
          user_id: string
        }
        Insert: {
          candidate_response?: Json | null
          checklist_result?: Json | null
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          evaluation?: Json | null
          evaluator_type?: string | null
          evaluator_version?: string | null
          id?: string
          provenance?: Json
          score?: number | null
          session_id?: string | null
          started_at?: string | null
          station_id: string
          user_id: string
        }
        Update: {
          candidate_response?: Json | null
          checklist_result?: Json | null
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          evaluation?: Json | null
          evaluator_type?: string | null
          evaluator_version?: string | null
          id?: string
          provenance?: Json
          score?: number | null
          session_id?: string | null
          started_at?: string | null
          station_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "station_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_attempts_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "clinical_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_attempts_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "clinical_stations_for_learner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      station_bookmarks: {
        Row: {
          created_at: string
          id: string
          station_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          station_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          station_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_bookmarks_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "clinical_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_bookmarks_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "clinical_stations_for_learner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      station_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          station_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          station_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          station_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_notes_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "clinical_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_notes_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "clinical_stations_for_learner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      station_session_items: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          position: number
          presented_at: string | null
          session_id: string
          station_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          position: number
          presented_at?: string | null
          session_id: string
          station_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          position?: number
          presented_at?: string | null
          session_id?: string
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "station_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_session_items_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "clinical_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_session_items_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "clinical_stations_for_learner"
            referencedColumns: ["id"]
          },
        ]
      }
      station_sessions: {
        Row: {
          completed_at: string | null
          config: Json
          created_at: string
          id: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          config?: Json
          created_at?: string
          id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          config?: Json
          created_at?: string
          id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plans: {
        Row: {
          created_at: string
          id: string
          name: string
          plan_data: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan_data?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan_data?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      subtopics: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          subject_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          subject_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          subject_id?: string
          updated_at?: string
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
      user_attempts: {
        Row: {
          answer_changes_count: number
          app_version: string | null
          change_sequence: Json | null
          confidence_level: number | null
          created_at: string
          id: string
          is_correct: boolean
          pause_events: Json | null
          previous_question_correct: boolean | null
          provenance: Json
          question_id: string
          question_position: number | null
          question_version: number | null
          selected_answer: string
          session_id: string | null
          time_of_day: string | null
          time_taken_seconds: number | null
          time_to_first_click: number | null
          user_id: string
        }
        Insert: {
          answer_changes_count?: number
          app_version?: string | null
          change_sequence?: Json | null
          confidence_level?: number | null
          created_at?: string
          id?: string
          is_correct: boolean
          pause_events?: Json | null
          previous_question_correct?: boolean | null
          provenance?: Json
          question_id: string
          question_position?: number | null
          question_version?: number | null
          selected_answer: string
          session_id?: string | null
          time_of_day?: string | null
          time_taken_seconds?: number | null
          time_to_first_click?: number | null
          user_id: string
        }
        Update: {
          answer_changes_count?: number
          app_version?: string | null
          change_sequence?: Json | null
          confidence_level?: number | null
          created_at?: string
          id?: string
          is_correct?: boolean
          pause_events?: Json | null
          previous_question_correct?: boolean | null
          provenance?: Json
          question_id?: string
          question_position?: number | null
          question_version?: number | null
          selected_answer?: string
          session_id?: string | null
          time_of_day?: string | null
          time_taken_seconds?: number | null
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
          {
            foreignKeyName: "user_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_learner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_legal_acceptance: {
        Row: {
          accepted_at: string
          document_key: string
          document_version: string
          id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          accepted_at?: string
          document_key: string
          document_version: string
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          accepted_at?: string
          document_key?: string
          document_version?: string
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_legal_acceptance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          question_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          question_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          question_id?: string | null
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
          {
            foreignKeyName: "user_notes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_learner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_program_progress: {
        Row: {
          created_at: string
          id: string
          last_activity_at: string | null
          program_key: string
          progress: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_activity_at?: string | null
          program_key: string
          progress?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_activity_at?: string | null
          program_key?: string
          progress?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_program_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          correct_count: number
          created_at: string
          id: string
          last_activity_at: string | null
          questions_attempted: number
          streak: number
          subject_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          correct_count?: number
          created_at?: string
          id?: string
          last_activity_at?: string | null
          questions_attempted?: number
          streak?: number
          subject_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          correct_count?: number
          created_at?: string
          id?: string
          last_activity_at?: string | null
          questions_attempted?: number
          streak?: number
          subject_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      clinical_stations_for_learner: {
        Row: {
          candidate_instructions: string | null
          id: string | null
          reading_time_minutes: number | null
          scenario_data: Json | null
          scenario_title: string | null
          station_time_minutes: number | null
          status: string | null
          subject: string | null
          version: number | null
          zyntra_id: string | null
        }
        Insert: {
          candidate_instructions?: string | null
          id?: string | null
          reading_time_minutes?: number | null
          scenario_data?: Json | null
          scenario_title?: string | null
          station_time_minutes?: number | null
          status?: string | null
          subject?: string | null
          version?: number | null
          zyntra_id?: string | null
        }
        Update: {
          candidate_instructions?: string | null
          id?: string | null
          reading_time_minutes?: number | null
          scenario_data?: Json | null
          scenario_title?: string | null
          station_time_minutes?: number | null
          status?: string | null
          subject?: string | null
          version?: number | null
          zyntra_id?: string | null
        }
        Relationships: []
      }
      my_behavior_dna: {
        Row: {
          archetype: string | null
          calculated_at: string | null
          fatigue_index: number | null
          hesitation_index: number | null
          model_version: string | null
          rush_index: number | null
          stability_metrics: Json | null
          user_id: string | null
        }
        Insert: {
          archetype?: string | null
          calculated_at?: string | null
          fatigue_index?: number | null
          hesitation_index?: number | null
          model_version?: string | null
          rush_index?: number | null
          stability_metrics?: Json | null
          user_id?: string | null
        }
        Update: {
          archetype?: string | null
          calculated_at?: string | null
          fatigue_index?: number | null
          hesitation_index?: number | null
          model_version?: string | null
          rush_index?: number | null
          stability_metrics?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      my_confidence_intelligence: {
        Row: {
          calculated_at: string | null
          calibration_score: number | null
          dimensions: Json | null
          evidence_window: Json | null
          model_version: string | null
          overconfidence_score: number | null
          stability_score: number | null
          underconfidence_score: number | null
          user_id: string | null
        }
        Insert: {
          calculated_at?: string | null
          calibration_score?: number | null
          dimensions?: Json | null
          evidence_window?: Json | null
          model_version?: string | null
          overconfidence_score?: number | null
          stability_score?: number | null
          underconfidence_score?: number | null
          user_id?: string | null
        }
        Update: {
          calculated_at?: string | null
          calibration_score?: number | null
          dimensions?: Json | null
          evidence_window?: Json | null
          model_version?: string | null
          overconfidence_score?: number | null
          stability_score?: number | null
          underconfidence_score?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      my_next_best_actions: {
        Row: {
          action_data: Json | null
          action_type: string | null
          created_at: string | null
          expires_at: string | null
          priority: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          action_data?: Json | null
          action_type?: string | null
          created_at?: string | null
          expires_at?: string | null
          priority?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          action_data?: Json | null
          action_type?: string | null
          created_at?: string | null
          expires_at?: string | null
          priority?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      my_pie_state: {
        Row: {
          calculated_at: string | null
          confidence: number | null
          state: Json | null
          state_version: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
      my_readiness: {
        Row: {
          calculated_at: string | null
          dimensions: Json | null
          model_version: string | null
          readiness_band: string | null
          readiness_score: number | null
          user_id: string | null
        }
        Insert: {
          calculated_at?: string | null
          dimensions?: Json | null
          model_version?: string | null
          readiness_band?: string | null
          readiness_score?: number | null
          user_id?: string | null
        }
        Update: {
          calculated_at?: string | null
          dimensions?: Json | null
          model_version?: string | null
          readiness_band?: string | null
          readiness_score?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      my_subject_dna: {
        Row: {
          accuracy: number | null
          calculated_at: string | null
          confidence_profile: Json | null
          dimensions: Json | null
          model_version: string | null
          subject_id: string | null
          timing_profile: Json | null
          user_id: string | null
        }
        Insert: {
          accuracy?: number | null
          calculated_at?: string | null
          confidence_profile?: Json | null
          dimensions?: Json | null
          model_version?: string | null
          subject_id?: string | null
          timing_profile?: Json | null
          user_id?: string | null
        }
        Update: {
          accuracy?: number | null
          calculated_at?: string | null
          confidence_profile?: Json | null
          dimensions?: Json | null
          model_version?: string | null
          subject_id?: string | null
          timing_profile?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      questions_for_learner: {
        Row: {
          difficulty_tier: string | null
          explanation: string | null
          id: string | null
          options: Json | null
          status: string | null
          stem: string | null
          subject_id: string | null
          subtopic_id: string | null
          version: number | null
          zyntra_id: string | null
        }
        Insert: {
          difficulty_tier?: string | null
          explanation?: string | null
          id?: string | null
          options?: Json | null
          status?: string | null
          stem?: string | null
          subject_id?: string | null
          subtopic_id?: string | null
          version?: number | null
          zyntra_id?: string | null
        }
        Update: {
          difficulty_tier?: string | null
          explanation?: string | null
          id?: string | null
          options?: Json | null
          status?: string | null
          stem?: string | null
          subject_id?: string | null
          subtopic_id?: string | null
          version?: number | null
          zyntra_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_authorize_security_evidence_access: {
        Args: { p_action?: string; p_evidence_id: string; p_reason?: string }
        Returns: string
      }
      admin_resolve_security_incident: {
        Args: {
          p_incident_id: string
          p_resolution_note: string
          p_status: string
        }
        Returns: boolean
      }
      admin_security_feed: { Args: never; Returns: Json }
      admin_security_incident_detail: {
        Args: { p_incident_id: string }
        Returns: Json
      }
      admin_set_security_capture_enabled: {
        Args: { p_enabled: boolean }
        Returns: boolean
      }
      amc_evaluate_promotion_gate: {
        Args: { p_validation_id: string }
        Returns: Json
      }
      amc_promote_calibrated_model: {
        Args: { p_model_version: string; p_validation_id: string }
        Returns: Json
      }
      check_my_ai_tutor_input: {
        Args: { p_context?: Json; p_input: string }
        Returns: Json
      }
      complete_practice_session: {
        Args: { p_session_id: string }
        Returns: {
          completed_at: string | null
          config: Json
          created_at: string
          id: string
          last_activity_at: string | null
          session_type: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "practice_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_practice_session: {
        Args: {
          p_config: Json
          p_question_ids: string[]
          p_session_type: string
        }
        Returns: {
          completed_at: string | null
          config: Json
          created_at: string
          id: string
          last_activity_at: string | null
          session_type: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "practice_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enforce_my_security_event: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      finalize_my_security_screenshot: {
        Args: {
          p_content_hash: string
          p_event_id: string
          p_redaction_state?: string
          p_storage_ref: string
        }
        Returns: string
      }
      get_my_amc_readiness: { Args: { p_exam_mode?: string }; Returns: Json }
      get_my_pie_decision_traces: { Args: never; Returns: Json }
      get_my_pie_inference: { Args: never; Returns: Json }
      get_my_pie_inference_shadow: { Args: never; Returns: Json }
      get_my_pie_misconceptions: { Args: never; Returns: Json }
      get_my_pie_policy_shadow: { Args: never; Returns: Json }
      get_my_pie_review_context: { Args: never; Returns: Json }
      get_my_pie_state: {
        Args: never
        Returns: {
          calculated_at: string
          confidence: number
          state: Json
          state_version: number
          updated_at: string
          user_id: string
        }[]
      }
      get_my_pie_tutor_context: { Args: never; Returns: Json }
      get_my_security_capture_policy: { Args: never; Returns: Json }
      get_my_security_enforcement: { Args: never; Returns: Json }
      get_my_security_notices: { Args: never; Returns: Json }
      get_practice_question_pool: {
        Args: { p_limit?: number }
        Returns: {
          difficulty_tier: string
          explanation: string
          id: string
          options: Json
          stem: string
          subject_id: string
          subtopic_id: string
          version: number
          zyntra_id: string
        }[]
      }
      get_practice_session_questions: {
        Args: { p_session_id: string }
        Returns: {
          answered_at: string
          difficulty_tier: string
          explanation: string
          options: Json
          presented_at: string
          question_id: string
          question_position: number
          session_id: string
          session_question_id: string
          stem: string
          subject_id: string
          subtopic_id: string
          version: number
          zyntra_id: string
        }[]
      }
      get_practice_session_results: {
        Args: { p_session_id: string }
        Returns: {
          answer_changes_count: number
          confidence_level: number
          correct_answer: string
          difficulty_tier: string
          explanation: string
          is_correct: boolean
          options: Json
          question_id: string
          question_position: number
          selected_answer: string
          session_id: string
          session_question_id: string
          stem: string
          subject_id: string
          subtopic_id: string
          time_taken_seconds: number
          version: number
          zyntra_id: string
        }[]
      }
      pie_create_session: {
        Args: { p_blueprint_key?: string; p_count?: number; p_mode?: string }
        Returns: {
          question_count: number
          session_id: string
        }[]
      }
      pie_next_question: {
        Args: { p_session_id: string }
        Returns: {
          decision_id: string
          nble_type: string
          question_id: string
          question_position: number
        }[]
      }
      rebuild_candidate_state: { Args: { p_user_id: string }; Returns: string }
      rebuild_my_amc_readiness: {
        Args: { p_exam_mode?: string }
        Returns: Json
      }
      rebuild_my_pie_decision_trace: {
        Args: { p_question_id?: string; p_session_id?: string }
        Returns: string
      }
      rebuild_my_pie_inference: { Args: never; Returns: number }
      rebuild_my_pie_inference_shadow: { Args: never; Returns: number }
      rebuild_my_pie_misconceptions: { Args: never; Returns: number }
      rebuild_my_pie_policy_shadow: { Args: never; Returns: number }
      rebuild_my_pie_review: { Args: never; Returns: number }
      rebuild_my_pie_tutor_context: { Args: never; Returns: number }
      record_my_security_event: {
        Args: {
          p_blocked?: boolean
          p_category: string
          p_confidence?: number
          p_event_type: string
          p_evidence?: Json
          p_practice_session_id?: string
          p_question_id?: string
          p_screenshot_count?: number
          p_session_id?: string
          p_severity: string
        }
        Returns: string
      }
      record_my_security_session_signal: {
        Args: { p_severity?: string; p_signal_type: string; p_value?: Json }
        Returns: string
      }
      refresh_candidate_intelligence: { Args: never; Returns: undefined }
      resume_practice_session: {
        Args: { p_session_id: string }
        Returns: {
          completed_at: string | null
          config: Json
          created_at: string
          id: string
          last_activity_at: string | null
          session_type: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "practice_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_attempt: {
        Args: {
          p_answer_changes_count?: number
          p_app_version?: string
          p_change_sequence?: Json
          p_confidence_level?: number
          p_is_correct: boolean
          p_pause_events?: Json
          p_previous_question_correct?: boolean
          p_provenance?: Json
          p_question_id: string
          p_question_position?: number
          p_question_version?: number
          p_selected_answer: string
          p_session_id: string
          p_time_of_day?: string
          p_time_taken_seconds?: number
          p_time_to_first_click?: number
        }
        Returns: {
          answer_changes_count: number
          app_version: string | null
          change_sequence: Json | null
          confidence_level: number | null
          created_at: string
          id: string
          is_correct: boolean
          pause_events: Json | null
          previous_question_correct: boolean | null
          provenance: Json
          question_id: string
          question_position: number | null
          question_version: number | null
          selected_answer: string
          session_id: string | null
          time_of_day: string | null
          time_taken_seconds: number | null
          time_to_first_click: number | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_attempts"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
