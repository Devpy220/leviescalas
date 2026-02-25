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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_broadcasts: {
        Row: {
          admin_user_id: string
          channels_used: string[]
          created_at: string
          email_sent: number
          id: string
          message: string
          push_sent: number
          recipients_count: number
          sms_sent: number
          telegram_sent: number
          title: string
          whatsapp_sent: number
        }
        Insert: {
          admin_user_id: string
          channels_used?: string[]
          created_at?: string
          email_sent?: number
          id?: string
          message: string
          push_sent?: number
          recipients_count?: number
          sms_sent?: number
          telegram_sent?: number
          title: string
          whatsapp_sent?: number
        }
        Update: {
          admin_user_id?: string
          channels_used?: string[]
          created_at?: string
          email_sent?: number
          id?: string
          message?: string
          push_sent?: number
          recipients_count?: number
          sms_sent?: number
          telegram_sent?: number
          title?: string
          whatsapp_sent?: number
        }
        Relationships: []
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "department_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_roles: {
        Row: {
          color: string
          created_at: string
          department_id: string
          description: string | null
          icon: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          department_id: string
          description?: string | null
          icon?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          department_id?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_access_audit: {
        Row: {
          action: string
          created_at: string | null
          department_id: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          department_id: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          department_id?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      calendar_sync_tokens: {
        Row: {
          created_at: string
          id: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      churches: {
        Row: {
          address: string | null
          city: string | null
          cnpj: string | null
          code: string
          created_at: string
          description: string | null
          email: string | null
          id: string
          leader_id: string
          logo_url: string | null
          name: string
          phone: string | null
          slug: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          code: string
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          leader_id: string
          logo_url?: string | null
          name: string
          phone?: string | null
          slug?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          code?: string
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          leader_id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          slug?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      department_announcements: {
        Row: {
          author_id: string
          content: string
          created_at: string
          department_id: string
          id: string
          is_pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          department_id: string
          id?: string
          is_pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          department_id?: string
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_announcements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          avatar_url: string | null
          church_id: string | null
          created_at: string
          description: string | null
          id: string
          invite_code: string
          leader_id: string
          name: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          church_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          leader_id: string
          name: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          church_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          leader_id?: string
          name?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      login_logs: {
        Row: {
          id: string
          logged_in_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          logged_in_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          logged_in_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      member_availability: {
        Row: {
          created_at: string
          day_of_week: number
          department_id: string
          id: string
          is_available: boolean
          period_start: string
          time_end: string
          time_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          department_id: string
          id?: string
          is_available?: boolean
          period_start?: string
          time_end: string
          time_start: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          department_id?: string
          id?: string
          is_available?: boolean
          period_start?: string
          time_end?: string
          time_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      member_date_availability: {
        Row: {
          created_at: string
          date: string
          department_id: string
          id: string
          is_available: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          department_id: string
          id?: string
          is_available?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          department_id?: string
          id?: string
          is_available?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      member_preferences: {
        Row: {
          blackout_dates: string[] | null
          created_at: string
          department_id: string
          id: string
          max_schedules_per_month: number
          min_days_between_schedules: number
          preferred_sector_ids: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          blackout_dates?: string[] | null
          created_at?: string
          department_id: string
          id?: string
          max_schedules_per_month?: number
          min_days_between_schedules?: number
          preferred_sector_ids?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          blackout_dates?: string[] | null
          created_at?: string
          department_id?: string
          id?: string
          max_schedules_per_month?: number
          min_days_between_schedules?: number
          preferred_sector_ids?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          department_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          department_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          department_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          message: string
          read_at: string | null
          schedule_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          message: string
          read_at?: string | null
          schedule_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          message?: string
          read_at?: string | null
          schedule_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          created_at: string
          id: string
          page_path: string
          referrer: string | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          page_path: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          page_path?: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      payment_receipts: {
        Row: {
          department_id: string
          id: string
          notes: string | null
          receipt_url: string
          status: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          department_id: string
          id?: string
          notes?: string | null
          receipt_url: string
          status?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          department_id?: string
          id?: string
          notes?: string | null
          receipt_url?: string
          status?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_access_audit: {
        Row: {
          accessed_at: string | null
          accessed_profile_id: string
          accessor_user_id: string
          department_id: string | null
          id: string
        }
        Insert: {
          accessed_at?: string | null
          accessed_profile_id: string
          accessor_user_id: string
          department_id?: string | null
          id?: string
        }
        Update: {
          accessed_at?: string | null
          accessed_profile_id?: string
          accessor_user_id?: string
          department_id?: string | null
          id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          invited_by_department_id: string | null
          name: string
          share_contact: boolean | null
          updated_at: string
          whatsapp: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          invited_by_department_id?: string | null
          name: string
          share_contact?: boolean | null
          updated_at?: string
          whatsapp: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by_department_id?: string | null
          name?: string
          share_contact?: boolean | null
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_invited_by_department_id_fkey"
            columns: ["invited_by_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pushalert_subscribers: {
        Row: {
          created_at: string
          id: string
          subscriber_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subscriber_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subscriber_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          ip_address: unknown
          request_count: number
          user_id: string | null
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          ip_address?: unknown
          request_count?: number
          user_id?: string | null
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: unknown
          request_count?: number
          user_id?: string | null
          window_start?: string
        }
        Relationships: []
      }
      schedule_reminders_sent: {
        Row: {
          id: string
          reminder_type: string
          schedule_id: string
          sent_at: string
        }
        Insert: {
          id?: string
          reminder_type: string
          schedule_id: string
          sent_at?: string
        }
        Update: {
          id?: string
          reminder_type?: string
          schedule_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_reminders_sent_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_reminders_sent_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules_public"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_swaps: {
        Row: {
          created_at: string
          department_id: string
          id: string
          reason: string | null
          requester_schedule_id: string
          requester_user_id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["swap_status"]
          target_schedule_id: string
          target_user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          reason?: string | null
          requester_schedule_id: string
          requester_user_id: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["swap_status"]
          target_schedule_id: string
          target_user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          reason?: string | null
          requester_schedule_id?: string
          requester_user_id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["swap_status"]
          target_schedule_id?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_swaps_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_swaps_requester_schedule_id_fkey"
            columns: ["requester_schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_swaps_requester_schedule_id_fkey"
            columns: ["requester_schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_swaps_target_schedule_id_fkey"
            columns: ["target_schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_swaps_target_schedule_id_fkey"
            columns: ["target_schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules_public"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          assignment_role: string | null
          confirmation_status: Database["public"]["Enums"]["confirmation_status"]
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string
          date: string
          decline_reason: string | null
          department_id: string
          id: string
          notes: string | null
          sector_id: string | null
          time_end: string
          time_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignment_role?: string | null
          confirmation_status?: Database["public"]["Enums"]["confirmation_status"]
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by: string
          date: string
          decline_reason?: string | null
          department_id: string
          id?: string
          notes?: string | null
          sector_id?: string | null
          time_end: string
          time_start: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignment_role?: string | null
          confirmation_status?: Database["public"]["Enums"]["confirmation_status"]
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string
          date?: string
          decline_reason?: string | null
          department_id?: string
          id?: string
          notes?: string | null
          sector_id?: string | null
          time_end?: string
          time_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          color: string
          created_at: string
          department_id: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          department_id: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          department_id?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sectors_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_link_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          used: boolean
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          used?: boolean
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      telegram_links: {
        Row: {
          chat_id: number
          id: string
          is_active: boolean
          linked_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          chat_id: number
          id?: string
          is_active?: boolean
          linked_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          chat_id?: number
          id?: string
          is_active?: boolean
          linked_at?: string
          user_id?: string
          username?: string | null
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      schedules_public: {
        Row: {
          assignment_role: string | null
          confirmation_status:
            | Database["public"]["Enums"]["confirmation_status"]
            | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string | null
          created_by: string | null
          date: string | null
          decline_reason: string | null
          department_id: string | null
          id: string | null
          notes: string | null
          sector_id: string | null
          time_end: string | null
          time_start: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          assignment_role?: string | null
          confirmation_status?:
            | Database["public"]["Enums"]["confirmation_status"]
            | null
          confirmation_token?: never
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          decline_reason?: never
          department_id?: string | null
          id?: string | null
          notes?: never
          sector_id?: string | null
          time_end?: string | null
          time_start?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          assignment_role?: string | null
          confirmation_status?:
            | Database["public"]["Enums"]["confirmation_status"]
            | null
          confirmation_token?: never
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          decline_reason?: never
          department_id?: string | null
          id?: string | null
          notes?: never
          sector_id?: string | null
          time_end?: string | null
          time_start?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_create_church: {
        Args: {
          p_address?: string
          p_city?: string
          p_description?: string
          p_email?: string
          p_name: string
          p_phone?: string
          p_slug: string
          p_state?: string
        }
        Returns: string
      }
      admin_delete_church: { Args: { church_id: string }; Returns: boolean }
      admin_delete_department: { Args: { dept_id: string }; Returns: boolean }
      admin_delete_member: { Args: { member_id: string }; Returns: boolean }
      admin_delete_volunteer: { Args: { profile_id: string }; Returns: boolean }
      check_cross_department_conflicts: {
        Args: {
          p_date: string
          p_exclude_department_id: string
          p_time_end: string
          p_time_start: string
          p_user_ids: string[]
        }
        Returns: {
          conflict_department_name: string
          user_id: string
        }[]
      }
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_max_requests: number
          p_user_id: string
          p_window_minutes: number
        }
        Returns: boolean
      }
      check_rate_limit_public: {
        Args: {
          p_endpoint: string
          p_max_requests: number
          p_window_minutes: number
        }
        Returns: boolean
      }
      ensure_admin_role: { Args: never; Returns: boolean }
      execute_schedule_swap: { Args: { swap_id: string }; Returns: undefined }
      generate_church_code: { Args: never; Returns: string }
      get_all_departments_admin: {
        Args: never
        Returns: {
          created_at: string
          description: string
          id: string
          leader_id: string
          leader_name: string
          member_count: number
          name: string
        }[]
      }
      get_all_profiles_admin: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          name: string
          whatsapp: string
        }[]
      }
      get_all_profiles_with_departments: {
        Args: never
        Returns: {
          church_name: string
          created_at: string
          department_name: string
          email: string
          id: string
          name: string
          whatsapp: string
        }[]
      }
      get_billing_audit_logs: {
        Args: { dept_id: string; limit_count?: number }
        Returns: {
          action: string
          created_at: string
          id: string
          user_id: string
          user_name: string
        }[]
      }
      get_church_departments: {
        Args: { p_church_id: string }
        Returns: {
          created_at: string
          description: string
          id: string
          leader_id: string
          leader_name: string
          member_count: number
          name: string
        }[]
      }
      get_church_departments_public: {
        Args: { p_church_id: string }
        Returns: {
          avatar_url: string
          description: string
          id: string
          member_count: number
          name: string
        }[]
      }
      get_church_invite_info: {
        Args: { p_code: string }
        Returns: {
          church_name: string
          church_slug: string
          is_valid: boolean
        }[]
      }
      get_church_public: {
        Args: { p_slug: string }
        Returns: {
          address: string
          city: string
          description: string
          id: string
          logo_url: string
          name: string
          state: string
        }[]
      }
      get_church_schedules_public: {
        Args: { p_church_id: string; p_end_date: string; p_start_date: string }
        Returns: {
          date: string
          department_avatar: string
          department_name: string
          id: string
          time_end: string
          time_start: string
        }[]
      }
      get_department_basic: {
        Args: { dept_id: string }
        Returns: {
          avatar_url: string
          church_id: string
          created_at: string
          description: string
          id: string
          leader_id: string
          name: string
          subscription_status: string
          updated_at: string
        }[]
      }
      get_department_by_invite_code: {
        Args: { code: string }
        Returns: {
          description: string
          id: string
          name: string
        }[]
      }
      get_department_contacts: {
        Args: { dept_id: string }
        Returns: {
          avatar_url: string
          email: string
          id: string
          name: string
          role: string
          share_contact: boolean
          whatsapp: string
        }[]
      }
      get_department_for_member: {
        Args: { dept_id: string }
        Returns: {
          created_at: string
          description: string
          id: string
          invite_code: string
          leader_id: string
          name: string
          updated_at: string
        }[]
      }
      get_department_full: {
        Args: { dept_id: string }
        Returns: {
          created_at: string
          description: string
          id: string
          invite_code: string
          leader_id: string
          name: string
          stripe_customer_id: string
          stripe_subscription_id: string
          subscription_status: string
          trial_ends_at: string
          updated_at: string
        }[]
      }
      get_department_member_profiles: {
        Args: { dept_id: string }
        Returns: {
          avatar_url: string
          id: string
          joined_at: string
          name: string
          role: string
        }[]
      }
      get_department_members_admin: {
        Args: { dept_id: string }
        Returns: {
          email: string
          id: string
          joined_at: string
          name: string
          role: string
          user_id: string
        }[]
      }
      get_department_secure: {
        Args: { dept_id: string }
        Returns: {
          avatar_url: string
          created_at: string
          description: string
          id: string
          invite_code: string
          leader_id: string
          name: string
          stripe_customer_id: string
          stripe_subscription_id: string
          subscription_status: string
          trial_ends_at: string
          updated_at: string
          user_role: string
        }[]
      }
      get_member_full_profile: {
        Args: { dept_id: string; member_user_id: string }
        Returns: {
          avatar_url: string
          email: string
          id: string
          name: string
          whatsapp: string
        }[]
      }
      get_member_profile: {
        Args: { member_user_id: string }
        Returns: {
          avatar_url: string
          id: string
          name: string
        }[]
      }
      get_my_department_count:
        | { Args: never; Returns: number }
        | { Args: { p_user_id?: string }; Returns: number }
      get_schedule_for_user: {
        Args: { dept_id: string; target_user_id: string }
        Returns: {
          created_by: string
          date: string
          id: string
          notes: string
          time_end: string
          time_start: string
          user_id: string
        }[]
      }
      get_user_count: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_department_leader: {
        Args: { _department_id: string; _user_id: string }
        Returns: boolean
      }
      is_department_member: {
        Args: { _department_id: string; _user_id: string }
        Returns: boolean
      }
      join_department_by_invite: {
        Args: { invite_code: string }
        Returns: {
          department_id: string
          department_name: string
          message: string
          success: boolean
        }[]
      }
      log_billing_audit: {
        Args: {
          p_action: string
          p_department_id: string
          p_ip_address?: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      update_contact_privacy: { Args: { share: boolean }; Returns: undefined }
      validate_church_code: {
        Args: { p_code: string }
        Returns: {
          id: string
          is_valid: boolean
          name: string
        }[]
      }
      validate_church_code_secure: {
        Args: { p_code: string }
        Returns: {
          church_name: string
          is_valid: boolean
        }[]
      }
      validate_invite_code_secure: {
        Args: { code: string }
        Returns: {
          department_name: string
          is_valid: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      confirmation_status: "pending" | "confirmed" | "declined"
      member_role: "leader" | "member"
      notification_status: "pending" | "sent" | "failed"
      subscription_status:
        | "active"
        | "trial"
        | "cancelled"
        | "expired"
        | "pending"
      swap_status: "pending" | "accepted" | "rejected" | "cancelled"
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
      confirmation_status: ["pending", "confirmed", "declined"],
      member_role: ["leader", "member"],
      notification_status: ["pending", "sent", "failed"],
      subscription_status: [
        "active",
        "trial",
        "cancelled",
        "expired",
        "pending",
      ],
      swap_status: ["pending", "accepted", "rejected", "cancelled"],
    },
  },
} as const
