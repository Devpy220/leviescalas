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
      app_runtime_secrets: {
        Row: {
          created_at: string
          name: string
          secret_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          name: string
          secret_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          name?: string
          secret_value?: string
          updated_at?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "assignment_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments_safe"
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
      blackout_collection_prompts: {
        Row: {
          id: string
          parsed_dates: string[] | null
          responded_at: string | null
          sent_at: string
          target_month: string
          user_id: string
        }
        Insert: {
          id?: string
          parsed_dates?: string[] | null
          responded_at?: string | null
          sent_at?: string
          target_month: string
          user_id: string
        }
        Update: {
          id?: string
          parsed_dates?: string[] | null
          responded_at?: string | null
          sent_at?: string
          target_month?: string
          user_id?: string
        }
        Relationships: []
      }
      cakto_offers: {
        Row: {
          active: boolean
          amount_cents: number
          checkout_url: string
          created_at: string
          id: string
          label: string
          mode: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_cents: number
          checkout_url: string
          created_at?: string
          id?: string
          label: string
          mode: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_cents?: number
          checkout_url?: string
          created_at?: string
          id?: string
          label?: string
          mode?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      cakto_products: {
        Row: {
          amount_cents: number | null
          cakto_offer_id: string | null
          cakto_price_id: string | null
          cakto_product_id: string | null
          created_at: string
          id: string
          kind: string
          metadata: Json
          updated_at: string
        }
        Insert: {
          amount_cents?: number | null
          cakto_offer_id?: string | null
          cakto_price_id?: string | null
          cakto_product_id?: string | null
          created_at?: string
          id?: string
          kind: string
          metadata?: Json
          updated_at?: string
        }
        Update: {
          amount_cents?: number | null
          cakto_offer_id?: string | null
          cakto_price_id?: string | null
          cakto_product_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          updated_at?: string
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
          leader_id: string | null
          logo_url: string | null
          name: string
          phone: string | null
          registrant_email: string | null
          registrant_name: string | null
          registrant_phone: string | null
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
          leader_id?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          registrant_email?: string | null
          registrant_name?: string | null
          registrant_phone?: string | null
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
          leader_id?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          registrant_email?: string | null
          registrant_name?: string | null
          registrant_phone?: string | null
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
          whatsapp_notified: boolean
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
          whatsapp_notified?: boolean
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
          whatsapp_notified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "department_announcements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_announcements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      department_coordinators: {
        Row: {
          created_at: string
          department_id: string
          id: string
          invited_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          invited_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          invited_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          allow_sunday_double: boolean
          avatar_url: string | null
          church_id: string | null
          coordinator_invite_code: string
          created_at: string
          description: string | null
          id: string
          invite_code: string
          leader_id: string
          max_blackout_dates: number
          name: string
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          allow_sunday_double?: boolean
          avatar_url?: string | null
          church_id?: string | null
          coordinator_invite_code?: string
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          leader_id: string
          max_blackout_dates?: number
          name: string
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          allow_sunday_double?: boolean
          avatar_url?: string | null
          church_id?: string | null
          coordinator_invite_code?: string
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          leader_id?: string
          max_blackout_dates?: number
          name?: string
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
            foreignKeyName: "departments_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches_member_view"
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
      donations: {
        Row: {
          amount_cents: number
          cakto_payment_id: string | null
          cakto_session_id: string | null
          cakto_subscription_id: string | null
          created_at: string
          currency: string
          donor_email: string | null
          donor_name: string | null
          donor_whatsapp: string | null
          id: string
          mode: string
          paid_at: string | null
          payment_method: string | null
          raw_payload: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          cakto_payment_id?: string | null
          cakto_session_id?: string | null
          cakto_subscription_id?: string | null
          created_at?: string
          currency?: string
          donor_email?: string | null
          donor_name?: string | null
          donor_whatsapp?: string | null
          id?: string
          mode: string
          paid_at?: string | null
          payment_method?: string | null
          raw_payload?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          cakto_payment_id?: string | null
          cakto_session_id?: string | null
          cakto_subscription_id?: string | null
          created_at?: string
          currency?: string
          donor_email?: string | null
          donor_name?: string | null
          donor_whatsapp?: string | null
          id?: string
          mode?: string
          paid_at?: string | null
          payment_method?: string | null
          raw_payload?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      escala_repertorio: {
        Row: {
          created_at: string
          escala_id: string
          id: string
          ordem: number
          repertorio_id: string
        }
        Insert: {
          created_at?: string
          escala_id: string
          id?: string
          ordem?: number
          repertorio_id: string
        }
        Update: {
          created_at?: string
          escala_id?: string
          id?: string
          ordem?: number
          repertorio_id?: string
        }
        Relationships: []
      }
      kids_checkins: {
        Row: {
          checkin_at: string
          checkin_by: string
          checkout_at: string | null
          checkout_by: string | null
          child_id: string
          created_at: string
          id: string
          pickup_code: string
          room_id: string
        }
        Insert: {
          checkin_at?: string
          checkin_by: string
          checkout_at?: string | null
          checkout_by?: string | null
          child_id: string
          created_at?: string
          id?: string
          pickup_code: string
          room_id: string
        }
        Update: {
          checkin_at?: string
          checkin_by?: string
          checkout_at?: string | null
          checkout_by?: string | null
          child_id?: string
          created_at?: string
          id?: string
          pickup_code?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_checkins_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "kids_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_checkins_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "kids_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_children: {
        Row: {
          allergies: string | null
          birth_date: string
          created_at: string
          created_by: string
          current_room_id: string | null
          full_name: string
          id: string
          notes: string | null
          page_id: string
          photo_path: string | null
          restrictions: string | null
          suggested_room_id: string | null
          updated_at: string
        }
        Insert: {
          allergies?: string | null
          birth_date: string
          created_at?: string
          created_by: string
          current_room_id?: string | null
          full_name: string
          id?: string
          notes?: string | null
          page_id: string
          photo_path?: string | null
          restrictions?: string | null
          suggested_room_id?: string | null
          updated_at?: string
        }
        Update: {
          allergies?: string | null
          birth_date?: string
          created_at?: string
          created_by?: string
          current_room_id?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          page_id?: string
          photo_path?: string | null
          restrictions?: string | null
          suggested_room_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_children_current_room_id_fkey"
            columns: ["current_room_id"]
            isOneToOne: false
            referencedRelation: "kids_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_children_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "kids_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_children_suggested_room_id_fkey"
            columns: ["suggested_room_id"]
            isOneToOne: false
            referencedRelation: "kids_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_consents: {
        Row: {
          accepted_at: string
          id: string
          ip_address: string | null
          page_id: string
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          page_id: string
          user_agent?: string | null
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          page_id?: string
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_consents_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "kids_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_content: {
        Row: {
          body: string | null
          content_date: string
          created_at: string
          created_by: string
          id: string
          links: Json
          page_id: string
          room_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          content_date?: string
          created_at?: string
          created_by: string
          id?: string
          links?: Json
          page_id: string
          room_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          content_date?: string
          created_at?: string
          created_by?: string
          id?: string
          links?: Json
          page_id?: string
          room_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_content_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "kids_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_content_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "kids_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_dynamic_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          room_id: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          room_id: string
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          room_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_dynamic_tokens_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "kids_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_guardian_children: {
        Row: {
          child_id: string
          created_at: string
          guardian_id: string
          id: string
          relationship: string
        }
        Insert: {
          child_id: string
          created_at?: string
          guardian_id: string
          id?: string
          relationship?: string
        }
        Update: {
          child_id?: string
          created_at?: string
          guardian_id?: string
          id?: string
          relationship?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_guardian_children_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "kids_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_guardian_children_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "kids_guardians"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_guardians: {
        Row: {
          birth_date: string
          cpf: string | null
          created_at: string
          full_name: string
          id: string
          phone: string
          photo_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date: string
          cpf?: string | null
          created_at?: string
          full_name: string
          id?: string
          phone: string
          photo_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string
          cpf?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string
          photo_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_inclusion_notes: {
        Row: {
          author_id: string
          child_id: string
          content: string
          created_at: string
          id: string
          title: string
        }
        Insert: {
          author_id: string
          child_id: string
          content: string
          created_at?: string
          id?: string
          title: string
        }
        Update: {
          author_id?: string
          child_id?: string
          content?: string
          created_at?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_inclusion_notes_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "kids_children"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_leaders: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          page_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          page_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          page_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_leaders_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "kids_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          notify_whatsapp: boolean
          page_id: string
          room_id: string | null
          sender_id: string
          sender_role: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          notify_whatsapp?: boolean
          page_id: string
          room_id?: string | null
          sender_id: string
          sender_role: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          notify_whatsapp?: boolean
          page_id?: string
          room_id?: string | null
          sender_id?: string
          sender_role?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_messages_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "kids_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "kids_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_pages: {
        Row: {
          checkin_days: number[] | null
          checkin_end_time: string | null
          checkin_start_time: string | null
          checkin_timezone: string | null
          church_id: string
          consent_text: string
          consent_version: string
          created_at: string
          created_by: string
          id: string
          name: string
          primary_color: string
          slug: string
          static_qr_token: string
          updated_at: string
        }
        Insert: {
          checkin_days?: number[] | null
          checkin_end_time?: string | null
          checkin_start_time?: string | null
          checkin_timezone?: string | null
          church_id: string
          consent_text: string
          consent_version?: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          primary_color?: string
          slug: string
          static_qr_token?: string
          updated_at?: string
        }
        Update: {
          checkin_days?: number[] | null
          checkin_end_time?: string | null
          checkin_start_time?: string | null
          checkin_timezone?: string | null
          church_id?: string
          consent_text?: string
          consent_version?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          primary_color?: string
          slug?: string
          static_qr_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_pages_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: true
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_pages_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: true
            referencedRelation: "churches_member_view"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_room_transfers: {
        Row: {
          child_id: string
          created_at: string
          from_room_id: string | null
          id: string
          reason: string | null
          to_room_id: string
          transferred_by: string
        }
        Insert: {
          child_id: string
          created_at?: string
          from_room_id?: string | null
          id?: string
          reason?: string | null
          to_room_id: string
          transferred_by: string
        }
        Update: {
          child_id?: string
          created_at?: string
          from_room_id?: string | null
          id?: string
          reason?: string | null
          to_room_id?: string
          transferred_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_room_transfers_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "kids_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_room_transfers_from_room_id_fkey"
            columns: ["from_room_id"]
            isOneToOne: false
            referencedRelation: "kids_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_room_transfers_to_room_id_fkey"
            columns: ["to_room_id"]
            isOneToOne: false
            referencedRelation: "kids_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_rooms: {
        Row: {
          active: boolean
          age_max: number
          age_min: number
          color: string
          created_at: string
          id: string
          is_inclusion: boolean
          name: string
          page_id: string
          static_qr_token: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          age_max?: number
          age_min?: number
          color?: string
          created_at?: string
          id?: string
          is_inclusion?: boolean
          name: string
          page_id: string
          static_qr_token?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          age_max?: number
          age_min?: number
          color?: string
          created_at?: string
          id?: string
          is_inclusion?: boolean
          name?: string
          page_id?: string
          static_qr_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_rooms_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "kids_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_teacher_rooms: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          room_id: string
          scope: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          room_id: string
          scope?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          room_id?: string
          scope?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_teacher_rooms_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "kids_rooms"
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
          blocked_at: string | null
          blocked_by: string | null
          department_id: string
          id: string
          is_blocked: boolean
          joined_at: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          blocked_at?: string | null
          blocked_by?: string | null
          department_id: string
          id?: string
          is_blocked?: boolean
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          blocked_at?: string | null
          blocked_by?: string | null
          department_id?: string
          id?: string
          is_blocked?: boolean
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
            foreignKeyName: "members_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments_safe"
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
          metadata: Json | null
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
          metadata?: Json | null
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
          metadata?: Json | null
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
            foreignKeyName: "notifications_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments_safe"
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
          is_authenticated: boolean
          page_path: string
          referrer: string | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_authenticated?: boolean
          page_path: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_authenticated?: boolean
          page_path?: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
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
          birth_date: string | null
          created_at: string
          email: string
          guardian_authorized_at: string | null
          guardian_authorized_by: string | null
          id: string
          invited_by_department_id: string | null
          name: string
          share_contact: boolean | null
          updated_at: string
          whatsapp: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          email: string
          guardian_authorized_at?: string | null
          guardian_authorized_by?: string | null
          id: string
          invited_by_department_id?: string | null
          name: string
          share_contact?: boolean | null
          updated_at?: string
          whatsapp: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string
          guardian_authorized_at?: string | null
          guardian_authorized_by?: string | null
          id?: string
          invited_by_department_id?: string | null
          name?: string
          share_contact?: boolean | null
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_guardian_authorized_by_fkey"
            columns: ["guardian_authorized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_invited_by_department_id_fkey"
            columns: ["invited_by_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_invited_by_department_id_fkey"
            columns: ["invited_by_department_id"]
            isOneToOne: false
            referencedRelation: "departments_safe"
            referencedColumns: ["id"]
          },
        ]
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
      repertorio: {
        Row: {
          ativo: boolean
          bpm: number | null
          cifra: string | null
          criado_em: string
          criado_por: string
          departamento_id: string
          id: string
          observacoes: string | null
          pdf_url: string | null
          tags: string[] | null
          tipo: string
          titulo: string
          tom: string | null
          url: string | null
        }
        Insert: {
          ativo?: boolean
          bpm?: number | null
          cifra?: string | null
          criado_em?: string
          criado_por: string
          departamento_id: string
          id?: string
          observacoes?: string | null
          pdf_url?: string | null
          tags?: string[] | null
          tipo: string
          titulo: string
          tom?: string | null
          url?: string | null
        }
        Update: {
          ativo?: boolean
          bpm?: number | null
          cifra?: string | null
          criado_em?: string
          criado_por?: string
          departamento_id?: string
          id?: string
          observacoes?: string | null
          pdf_url?: string | null
          tags?: string[] | null
          tipo?: string
          titulo?: string
          tom?: string | null
          url?: string | null
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
            foreignKeyName: "schedule_swaps_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments_safe"
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
            foreignKeyName: "schedules_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments_safe"
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
          {
            foreignKeyName: "sectors_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_notes: {
        Row: {
          content: string
          created_at: string
          date: string
          department_id: string
          id: string
          time_end: string
          time_start: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          date: string
          department_id: string
          id?: string
          time_end: string
          time_start: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          date?: string
          department_id?: string
          id?: string
          time_end?: string
          time_start?: string
          updated_at?: string
          updated_by?: string | null
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
      webauthn_challenges: {
        Row: {
          challenge: string
          created_at: string
          email: string | null
          expires_at: string
          id: string
          type: string
          user_id: string | null
        }
        Insert: {
          challenge: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          type: string
          user_id?: string | null
        }
        Update: {
          challenge?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      webauthn_credentials: {
        Row: {
          counter: number
          created_at: string
          credential_id: string
          device_name: string
          id: string
          last_used_at: string | null
          public_key: string
          transports: string[] | null
          user_id: string
        }
        Insert: {
          counter?: number
          created_at?: string
          credential_id: string
          device_name?: string
          id?: string
          last_used_at?: string | null
          public_key: string
          transports?: string[] | null
          user_id: string
        }
        Update: {
          counter?: number
          created_at?: string
          credential_id?: string
          device_name?: string
          id?: string
          last_used_at?: string | null
          public_key?: string
          transports?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_logs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          message: string
          origin: string | null
          phone: string
          status: string
          zapi_response: Json | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          message: string
          origin?: string | null
          phone: string
          status: string
          zapi_response?: Json | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          message?: string
          origin?: string | null
          phone?: string
          status?: string
          zapi_response?: Json | null
        }
        Relationships: []
      }
      whatsapp_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          message: string
          origin: string | null
          phone: string
          scheduled_for: string
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          message: string
          origin?: string | null
          phone: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          message?: string
          origin?: string | null
          phone?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
      whatsapp_swap_sessions: {
        Row: {
          attempts_count: number
          candidate_target_schedule_ids: string[]
          candidate_target_user_ids: string[]
          created_at: string
          current_target_schedule_id: string | null
          current_target_user_id: string | null
          expires_at: string
          id: string
          phone: string
          requester_schedule_id: string | null
          state: string
          swap_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts_count?: number
          candidate_target_schedule_ids?: string[]
          candidate_target_user_ids?: string[]
          created_at?: string
          current_target_schedule_id?: string | null
          current_target_user_id?: string | null
          expires_at?: string
          id?: string
          phone: string
          requester_schedule_id?: string | null
          state: string
          swap_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts_count?: number
          candidate_target_schedule_ids?: string[]
          candidate_target_user_ids?: string[]
          created_at?: string
          current_target_schedule_id?: string | null
          current_target_user_id?: string | null
          expires_at?: string
          id?: string
          phone?: string
          requester_schedule_id?: string | null
          state?: string
          swap_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      churches_member_view: {
        Row: {
          address: string | null
          city: string | null
          code: string | null
          created_at: string | null
          description: string | null
          id: string | null
          leader_id: string | null
          logo_url: string | null
          name: string | null
          slug: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          leader_id?: string | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          leader_id?: string | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      departments_safe: {
        Row: {
          allow_sunday_double: boolean | null
          avatar_url: string | null
          church_id: string | null
          created_at: string | null
          description: string | null
          id: string | null
          leader_id: string | null
          max_blackout_dates: number | null
          name: string | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          allow_sunday_double?: boolean | null
          avatar_url?: string | null
          church_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          leader_id?: string | null
          max_blackout_dates?: number | null
          name?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          allow_sunday_double?: boolean | null
          avatar_url?: string | null
          church_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          leader_id?: string | null
          max_blackout_dates?: number | null
          name?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          trial_ends_at?: string | null
          updated_at?: string | null
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
            foreignKeyName: "departments_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches_member_view"
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
            foreignKeyName: "schedules_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments_safe"
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
      authorize_minor: { Args: { _minor_id: string }; Returns: undefined }
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
      get_church_code_by_slug: { Args: { p_slug: string }; Returns: string }
      get_church_count: { Args: never; Returns: number }
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
          coordinator_invite_code: string
          created_at: string
          description: string
          id: string
          invite_code: string
          leader_id: string
          name: string
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
      is_church_leader: {
        Args: { _church_id: string; _user_id: string }
        Returns: boolean
      }
      is_department_coleader: {
        Args: { _department_id: string; _user_id: string }
        Returns: boolean
      }
      is_department_coordinator: {
        Args: { _department_id: string; _user_id: string }
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
      is_guardian_of: {
        Args: { _child_id: string; _user_id: string }
        Returns: boolean
      }
      is_kids_guardian_of_page: {
        Args: { _page_id: string; _user_id: string }
        Returns: boolean
      }
      is_kids_leader: {
        Args: { _page_id: string; _user_id: string }
        Returns: boolean
      }
      is_kids_teacher_of_page: {
        Args: { _page_id: string; _user_id: string }
        Returns: boolean
      }
      is_kids_teacher_of_room: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      is_minor: { Args: { _birth: string }; Returns: boolean }
      is_scheduled_in_slot: {
        Args: {
          _date: string
          _department_id: string
          _time_end: string
          _time_start: string
          _user_id: string
        }
        Returns: boolean
      }
      join_department_as_coordinator: {
        Args: { p_code: string }
        Returns: {
          department_id: string
          department_name: string
          message: string
          success: boolean
        }[]
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
      kids_child_attendance: {
        Args: { _child_id: string; _from?: string; _to?: string }
        Returns: {
          count: number
          month: string
        }[]
      }
      kids_default_consent_text: { Args: never; Returns: string }
      kids_get_or_create_dyn_token: {
        Args: { _room_id: string }
        Returns: {
          expires_at: string
          token: string
        }[]
      }
      kids_lookup_page_by_token: {
        Args: { _token: string }
        Returns: {
          consent_text: string
          consent_version: string
          page_id: string
          page_name: string
          primary_color: string
        }[]
      }
      kids_lookup_page_rooms_by_token: {
        Args: { _token: string }
        Returns: {
          age_max: number
          age_min: number
          page_id: string
          page_name: string
          room_id: string
          room_name: string
        }[]
      }
      kids_lookup_room_by_static_token: {
        Args: { _token: string }
        Returns: {
          consent_text: string
          consent_version: string
          page_id: string
          page_name: string
          room_color: string
          room_id: string
          room_name: string
        }[]
      }
      kids_perform_checkin: {
        Args: { _child_ids: string[]; _dynamic_token: string }
        Returns: {
          checkin_id: string
          child_id: string
          pickup_code: string
        }[]
      }
      kids_perform_checkin_by_page: {
        Args: { _child_ids: string[]; _page_token: string }
        Returns: {
          checkin_id: string
          child_id: string
          pickup_code: string
          room_id: string
          room_name: string
        }[]
      }
      kids_perform_checkin_static: {
        Args: { _child_ids: string[]; _static_token: string }
        Returns: {
          checkin_id: string
          child_id: string
          pickup_code: string
        }[]
      }
      kids_perform_checkout: {
        Args: { _checkin_id: string; _pickup_code: string }
        Returns: boolean
      }
      kids_report_dropoff: {
        Args: { _page_id: string }
        Returns: {
          checkins_prev: number
          child_id: string
          full_name: string
          guardian_name: string
          guardian_phone: string
          last_visit: string
        }[]
      }
      kids_report_needs: {
        Args: { _page_id: string }
        Returns: {
          allergies: string
          child_id: string
          current_room: string
          full_name: string
          restrictions: string
        }[]
      }
      kids_report_visitors: {
        Args: { _page_id: string }
        Returns: {
          checkins: number
          child_id: string
          full_name: string
          last_visit: string
        }[]
      }
      kids_self_register_teacher: {
        Args: { _page_token: string; _room_id: string }
        Returns: undefined
      }
      kids_transfer_child: {
        Args: { _child_id: string; _new_room_id: string; _reason?: string }
        Returns: boolean
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
      rotate_coordinator_invite_code: {
        Args: { dept_id: string }
        Returns: string
      }
      set_member_blocked: {
        Args: { blocked: boolean; dept_id: string; target_user_id: string }
        Returns: boolean
      }
      share_department_with: {
        Args: { _user_a: string; _user_b: string }
        Returns: boolean
      }
      transfer_department_leadership: {
        Args: { dept_id: string; new_leader_user_id: string }
        Returns: boolean
      }
      unblock_member_by_phone: {
        Args: { p_phone: string }
        Returns: {
          department_id: string
          department_name: string
        }[]
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
      validate_coordinator_code_secure: {
        Args: { p_code: string }
        Returns: {
          department_name: string
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
      member_role: "leader" | "member" | "coleader"
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
      member_role: ["leader", "member", "coleader"],
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
