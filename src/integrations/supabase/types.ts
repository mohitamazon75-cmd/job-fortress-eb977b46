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
      ab_test_events: {
        Row: {
          analysis_id: string | null
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          analysis_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          payload: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      assessments: {
        Row: {
          agent_1_disruption: Json | null
          agent_2_skills: Json | null
          agent_3_market: Json | null
          agent_4_verdict: Json | null
          created_at: string
          fate_score: number | null
          id: string
          industry: string
          matched_job_family: string | null
          metro_tier: string
          session_id: string
          status: string | null
          years_experience: string
        }
        Insert: {
          agent_1_disruption?: Json | null
          agent_2_skills?: Json | null
          agent_3_market?: Json | null
          agent_4_verdict?: Json | null
          created_at?: string
          fate_score?: number | null
          id?: string
          industry: string
          matched_job_family?: string | null
          metro_tier: string
          session_id: string
          status?: string | null
          years_experience: string
        }
        Update: {
          agent_1_disruption?: Json | null
          agent_2_skills?: Json | null
          agent_3_market?: Json | null
          agent_4_verdict?: Json | null
          created_at?: string
          fate_score?: number | null
          id?: string
          industry?: string
          matched_job_family?: string | null
          metro_tier?: string
          session_id?: string
          status?: string | null
          years_experience?: string
        }
        Relationships: []
      }
      behavior_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          properties: Json | null
          scan_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          properties?: Json | null
          scan_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          properties?: Json | null
          scan_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      beta_ai_capability_map: {
        Row: {
          augmentation_potential: number
          automation_potential: number
          created_at: string | null
          id: string
          maturity: string
          modality: string
          risk_blockers: Json | null
          task_type: string
          typical_tools: Json | null
          version: number | null
        }
        Insert: {
          augmentation_potential?: number
          automation_potential?: number
          created_at?: string | null
          id?: string
          maturity?: string
          modality: string
          risk_blockers?: Json | null
          task_type: string
          typical_tools?: Json | null
          version?: number | null
        }
        Update: {
          augmentation_potential?: number
          automation_potential?: number
          created_at?: string | null
          id?: string
          maturity?: string
          modality?: string
          risk_blockers?: Json | null
          task_type?: string
          typical_tools?: Json | null
          version?: number | null
        }
        Relationships: []
      }
      beta_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          payload: Json | null
          profile_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          profile_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          profile_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      beta_plans: {
        Row: {
          created_at: string | null
          expected_total_delta: number | null
          id: string
          plan_json: Json
          profile_id: string
        }
        Insert: {
          created_at?: string | null
          expected_total_delta?: number | null
          id?: string
          plan_json?: Json
          profile_id: string
        }
        Update: {
          created_at?: string | null
          expected_total_delta?: number | null
          id?: string
          plan_json?: Json
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beta_plans_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "beta_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_profiles: {
        Row: {
          confirmed: boolean | null
          constraints: Json | null
          created_at: string | null
          id: string
          locale: string | null
          profiler_version: string | null
          role_clusters: Json | null
          scan_id: string | null
          seniority: Json | null
          skills: Json | null
          structured_profile: Json
          tasks: Json | null
          tools: Json | null
          user_id: string
        }
        Insert: {
          confirmed?: boolean | null
          constraints?: Json | null
          created_at?: string | null
          id?: string
          locale?: string | null
          profiler_version?: string | null
          role_clusters?: Json | null
          scan_id?: string | null
          seniority?: Json | null
          skills?: Json | null
          structured_profile?: Json
          tasks?: Json | null
          tools?: Json | null
          user_id: string
        }
        Update: {
          confirmed?: boolean | null
          constraints?: Json | null
          created_at?: string | null
          id?: string
          locale?: string | null
          profiler_version?: string | null
          role_clusters?: Json | null
          scan_id?: string | null
          seniority?: Json | null
          skills?: Json | null
          structured_profile?: Json
          tasks?: Json | null
          tools?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      beta_role_task_atlas: {
        Row: {
          created_at: string | null
          id: string
          region: string
          role_cluster: string
          seniority: string
          skills: Json
          standard_code: string | null
          tasks: Json
          tools: Json
          version: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          region?: string
          role_cluster: string
          seniority?: string
          skills?: Json
          standard_code?: string | null
          tasks?: Json
          tools?: Json
          version?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          region?: string
          role_cluster?: string
          seniority?: string
          skills?: Json
          standard_code?: string | null
          tasks?: Json
          tools?: Json
          version?: number | null
        }
        Relationships: []
      }
      beta_scores: {
        Row: {
          confidence: string | null
          config_version: string | null
          created_at: string | null
          exposure_breakdown: Json | null
          id: string
          job_bachao_score: number
          profile_id: string
          risk_factors: Json | null
          subscores: Json
          top_contributors: Json | null
        }
        Insert: {
          confidence?: string | null
          config_version?: string | null
          created_at?: string | null
          exposure_breakdown?: Json | null
          id?: string
          job_bachao_score: number
          profile_id: string
          risk_factors?: Json | null
          subscores?: Json
          top_contributors?: Json | null
        }
        Update: {
          confidence?: string | null
          config_version?: string | null
          created_at?: string | null
          exposure_breakdown?: Json | null
          id?: string
          job_bachao_score?: number
          profile_id?: string
          risk_factors?: Json | null
          subscores?: Json
          top_contributors?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "beta_scores_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "beta_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_signals: {
        Row: {
          fetched_at: string | null
          id: string
          profile_id: string
          signals_json: Json
          sources_json: Json | null
        }
        Insert: {
          fetched_at?: string | null
          id?: string
          profile_id: string
          signals_json?: Json
          sources_json?: Json | null
        }
        Update: {
          fetched_at?: string | null
          id?: string
          profile_id?: string
          signals_json?: Json
          sources_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "beta_signals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "beta_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calibration_config: {
        Row: {
          key: string
          note: string | null
          updated_at: string
          updated_by: string | null
          value: number
        }
        Insert: {
          key: string
          note?: string | null
          updated_at?: string
          updated_by?: string | null
          value: number
        }
        Update: {
          key?: string
          note?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Relationships: []
      }
      calibration_log: {
        Row: {
          applied: boolean
          created_at: string
          current_accel_rate: number | null
          delta: number | null
          direction_accuracy: number | null
          id: string
          mean_error_pct: number | null
          model_version: string
          notes: string | null
          sample_size: number
          suggested_accel_rate: number | null
        }
        Insert: {
          applied?: boolean
          created_at?: string
          current_accel_rate?: number | null
          delta?: number | null
          direction_accuracy?: number | null
          id?: string
          mean_error_pct?: number | null
          model_version: string
          notes?: string | null
          sample_size: number
          suggested_accel_rate?: number | null
        }
        Update: {
          applied?: boolean
          created_at?: string
          current_accel_rate?: number | null
          delta?: number | null
          direction_accuracy?: number | null
          id?: string
          mean_error_pct?: number | null
          model_version?: string
          notes?: string | null
          sample_size?: number
          suggested_accel_rate?: number | null
        }
        Relationships: []
      }
      challenges: {
        Row: {
          challenge_code: string
          challenger_scan_id: string
          challenger_user_id: string
          completed_at: string | null
          created_at: string
          id: string
          respondent_scan_id: string | null
          respondent_user_id: string | null
        }
        Insert: {
          challenge_code?: string
          challenger_scan_id: string
          challenger_user_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          respondent_scan_id?: string | null
          respondent_user_id?: string | null
        }
        Update: {
          challenge_code?: string
          challenger_scan_id?: string
          challenger_user_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          respondent_scan_id?: string | null
          respondent_user_id?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string | null
          id: string
          scan_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          scan_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          scan_id?: string
        }
        Relationships: []
      }
      chat_rate_limits: {
        Row: {
          client_ip: string
          created_at: string
          id: string
        }
        Insert: {
          client_ip: string
          created_at?: string
          id?: string
        }
        Update: {
          client_ip?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      coach_nudges: {
        Row: {
          content: Json | null
          created_at: string
          delivered_at: string | null
          id: string
          nudge_type: string
          scan_id: string
          scheduled_at: string
          seen_at: string | null
          user_id: string
        }
        Insert: {
          content?: Json | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          nudge_type?: string
          scan_id: string
          scheduled_at: string
          seen_at?: string | null
          user_id: string
        }
        Update: {
          content?: Json | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          nudge_type?: string
          scan_id?: string
          scheduled_at?: string
          seen_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cohort_cache: {
        Row: {
          cohort_label: string
          cohort_size: number
          computed_at: string
          insight_text: string
          median_doom_months: number | null
          median_stability: number | null
          pct_improved: number | null
          scan_id: string
          top_skill_gain: string | null
        }
        Insert: {
          cohort_label?: string
          cohort_size?: number
          computed_at?: string
          insight_text?: string
          median_doom_months?: number | null
          median_stability?: number | null
          pct_improved?: number | null
          scan_id: string
          top_skill_gain?: string | null
        }
        Update: {
          cohort_label?: string
          cohort_size?: number
          computed_at?: string
          insight_text?: string
          median_doom_months?: number | null
          median_stability?: number | null
          pct_improved?: number | null
          scan_id?: string
          top_skill_gain?: string | null
        }
        Relationships: []
      }
      cohort_data: {
        Row: {
          ai_tools_used: Json
          city: string
          commit_recency: string | null
          created_at: string
          exp_band: string
          id: string
          job_nature: string | null
          role: string
          scan_id: string
          tools: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ai_tools_used?: Json
          city: string
          commit_recency?: string | null
          created_at?: string
          exp_band: string
          id?: string
          job_nature?: string | null
          role: string
          scan_id: string
          tools?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ai_tools_used?: Json
          city?: string
          commit_recency?: string | null
          created_at?: string
          exp_band?: string
          id?: string
          job_nature?: string | null
          role?: string
          scan_id?: string
          tools?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cohort_data_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: true
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_market_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          id: string
          payload: Json
          source: string
          updated_at: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at: string
          id?: string
          payload: Json
          source: string
          updated_at?: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          payload?: Json
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      cohort_percentiles: {
        Row: {
          city_percentile: number | null
          cohort_size: number | null
          computed_at: string
          country: string | null
          determinism_index: number | null
          id: string
          metro_tier: string | null
          national_percentile: number | null
          p25: number | null
          p50: number | null
          p75: number | null
          p90: number | null
          role_detected: string
          sample_size: number | null
        }
        Insert: {
          city_percentile?: number | null
          cohort_size?: number | null
          computed_at?: string
          country?: string | null
          determinism_index?: number | null
          id?: string
          metro_tier?: string | null
          national_percentile?: number | null
          p25?: number | null
          p50?: number | null
          p75?: number | null
          p90?: number | null
          role_detected: string
          sample_size?: number | null
        }
        Update: {
          city_percentile?: number | null
          cohort_size?: number | null
          computed_at?: string
          country?: string | null
          determinism_index?: number | null
          id?: string
          metro_tier?: string | null
          national_percentile?: number | null
          p25?: number | null
          p50?: number | null
          p75?: number | null
          p90?: number | null
          role_detected?: string
          sample_size?: number | null
        }
        Relationships: []
      }
      company_benchmarks: {
        Row: {
          assessment_count: number
          avg_fate_score: number
          company_name: string
          id: string
          industry: string
          last_updated: string
          risk_tier: string
        }
        Insert: {
          assessment_count?: number
          avg_fate_score?: number
          company_name: string
          id?: string
          industry: string
          last_updated?: string
          risk_tier?: string
        }
        Update: {
          assessment_count?: number
          avg_fate_score?: number
          company_name?: string
          id?: string
          industry?: string
          last_updated?: string
          risk_tier?: string
        }
        Relationships: []
      }
      cost_events: {
        Row: {
          cost_inr_paise: number
          created_at: string
          function_name: string
          id: string
          note: string | null
          provider: string
          scan_id: string | null
        }
        Insert: {
          cost_inr_paise: number
          created_at?: string
          function_name: string
          id?: string
          note?: string | null
          provider: string
          scan_id?: string | null
        }
        Update: {
          cost_inr_paise?: number
          created_at?: string
          function_name?: string
          id?: string
          note?: string | null
          provider?: string
          scan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_events_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      crc_learning_resources: {
        Row: {
          created_at: string
          curated_at: string
          id: string
          resource_duration_min: number | null
          resource_title: string
          resource_url: string
          skill_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          curated_at?: string
          id?: string
          resource_duration_min?: number | null
          resource_title: string
          resource_url: string
          skill_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          curated_at?: string
          id?: string
          resource_duration_min?: number | null
          resource_title?: string
          resource_url?: string
          skill_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_usage_stats: {
        Row: {
          avg_latency_ms: number | null
          call_count: number
          error_count: number
          function_name: string
          id: string
          stat_date: string
          total_cost_usd: number | null
          total_tokens: number | null
          updated_at: string
        }
        Insert: {
          avg_latency_ms?: number | null
          call_count?: number
          error_count?: number
          function_name: string
          id?: string
          stat_date?: string
          total_cost_usd?: number | null
          total_tokens?: number | null
          updated_at?: string
        }
        Update: {
          avg_latency_ms?: number | null
          call_count?: number
          error_count?: number
          function_name?: string
          id?: string
          stat_date?: string
          total_cost_usd?: number | null
          total_tokens?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      defense_milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          milestone_key: string
          milestone_label: string
          phase: number
          resource_url: string | null
          scan_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          milestone_key: string
          milestone_label: string
          phase: number
          resource_url?: string | null
          scan_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          milestone_key?: string
          milestone_label?: string
          phase?: number
          resource_url?: string | null
          scan_id?: string
          user_id?: string
        }
        Relationships: []
      }
      diagnostic_results: {
        Row: {
          ai_covers_percent: number | null
          ai_skills: Json | null
          boss_saves_monthly: number | null
          created_at: string
          experience_band: string
          human_skills: Json | null
          id: string
          is_shared: boolean
          job_title: string
          monthly_ctc: number
          multiplier_needed: number | null
          risk_score: number
          role_prompts: Json | null
          share_token: string | null
          survival_plan: Json | null
          updated_at: string
          user_id: string | null
          verdict_text: string | null
        }
        Insert: {
          ai_covers_percent?: number | null
          ai_skills?: Json | null
          boss_saves_monthly?: number | null
          created_at?: string
          experience_band?: string
          human_skills?: Json | null
          id?: string
          is_shared?: boolean
          job_title: string
          monthly_ctc?: number
          multiplier_needed?: number | null
          risk_score?: number
          role_prompts?: Json | null
          share_token?: string | null
          survival_plan?: Json | null
          updated_at?: string
          user_id?: string | null
          verdict_text?: string | null
        }
        Update: {
          ai_covers_percent?: number | null
          ai_skills?: Json | null
          boss_saves_monthly?: number | null
          created_at?: string
          experience_band?: string
          human_skills?: Json | null
          id?: string
          is_shared?: boolean
          job_title?: string
          monthly_ctc?: number
          multiplier_needed?: number | null
          risk_score?: number
          role_prompts?: Json | null
          share_token?: string | null
          survival_plan?: Json | null
          updated_at?: string
          user_id?: string | null
          verdict_text?: string | null
        }
        Relationships: []
      }
      edge_function_logs: {
        Row: {
          created_at: string
          error_code: string | null
          error_message: string | null
          function_name: string
          id: string
          request_meta: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          function_name: string
          id?: string
          request_meta?: Json | null
          status?: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          function_name?: string
          id?: string
          request_meta?: Json | null
          status?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      enrichment_cache: {
        Row: {
          cache_key: string
          cached_at: string
          data: Json
        }
        Insert: {
          cache_key: string
          cached_at?: string
          data?: Json
        }
        Update: {
          cache_key?: string
          cached_at?: string
          data?: Json
        }
        Relationships: []
      }
      external_api_log: {
        Row: {
          cache_key: string | null
          created_at: string
          endpoint: string | null
          estimated_cost_usd: number | null
          function_name: string | null
          id: string
          latency_ms: number | null
          metadata: Json | null
          provider: string
          status: string
        }
        Insert: {
          cache_key?: string | null
          created_at?: string
          endpoint?: string | null
          estimated_cost_usd?: number | null
          function_name?: string | null
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          provider: string
          status?: string
        }
        Update: {
          cache_key?: string | null
          created_at?: string
          endpoint?: string | null
          estimated_cost_usd?: number | null
          function_name?: string | null
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          provider?: string
          status?: string
        }
        Relationships: []
      }
      fate_cards: {
        Row: {
          assessment_id: string
          card_data: Json
          created_at: string
          id: string
          platforms: Json
          share_count: number
        }
        Insert: {
          assessment_id: string
          card_data?: Json
          created_at?: string
          id?: string
          platforms?: Json
          share_count?: number
        }
        Update: {
          assessment_id?: string
          card_data?: Json
          created_at?: string
          id?: string
          platforms?: Json
          share_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "fate_cards_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled_for_user_ids: string[]
          enabled_percentage: number
          flag_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled_for_user_ids?: string[]
          enabled_percentage?: number
          flag_name: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled_for_user_ids?: string[]
          enabled_percentage?: number
          flag_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      human_edge_cache: {
        Row: {
          bundle: Json
          cache_key: string
          created_at: string
          expires_at: string
          role_context: string | null
          scan_id: string | null
          source: string
        }
        Insert: {
          bundle?: Json
          cache_key: string
          created_at?: string
          expires_at?: string
          role_context?: string | null
          scan_id?: string | null
          source?: string
        }
        Update: {
          bundle?: Json
          cache_key?: string
          created_at?: string
          expires_at?: string
          role_context?: string | null
          scan_id?: string | null
          source?: string
        }
        Relationships: []
      }
      intel_watchlist: {
        Row: {
          added_at: string
          id: string
          signal_json: Json
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          signal_json: Json
          user_id: string
        }
        Update: {
          added_at?: string
          id?: string
          signal_json?: Json
          user_id?: string
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          uses_remaining: number | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          uses_remaining?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          uses_remaining?: number | null
        }
        Relationships: []
      }
      job_skill_map: {
        Row: {
          frequency: string
          id: string
          importance: number
          job_family: string
          skill_name: string
        }
        Insert: {
          frequency?: string
          id?: string
          importance?: number
          job_family: string
          skill_name: string
        }
        Update: {
          frequency?: string
          id?: string
          importance?: number
          job_family?: string
          skill_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_skill_map_job_family_fkey"
            columns: ["job_family"]
            isOneToOne: false
            referencedRelation: "job_taxonomy"
            referencedColumns: ["job_family"]
          },
          {
            foreignKeyName: "job_skill_map_skill_name_fkey"
            columns: ["skill_name"]
            isOneToOne: false
            referencedRelation: "skill_risk_matrix"
            referencedColumns: ["skill_name"]
          },
        ]
      }
      job_taxonomy: {
        Row: {
          ai_tools_replacing: Json
          automatable_tasks: Json
          avg_salary_lpa: number | null
          category: string
          created_at: string
          disruption_baseline: number
          id: string
          india_prevalence: number | null
          job_family: string
        }
        Insert: {
          ai_tools_replacing?: Json
          automatable_tasks?: Json
          avg_salary_lpa?: number | null
          category: string
          created_at?: string
          disruption_baseline?: number
          id?: string
          india_prevalence?: number | null
          job_family: string
        }
        Update: {
          ai_tools_replacing?: Json
          automatable_tasks?: Json
          avg_salary_lpa?: number | null
          category?: string
          created_at?: string
          disruption_baseline?: number
          id?: string
          india_prevalence?: number | null
          job_family?: string
        }
        Relationships: []
      }
      kg_node_overrides: {
        Row: {
          base_automation_prob: number | null
          confidence: number
          current_demand_trend: string | null
          partial_displacement_years: number | null
          role_id: string
          salary_percentile: number | null
          source: string | null
          updated_at: string
        }
        Insert: {
          base_automation_prob?: number | null
          confidence?: number
          current_demand_trend?: string | null
          partial_displacement_years?: number | null
          role_id: string
          salary_percentile?: number | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          base_automation_prob?: number | null
          confidence?: number
          current_demand_trend?: string | null
          partial_displacement_years?: number | null
          role_id?: string
          salary_percentile?: number | null
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      learning_path_progress: {
        Row: {
          created_at: string
          gap_key: string
          gap_title: string
          id: string
          marked_complete_at: string | null
          resource_url: string | null
          scan_id: string
          score_delta: number
          severity: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          gap_key: string
          gap_title: string
          id?: string
          marked_complete_at?: string | null
          resource_url?: string | null
          scan_id: string
          score_delta?: number
          severity?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          gap_key?: string
          gap_title?: string
          id?: string
          marked_complete_at?: string | null
          resource_url?: string | null
          scan_id?: string
          score_delta?: number
          severity?: string | null
          user_id?: string
        }
        Relationships: []
      }
      learning_resources: {
        Row: {
          created_at: string | null
          estimated_hours: number | null
          id: string
          last_verified_at: string
          platform: string | null
          skill_category: string
          source: string | null
          title: string
          url: string
        }
        Insert: {
          created_at?: string | null
          estimated_hours?: number | null
          id?: string
          last_verified_at?: string
          platform?: string | null
          skill_category: string
          source?: string | null
          title: string
          url: string
        }
        Update: {
          created_at?: string | null
          estimated_hours?: number | null
          id?: string
          last_verified_at?: string
          platform?: string | null
          skill_category?: string
          source?: string | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      learning_resources_cache: {
        Row: {
          bundle: Json
          cache_key: string
          created_at: string
          expires_at: string
          gap_title: string
          role_context: string | null
          source: string
        }
        Insert: {
          bundle?: Json
          cache_key: string
          created_at?: string
          expires_at?: string
          gap_title: string
          role_context?: string | null
          source?: string
        }
        Update: {
          bundle?: Json
          cache_key?: string
          created_at?: string
          expires_at?: string
          gap_title?: string
          role_context?: string | null
          source?: string
        }
        Relationships: []
      }
      linkedin_snapshots: {
        Row: {
          created_at: string
          data_retention_consent: boolean
          id: string
          linkedin_url: string
          raw_payload: Json
          scan_id: string
          scrape_confidence: string | null
          source_provider: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data_retention_consent?: boolean
          id?: string
          linkedin_url: string
          raw_payload?: Json
          scan_id: string
          scrape_confidence?: string | null
          source_provider?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data_retention_consent?: boolean
          id?: string
          linkedin_url?: string
          raw_payload?: Json
          scan_id?: string
          scrape_confidence?: string | null
          source_provider?: string
          user_id?: string | null
        }
        Relationships: []
      }
      market_signals: {
        Row: {
          ai_job_mentions_pct: number | null
          avg_salary_change_pct: number | null
          created_at: string
          id: string
          job_family: string
          market_health: string
          metro_tier: string
          posting_change_pct: number | null
          posting_volume_30d: number | null
          posting_volume_note: string | null
          posting_volume_proxy: number | null
          posting_volume_source: string | null
          snapshot_date: string
        }
        Insert: {
          ai_job_mentions_pct?: number | null
          avg_salary_change_pct?: number | null
          created_at?: string
          id?: string
          job_family: string
          market_health?: string
          metro_tier?: string
          posting_change_pct?: number | null
          posting_volume_30d?: number | null
          posting_volume_note?: string | null
          posting_volume_proxy?: number | null
          posting_volume_source?: string | null
          snapshot_date?: string
        }
        Update: {
          ai_job_mentions_pct?: number | null
          avg_salary_change_pct?: number | null
          created_at?: string
          id?: string
          job_family?: string
          market_health?: string
          metro_tier?: string
          posting_change_pct?: number | null
          posting_volume_30d?: number | null
          posting_volume_note?: string | null
          posting_volume_proxy?: number | null
          posting_volume_source?: string | null
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_signals_job_family_fkey"
            columns: ["job_family"]
            isOneToOne: false
            referencedRelation: "job_taxonomy"
            referencedColumns: ["job_family"]
          },
        ]
      }
      model_b_results: {
        Row: {
          analysis_id: string | null
          ats_avg: number | null
          card_data: Json | null
          created_at: string | null
          gemini_raw: Json | null
          id: string
          job_match_count: number | null
          resume_filename: string | null
          risk_score: number | null
          shield_score: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          analysis_id?: string | null
          ats_avg?: number | null
          card_data?: Json | null
          created_at?: string | null
          gemini_raw?: Json | null
          id?: string
          job_match_count?: number | null
          resume_filename?: string | null
          risk_score?: number | null
          shield_score?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          analysis_id?: string | null
          ats_avg?: number | null
          card_data?: Json | null
          created_at?: string | null
          gemini_raw?: Json | null
          id?: string
          job_match_count?: number | null
          resume_filename?: string | null
          risk_score?: number | null
          shield_score?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_b_results_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_alerts: {
        Row: {
          acknowledged: boolean
          alert_type: string
          created_at: string
          function_name: string | null
          id: string
          message: string
          severity: string
        }
        Insert: {
          acknowledged?: boolean
          alert_type: string
          created_at?: string
          function_name?: string | null
          id?: string
          message: string
          severity?: string
        }
        Update: {
          acknowledged?: boolean
          alert_type?: string
          created_at?: string
          function_name?: string | null
          id?: string
          message?: string
          severity?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_paise: number
          created_at: string
          currency: string
          id: string
          plan_type: string
          razorpay_payment_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          currency?: string
          id?: string
          plan_type?: string
          razorpay_payment_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          currency?: string
          id?: string
          plan_type?: string
          razorpay_payment_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      processed_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string | null
          id: string
          payload: Json | null
          provider: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type?: string | null
          id?: string
          payload?: Json | null
          provider: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string | null
          id?: string
          payload?: Json | null
          provider?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          coach_questions_used: number | null
          coach_usage_reset_at: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          referral_code: string | null
          referred_by: string | null
          subscription_expires_at: string | null
          subscription_tier: string | null
        }
        Insert: {
          coach_questions_used?: number | null
          coach_usage_reset_at?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          referral_code?: string | null
          referred_by?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
        }
        Update: {
          coach_questions_used?: number | null
          coach_usage_reset_at?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          referral_code?: string | null
          referred_by?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
        }
        Relationships: []
      }
      referral_pro_grants: {
        Row: {
          expires_at: string
          grant_reason: string | null
          granted_at: string | null
          id: string
          referral_count: number | null
          user_id: string
        }
        Insert: {
          expires_at: string
          grant_reason?: string | null
          granted_at?: string | null
          id?: string
          referral_count?: number | null
          user_id: string
        }
        Update: {
          expires_at?: string
          grant_reason?: string | null
          granted_at?: string | null
          id?: string
          referral_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          converted_at: string | null
          created_at: string | null
          id: string
          referee_scan_id: string | null
          referee_user_id: string | null
          referral_code: string
          referrer_user_id: string
          status: string
        }
        Insert: {
          converted_at?: string | null
          created_at?: string | null
          id?: string
          referee_scan_id?: string | null
          referee_user_id?: string | null
          referral_code: string
          referrer_user_id: string
          status?: string
        }
        Update: {
          converted_at?: string | null
          created_at?: string | null
          id?: string
          referee_scan_id?: string | null
          referee_user_id?: string | null
          referral_code?: string
          referrer_user_id?: string
          status?: string
        }
        Relationships: []
      }
      resume_artifacts: {
        Row: {
          created_at: string
          data_retention_consent: boolean
          extracted_years_experience: number | null
          extraction_confidence: string | null
          extraction_model: string | null
          id: string
          missing_fields: Json | null
          parsed_json: Json | null
          parser_version: string | null
          raw_text: string | null
          resume_file_path: string | null
          scan_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data_retention_consent?: boolean
          extracted_years_experience?: number | null
          extraction_confidence?: string | null
          extraction_model?: string | null
          id?: string
          missing_fields?: Json | null
          parsed_json?: Json | null
          parser_version?: string | null
          raw_text?: string | null
          resume_file_path?: string | null
          scan_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data_retention_consent?: boolean
          extracted_years_experience?: number | null
          extraction_confidence?: string | null
          extraction_model?: string | null
          id?: string
          missing_fields?: Json | null
          parsed_json?: Json | null
          parser_version?: string | null
          raw_text?: string | null
          resume_file_path?: string | null
          scan_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      scan_feedback: {
        Row: {
          accuracy_rating: number | null
          created_at: string | null
          feedback_text: string | null
          id: string
          relevance_rating: number | null
          scan_id: string
        }
        Insert: {
          accuracy_rating?: number | null
          created_at?: string | null
          feedback_text?: string | null
          id?: string
          relevance_rating?: number | null
          scan_id: string
        }
        Update: {
          accuracy_rating?: number | null
          created_at?: string | null
          feedback_text?: string | null
          id?: string
          relevance_rating?: number | null
          scan_id?: string
        }
        Relationships: []
      }
      scan_outcomes: {
        Row: {
          captured_at: string
          days_since_scan: number | null
          id: string
          outcome: string
          scan_country: string | null
          scan_determinism_index: number | null
          scan_id: string
          scan_industry: string | null
          scan_role: string | null
          scan_seniority: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          captured_at?: string
          days_since_scan?: number | null
          id?: string
          outcome: string
          scan_country?: string | null
          scan_determinism_index?: number | null
          scan_id: string
          scan_industry?: string | null
          scan_role?: string | null
          scan_seniority?: string | null
          source?: string
          user_id?: string | null
        }
        Update: {
          captured_at?: string
          days_since_scan?: number | null
          id?: string
          outcome?: string
          scan_country?: string | null
          scan_determinism_index?: number | null
          scan_id?: string
          scan_industry?: string | null
          scan_role?: string | null
          scan_seniority?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      scan_rate_limits: {
        Row: {
          client_ip: string
          created_at: string
          id: string
          scan_count: number
          window_end: string
          window_start: string
        }
        Insert: {
          client_ip: string
          created_at?: string
          id?: string
          scan_count?: number
          window_end?: string
          window_start?: string
        }
        Update: {
          client_ip?: string
          created_at?: string
          id?: string
          scan_count?: number
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      scan_vectors: {
        Row: {
          created_at: string
          doom_clock_months: number | null
          embedding: number[]
          industry: string | null
          role_family: string | null
          scan_id: string
          semantic_embedding: string | null
          semantic_model: string | null
          seniority_tier: string | null
          stability_score: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          doom_clock_months?: number | null
          embedding: number[]
          industry?: string | null
          role_family?: string | null
          scan_id: string
          semantic_embedding?: string | null
          semantic_model?: string | null
          seniority_tier?: string | null
          stability_score?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          doom_clock_months?: number | null
          embedding?: number[]
          industry?: string | null
          role_family?: string | null
          scan_id?: string
          semantic_embedding?: string | null
          semantic_model?: string | null
          seniority_tier?: string | null
          stability_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      scans: {
        Row: {
          access_token: string | null
          career_reality_check_data: Json | null
          country: string | null
          created_at: string
          data_retention_consent: boolean
          determinism_index: number | null
          dpdp_consent_at: string | null
          dpdp_consent_given: boolean | null
          enrichment_cache: Json | null
          enrichment_cached_at: string | null
          estimated_monthly_salary_inr: number | null
          feedback_flag: string | null
          final_json_report: Json | null
          id: string
          industry: string | null
          linkedin_url: string | null
          metro_tier: string | null
          ml_insights_cached_at: string | null
          ml_insights_hash: string | null
          months_remaining: number | null
          payment_status: string | null
          resume_file_path: string | null
          role_detected: string | null
          salary_bleed_monthly: number | null
          scan_status: string | null
          user_id: string | null
          years_experience: string | null
        }
        Insert: {
          access_token?: string | null
          career_reality_check_data?: Json | null
          country?: string | null
          created_at?: string
          data_retention_consent?: boolean
          determinism_index?: number | null
          dpdp_consent_at?: string | null
          dpdp_consent_given?: boolean | null
          enrichment_cache?: Json | null
          enrichment_cached_at?: string | null
          estimated_monthly_salary_inr?: number | null
          feedback_flag?: string | null
          final_json_report?: Json | null
          id?: string
          industry?: string | null
          linkedin_url?: string | null
          metro_tier?: string | null
          ml_insights_cached_at?: string | null
          ml_insights_hash?: string | null
          months_remaining?: number | null
          payment_status?: string | null
          resume_file_path?: string | null
          role_detected?: string | null
          salary_bleed_monthly?: number | null
          scan_status?: string | null
          user_id?: string | null
          years_experience?: string | null
        }
        Update: {
          access_token?: string | null
          career_reality_check_data?: Json | null
          country?: string | null
          created_at?: string
          data_retention_consent?: boolean
          determinism_index?: number | null
          dpdp_consent_at?: string | null
          dpdp_consent_given?: boolean | null
          enrichment_cache?: Json | null
          enrichment_cached_at?: string | null
          estimated_monthly_salary_inr?: number | null
          feedback_flag?: string | null
          final_json_report?: Json | null
          id?: string
          industry?: string | null
          linkedin_url?: string | null
          metro_tier?: string | null
          ml_insights_cached_at?: string | null
          ml_insights_hash?: string | null
          months_remaining?: number | null
          payment_status?: string | null
          resume_file_path?: string | null
          role_detected?: string | null
          salary_bleed_monthly?: number | null
          scan_status?: string | null
          user_id?: string | null
          years_experience?: string | null
        }
        Relationships: []
      }
      score_events: {
        Row: {
          created_at: string
          delta: number | null
          event_type: string
          id: string
          metadata: Json | null
          scan_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta?: number | null
          event_type: string
          id?: string
          metadata?: Json | null
          scan_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number | null
          event_type?: string
          id?: string
          metadata?: Json | null
          scan_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      score_history: {
        Row: {
          created_at: string
          delta_summary: Json | null
          determinism_index: number
          id: string
          industry: string | null
          moat_score: number | null
          role_detected: string | null
          scan_id: string
          survivability_score: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta_summary?: Json | null
          determinism_index: number
          id?: string
          industry?: string | null
          moat_score?: number | null
          role_detected?: string | null
          scan_id: string
          survivability_score?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta_summary?: Json | null
          determinism_index?: number
          id?: string
          industry?: string | null
          moat_score?: number | null
          role_detected?: string | null
          scan_id?: string
          survivability_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      sector_pulse_cache: {
        Row: {
          beats: Json
          city: string
          created_at: string
          fetched_at: string
          id: string
          reason: string | null
          sector: string
        }
        Insert: {
          beats?: Json
          city: string
          created_at?: string
          fetched_at?: string
          id?: string
          reason?: string | null
          sector: string
        }
        Update: {
          beats?: Json
          city?: string
          created_at?: string
          fetched_at?: string
          id?: string
          reason?: string | null
          sector?: string
        }
        Relationships: []
      }
      share_events: {
        Row: {
          assessment_id: string | null
          created_at: string
          fate_card_id: string | null
          id: string
          platform: string
          referrer: string | null
          user_agent: string | null
        }
        Insert: {
          assessment_id?: string | null
          created_at?: string
          fate_card_id?: string | null
          id?: string
          platform?: string
          referrer?: string | null
          user_agent?: string | null
        }
        Update: {
          assessment_id?: string | null
          created_at?: string
          fate_card_id?: string | null
          id?: string
          platform?: string
          referrer?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_events_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_events_fate_card_id_fkey"
            columns: ["fate_card_id"]
            isOneToOne: false
            referencedRelation: "fate_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_predictions: {
        Row: {
          actual_half_life_months: number | null
          actual_risk_score: number | null
          calibration_input: Json | null
          direction_correct: boolean | null
          doom_clock_months: number | null
          error_pct: number | null
          id: string
          model_version: string | null
          months_elapsed: number | null
          predicted_at: string
          predicted_half_life_months: number
          predicted_risk_score: number
          scan_id: string
          skill_name: string
          user_id: string
          validated: boolean
          validated_at: string | null
        }
        Insert: {
          actual_half_life_months?: number | null
          actual_risk_score?: number | null
          calibration_input?: Json | null
          direction_correct?: boolean | null
          doom_clock_months?: number | null
          error_pct?: number | null
          id?: string
          model_version?: string | null
          months_elapsed?: number | null
          predicted_at?: string
          predicted_half_life_months?: number
          predicted_risk_score?: number
          scan_id: string
          skill_name: string
          user_id: string
          validated?: boolean
          validated_at?: string | null
        }
        Update: {
          actual_half_life_months?: number | null
          actual_risk_score?: number | null
          calibration_input?: Json | null
          direction_correct?: boolean | null
          doom_clock_months?: number | null
          error_pct?: number | null
          id?: string
          model_version?: string | null
          months_elapsed?: number | null
          predicted_at?: string
          predicted_half_life_months?: number
          predicted_risk_score?: number
          scan_id?: string
          skill_name?: string
          user_id?: string
          validated?: boolean
          validated_at?: string | null
        }
        Relationships: []
      }
      skill_risk_matrix: {
        Row: {
          ai_augmentation_potential: number
          ai_tool_native: boolean
          automation_risk: number
          bpo_template_flag: boolean
          category: string
          created_at: string
          feedback_adjustment: number | null
          feedback_count: number | null
          human_moat: string | null
          id: string
          india_demand_trend: string
          india_specific: boolean
          learning_curve: string | null
          replacement_tools: string[]
          skill_name: string
          vernacular_moat: boolean
        }
        Insert: {
          ai_augmentation_potential?: number
          ai_tool_native?: boolean
          automation_risk?: number
          bpo_template_flag?: boolean
          category?: string
          created_at?: string
          feedback_adjustment?: number | null
          feedback_count?: number | null
          human_moat?: string | null
          id?: string
          india_demand_trend?: string
          india_specific?: boolean
          learning_curve?: string | null
          replacement_tools?: string[]
          skill_name: string
          vernacular_moat?: boolean
        }
        Update: {
          ai_augmentation_potential?: number
          ai_tool_native?: boolean
          automation_risk?: number
          bpo_template_flag?: boolean
          category?: string
          created_at?: string
          feedback_adjustment?: number | null
          feedback_count?: number | null
          human_moat?: string | null
          id?: string
          india_demand_trend?: string
          india_specific?: boolean
          learning_curve?: string | null
          replacement_tools?: string[]
          skill_name?: string
          vernacular_moat?: boolean
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      token_usage_log: {
        Row: {
          agent_name: string | null
          completion_tokens: number | null
          created_at: string
          estimated_cost_usd: number | null
          function_name: string
          id: string
          model: string
          prompt_tokens: number | null
          total_tokens: number | null
        }
        Insert: {
          agent_name?: string | null
          completion_tokens?: number | null
          created_at?: string
          estimated_cost_usd?: number | null
          function_name: string
          id?: string
          model: string
          prompt_tokens?: number | null
          total_tokens?: number | null
        }
        Update: {
          agent_name?: string | null
          completion_tokens?: number | null
          created_at?: string
          estimated_cost_usd?: number | null
          function_name?: string
          id?: string
          model?: string
          prompt_tokens?: number | null
          total_tokens?: number | null
        }
        Relationships: []
      }
      trajectory_predictions: {
        Row: {
          cohort_median_delta: number | null
          cohort_size: number | null
          computed_at: string
          confidence: string | null
          predicted_score_180d: number | null
          predicted_score_30d: number | null
          predicted_score_90d: number | null
          scan_id: string
          top_actions: Json | null
        }
        Insert: {
          cohort_median_delta?: number | null
          cohort_size?: number | null
          computed_at?: string
          confidence?: string | null
          predicted_score_180d?: number | null
          predicted_score_30d?: number | null
          predicted_score_90d?: number | null
          scan_id: string
          top_actions?: Json | null
        }
        Update: {
          cohort_median_delta?: number | null
          cohort_size?: number | null
          computed_at?: string
          confidence?: string | null
          predicted_score_180d?: number | null
          predicted_score_30d?: number | null
          predicted_score_90d?: number | null
          scan_id?: string
          top_actions?: Json | null
        }
        Relationships: []
      }
      user_action_signals: {
        Row: {
          action_payload: Json | null
          action_type: string
          created_at: string
          id: string
          scan_city: string | null
          scan_id: string | null
          scan_industry: string | null
          scan_role: string | null
          scan_score: number | null
          user_id: string | null
        }
        Insert: {
          action_payload?: Json | null
          action_type: string
          created_at?: string
          id?: string
          scan_city?: string | null
          scan_id?: string | null
          scan_industry?: string | null
          scan_role?: string | null
          scan_score?: number | null
          user_id?: string | null
        }
        Update: {
          action_payload?: Json | null
          action_type?: string
          created_at?: string
          id?: string
          scan_city?: string | null
          scan_id?: string | null
          scan_industry?: string | null
          scan_role?: string | null
          scan_score?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_stories: {
        Row: {
          action: string
          created_at: string
          id: string
          reflection: string | null
          result: string
          situation: string
          source_scan_id: string | null
          tags: string[]
          task: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          reflection?: string | null
          result: string
          situation: string
          source_scan_id?: string | null
          tags?: string[]
          task: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          reflection?: string | null
          result?: string
          situation?: string
          source_scan_id?: string | null
          tags?: string[]
          task?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_briefs: {
        Row: {
          brief_json: Json
          created_at: string | null
          id: string
          scan_id: string
        }
        Insert: {
          brief_json: Json
          created_at?: string | null
          id?: string
          scan_id: string
        }
        Update: {
          brief_json?: Json
          created_at?: string | null
          id?: string
          scan_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      scan_accuracy_by_family: {
        Row: {
          avg_accuracy: number | null
          avg_relevance: number | null
          feedback_count: number | null
          industry: string | null
          job_family: string | null
          low_accuracy_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_and_increment_coach_usage: {
        Args: { _user_id: string }
        Returns: {
          allowed: boolean
          questions_remaining: number
          questions_used: number
        }[]
      }
      cleanup_expired_cache: { Args: never; Returns: undefined }
      cleanup_expired_rate_limits: { Args: never; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_panic_overview: {
        Args: never
        Returns: {
          booming_roles: number
          declining_roles: number
          total_roles: number
        }[]
      }
      get_public_feature_flags: {
        Args: never
        Returns: {
          description: string
          enabled_percentage: number
          flag_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      purge_unconsented_artifacts: {
        Args: never
        Returns: {
          linkedin_snapshots_deleted: number
          resume_artifacts_deleted: number
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
