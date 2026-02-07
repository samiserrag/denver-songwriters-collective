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
      admin_notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_logs: {
        Row: {
          context: Json | null
          created_at: string | null
          id: string
          ip_address: string | null
          level: string
          message: string
          source: string | null
          url: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          level: string
          message: string
          source?: string | null
          url?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          level?: string
          message?: string
          source?: string | null
          url?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      approved_hosts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          notes: string | null
          status: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      blog_comments: {
        Row: {
          author_id: string | null
          content: string
          created_at: string | null
          edited_at: string | null
          guest_email: string | null
          guest_name: string | null
          guest_verification_id: string | null
          guest_verified: boolean
          hidden_by: string | null
          id: string
          is_approved: boolean | null
          is_deleted: boolean | null
          is_hidden: boolean | null
          parent_id: string | null
          post_id: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string | null
          edited_at?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_verification_id?: string | null
          guest_verified?: boolean
          hidden_by?: string | null
          id?: string
          is_approved?: boolean | null
          is_deleted?: boolean | null
          is_hidden?: boolean | null
          parent_id?: string | null
          post_id: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string | null
          edited_at?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_verification_id?: string | null
          guest_verified?: boolean
          hidden_by?: string | null
          id?: string
          is_approved?: boolean | null
          is_deleted?: boolean | null
          is_hidden?: boolean | null
          parent_id?: string | null
          post_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_comments_guest_verification_id_fkey"
            columns: ["guest_verification_id"]
            isOneToOne: false
            referencedRelation: "guest_verifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_comments_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "blog_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_gallery_images: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          image_url: string
          post_id: string
          sort_order: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          image_url: string
          post_id: string
          sort_order?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          image_url?: string
          post_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_gallery_images_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string
          content: string
          cover_image_url: string | null
          created_at: string | null
          excerpt: string | null
          id: string
          is_approved: boolean | null
          is_featured: boolean
          is_published: boolean | null
          published_at: string | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          content: string
          cover_image_url?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          is_approved?: boolean | null
          is_featured?: boolean
          is_published?: boolean | null
          published_at?: string | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          cover_image_url?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          is_approved?: boolean | null
          is_featured?: boolean
          is_published?: boolean | null
          published_at?: string | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      change_reports: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          event_id: string | null
          field_name: string
          id: string
          notes: string | null
          proposed_value: string
          reporter_email: string | null
          reporter_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          event_id?: string | null
          field_name: string
          id?: string
          notes?: string | null
          proposed_value: string
          reporter_email?: string | null
          reporter_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          event_id?: string | null
          field_name?: string
          id?: string
          notes?: string | null
          proposed_value?: string
          reporter_email?: string | null
          reporter_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "change_reports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "change_reports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_claims: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          message: string | null
          rejection_reason: string | null
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          message?: string | null
          rejection_reason?: string | null
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          message?: string | null
          rejection_reason?: string | null
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_claims_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_claims_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_comments: {
        Row: {
          content: string
          created_at: string | null
          date_key: string
          edited_at: string | null
          event_id: string
          guest_email: string | null
          guest_name: string | null
          guest_verification_id: string | null
          guest_verified: boolean | null
          hidden_by: string | null
          id: string
          is_deleted: boolean | null
          is_hidden: boolean | null
          is_host_only: boolean | null
          parent_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          date_key: string
          edited_at?: string | null
          event_id: string
          guest_email?: string | null
          guest_name?: string | null
          guest_verification_id?: string | null
          guest_verified?: boolean | null
          hidden_by?: string | null
          id?: string
          is_deleted?: boolean | null
          is_hidden?: boolean | null
          is_host_only?: boolean | null
          parent_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          date_key?: string
          edited_at?: string | null
          event_id?: string
          guest_email?: string | null
          guest_name?: string | null
          guest_verification_id?: string | null
          guest_verified?: boolean | null
          hidden_by?: string | null
          id?: string
          is_deleted?: boolean | null
          is_hidden?: boolean | null
          is_host_only?: boolean | null
          parent_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_comments_guest_verification_id_fkey"
            columns: ["guest_verification_id"]
            isOneToOne: false
            referencedRelation: "guest_verifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "event_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_comments_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_hosts: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          invitation_status: string
          invited_at: string | null
          invited_by: string | null
          responded_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          invitation_status?: string
          invited_at?: string | null
          invited_by?: string | null
          responded_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          invitation_status?: string
          invited_at?: string | null
          invited_by?: string | null
          responded_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_hosts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_hosts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_images: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          event_id: string
          id: string
          image_url: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          event_id: string
          id?: string
          image_url: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          event_id?: string
          id?: string
          image_url?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_images_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_images_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          email_restriction: string | null
          event_id: string
          expires_at: string
          id: string
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          role_to_grant: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by: string
          email_restriction?: string | null
          event_id: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          role_to_grant?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          email_restriction?: string | null
          event_id?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          role_to_grant?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invites_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_lineup_state: {
        Row: {
          date_key: string
          event_id: string
          now_playing_timeslot_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          date_key: string
          event_id: string
          now_playing_timeslot_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          date_key?: string
          event_id?: string
          now_playing_timeslot_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_lineup_state_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_lineup_state_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_lineup_state_now_playing_timeslot_id_fkey"
            columns: ["now_playing_timeslot_id"]
            isOneToOne: false
            referencedRelation: "event_timeslots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_lineup_state_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          created_at: string | null
          date_key: string
          event_id: string
          guest_email: string | null
          guest_name: string | null
          guest_verification_id: string | null
          guest_verified: boolean | null
          id: string
          notes: string | null
          offer_expires_at: string | null
          status: string
          updated_at: string | null
          user_id: string | null
          waitlist_position: number | null
        }
        Insert: {
          created_at?: string | null
          date_key: string
          event_id: string
          guest_email?: string | null
          guest_name?: string | null
          guest_verification_id?: string | null
          guest_verified?: boolean | null
          id?: string
          notes?: string | null
          offer_expires_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
          waitlist_position?: number | null
        }
        Update: {
          created_at?: string | null
          date_key?: string
          event_id?: string
          guest_email?: string | null
          guest_name?: string | null
          guest_verification_id?: string | null
          guest_verified?: boolean | null
          id?: string
          notes?: string | null
          offer_expires_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
          waitlist_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_guest_verification_id_fkey"
            columns: ["guest_verification_id"]
            isOneToOne: false
            referencedRelation: "guest_verifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
            referencedRelation: "event_venue_match"
            referencedColumns: ["event_id"]
          },
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
      event_timeslots: {
        Row: {
          created_at: string | null
          date_key: string
          duration_minutes: number
          event_id: string
          id: string
          slot_index: number
          start_offset_minutes: number | null
        }
        Insert: {
          created_at?: string | null
          date_key: string
          duration_minutes?: number
          event_id: string
          id?: string
          slot_index: number
          start_offset_minutes?: number | null
        }
        Update: {
          created_at?: string | null
          date_key?: string
          duration_minutes?: number
          event_id?: string
          id?: string
          slot_index?: number
          start_offset_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_timeslots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_timeslots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_update_suggestions: {
        Row: {
          admin_response: string | null
          batch_id: string
          created_at: string
          event_id: string | null
          field: string
          id: number
          new_value: string
          notes: string | null
          old_value: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitter_email: string | null
          submitter_name: string | null
        }
        Insert: {
          admin_response?: string | null
          batch_id?: string
          created_at?: string
          event_id?: string | null
          field: string
          id?: number
          new_value: string
          notes?: string | null
          old_value?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitter_email?: string | null
          submitter_name?: string | null
        }
        Update: {
          admin_response?: string | null
          batch_id?: string
          created_at?: string
          event_id?: string | null
          field?: string
          id?: number
          new_value?: string
          notes?: string | null
          old_value?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitter_email?: string | null
          submitter_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_update_suggestions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_update_suggestions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_watchers: {
        Row: {
          created_at: string | null
          event_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_watchers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_watchers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_watchers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          age_policy: string | null
          allow_guest_slots: boolean | null
          cancel_reason: string | null
          cancelled_at: string | null
          capacity: number | null
          categories: string[] | null
          category: string | null
          cost_label: string | null
          cover_image_url: string | null
          created_at: string | null
          custom_address: string | null
          custom_city: string | null
          custom_dates: string[] | null
          custom_latitude: number | null
          custom_location_name: string | null
          custom_longitude: number | null
          custom_state: string | null
          day_of_week: string | null
          description: string | null
          end_time: string | null
          event_date: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          external_url: string | null
          has_timeslots: boolean | null
          host_id: string | null
          host_notes: string | null
          id: string
          is_dsc_event: boolean | null
          is_free: boolean | null
          is_published: boolean | null
          is_recurring: boolean | null
          is_showcase: boolean | null
          is_spotlight: boolean | null
          last_major_update_at: string | null
          last_verified_at: string | null
          location_mode: string | null
          location_notes: string | null
          max_occurrences: number | null
          notes: string | null
          online_url: string | null
          parent_event_id: string | null
          published_at: string | null
          recurrence_end_date: string | null
          recurrence_pattern: string | null
          recurrence_rule: string | null
          region_id: number | null
          series_id: string | null
          series_index: number | null
          signup_deadline: string | null
          signup_mode: string | null
          signup_time: string | null
          signup_url: string | null
          slot_duration_minutes: number | null
          slot_offer_window_minutes: number | null
          slug: string | null
          source: string | null
          spotlight_reason: string | null
          start_time: string | null
          status: string
          timezone: string | null
          title: string
          total_slots: number | null
          updated_at: string | null
          venue_address: string | null
          venue_id: string | null
          venue_name: string | null
          verified_by: string | null
        }
        Insert: {
          age_policy?: string | null
          allow_guest_slots?: boolean | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          capacity?: number | null
          categories?: string[] | null
          category?: string | null
          cost_label?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          custom_address?: string | null
          custom_city?: string | null
          custom_dates?: string[] | null
          custom_latitude?: number | null
          custom_location_name?: string | null
          custom_longitude?: number | null
          custom_state?: string | null
          day_of_week?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          external_url?: string | null
          has_timeslots?: boolean | null
          host_id?: string | null
          host_notes?: string | null
          id?: string
          is_dsc_event?: boolean | null
          is_free?: boolean | null
          is_published?: boolean | null
          is_recurring?: boolean | null
          is_showcase?: boolean | null
          is_spotlight?: boolean | null
          last_major_update_at?: string | null
          last_verified_at?: string | null
          location_mode?: string | null
          location_notes?: string | null
          max_occurrences?: number | null
          notes?: string | null
          online_url?: string | null
          parent_event_id?: string | null
          published_at?: string | null
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          recurrence_rule?: string | null
          region_id?: number | null
          series_id?: string | null
          series_index?: number | null
          signup_deadline?: string | null
          signup_mode?: string | null
          signup_time?: string | null
          signup_url?: string | null
          slot_duration_minutes?: number | null
          slot_offer_window_minutes?: number | null
          slug?: string | null
          source?: string | null
          spotlight_reason?: string | null
          start_time?: string | null
          status?: string
          timezone?: string | null
          title: string
          total_slots?: number | null
          updated_at?: string | null
          venue_address?: string | null
          venue_id?: string | null
          venue_name?: string | null
          verified_by?: string | null
        }
        Update: {
          age_policy?: string | null
          allow_guest_slots?: boolean | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          capacity?: number | null
          categories?: string[] | null
          category?: string | null
          cost_label?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          custom_address?: string | null
          custom_city?: string | null
          custom_dates?: string[] | null
          custom_latitude?: number | null
          custom_location_name?: string | null
          custom_longitude?: number | null
          custom_state?: string | null
          day_of_week?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          external_url?: string | null
          has_timeslots?: boolean | null
          host_id?: string | null
          host_notes?: string | null
          id?: string
          is_dsc_event?: boolean | null
          is_free?: boolean | null
          is_published?: boolean | null
          is_recurring?: boolean | null
          is_showcase?: boolean | null
          is_spotlight?: boolean | null
          last_major_update_at?: string | null
          last_verified_at?: string | null
          location_mode?: string | null
          location_notes?: string | null
          max_occurrences?: number | null
          notes?: string | null
          online_url?: string | null
          parent_event_id?: string | null
          published_at?: string | null
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          recurrence_rule?: string | null
          region_id?: number | null
          series_id?: string | null
          series_index?: number | null
          signup_deadline?: string | null
          signup_mode?: string | null
          signup_time?: string | null
          signup_url?: string | null
          slot_duration_minutes?: number | null
          slot_offer_window_minutes?: number | null
          slug?: string | null
          source?: string | null
          spotlight_reason?: string | null
          start_time?: string | null
          status?: string
          timezone?: string | null
          title?: string
          total_slots?: number | null
          updated_at?: string | null
          venue_address?: string | null
          venue_id?: string | null
          venue_name?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "events_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["matched_venue_id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "favorites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_submissions: {
        Row: {
          admin_notes: string | null
          attachments: string[] | null
          category: string
          created_at: string
          description: string
          email: string
          id: string
          ip_hash: string
          name: string
          page_url: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          attachments?: string[] | null
          category: string
          created_at?: string
          description: string
          email: string
          id?: string
          ip_hash: string
          name: string
          page_url?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          attachments?: string[] | null
          category?: string
          created_at?: string
          description?: string
          email?: string
          id?: string
          ip_hash?: string
          name?: string
          page_url?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      gallery_album_comments: {
        Row: {
          album_id: string
          content: string
          created_at: string
          edited_at: string | null
          guest_email: string | null
          guest_name: string | null
          guest_verification_id: string | null
          guest_verified: boolean
          hidden_by: string | null
          id: string
          is_deleted: boolean
          is_hidden: boolean
          parent_id: string | null
          user_id: string | null
        }
        Insert: {
          album_id: string
          content: string
          created_at?: string
          edited_at?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_verification_id?: string | null
          guest_verified?: boolean
          hidden_by?: string | null
          id?: string
          is_deleted?: boolean
          is_hidden?: boolean
          parent_id?: string | null
          user_id?: string | null
        }
        Update: {
          album_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_verification_id?: string | null
          guest_verified?: boolean
          hidden_by?: string | null
          id?: string
          is_deleted?: boolean
          is_hidden?: boolean
          parent_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_album_comments_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "gallery_albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_album_comments_guest_verification_id_fkey"
            columns: ["guest_verification_id"]
            isOneToOne: false
            referencedRelation: "guest_verifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_album_comments_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_album_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "gallery_album_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_album_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_albums: {
        Row: {
          cover_image_url: string | null
          created_at: string | null
          created_by: string
          description: string | null
          event_id: string | null
          id: string
          is_approved: boolean | null
          is_hidden: boolean
          is_published: boolean | null
          name: string
          slug: string
          updated_at: string | null
          venue_id: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          event_id?: string | null
          id?: string
          is_approved?: boolean | null
          is_hidden?: boolean
          is_published?: boolean | null
          name: string
          slug: string
          updated_at?: string | null
          venue_id?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          event_id?: string | null
          id?: string
          is_approved?: boolean | null
          is_hidden?: boolean
          is_published?: boolean | null
          name?: string
          slug?: string
          updated_at?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_albums_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_albums_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "gallery_albums_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_albums_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["matched_venue_id"]
          },
          {
            foreignKeyName: "gallery_albums_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_images: {
        Row: {
          album_id: string | null
          caption: string | null
          created_at: string | null
          custom_event_date: string | null
          custom_event_name: string | null
          custom_venue_name: string | null
          event_id: string | null
          id: string
          image_url: string
          is_approved: boolean | null
          is_featured: boolean | null
          is_hidden: boolean
          is_published: boolean
          sort_order: number | null
          updated_at: string | null
          uploaded_by: string
          venue_id: string | null
        }
        Insert: {
          album_id?: string | null
          caption?: string | null
          created_at?: string | null
          custom_event_date?: string | null
          custom_event_name?: string | null
          custom_venue_name?: string | null
          event_id?: string | null
          id?: string
          image_url: string
          is_approved?: boolean | null
          is_featured?: boolean | null
          is_hidden?: boolean
          is_published?: boolean
          sort_order?: number | null
          updated_at?: string | null
          uploaded_by: string
          venue_id?: string | null
        }
        Update: {
          album_id?: string | null
          caption?: string | null
          created_at?: string | null
          custom_event_date?: string | null
          custom_event_name?: string | null
          custom_venue_name?: string | null
          event_id?: string | null
          id?: string
          image_url?: string
          is_approved?: boolean | null
          is_featured?: boolean | null
          is_hidden?: boolean
          is_published?: boolean
          sort_order?: number | null
          updated_at?: string | null
          uploaded_by?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_images_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "gallery_albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_images_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "gallery_images_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_images_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_images_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["matched_venue_id"]
          },
          {
            foreignKeyName: "gallery_images_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_photo_comments: {
        Row: {
          content: string
          created_at: string
          edited_at: string | null
          guest_email: string | null
          guest_name: string | null
          guest_verification_id: string | null
          guest_verified: boolean
          hidden_by: string | null
          id: string
          image_id: string
          is_deleted: boolean
          is_hidden: boolean
          parent_id: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          edited_at?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_verification_id?: string | null
          guest_verified?: boolean
          hidden_by?: string | null
          id?: string
          image_id: string
          is_deleted?: boolean
          is_hidden?: boolean
          parent_id?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          edited_at?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_verification_id?: string | null
          guest_verified?: boolean
          hidden_by?: string | null
          id?: string
          image_id?: string
          is_deleted?: boolean
          is_hidden?: boolean
          parent_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_photo_comments_guest_verification_id_fkey"
            columns: ["guest_verification_id"]
            isOneToOne: false
            referencedRelation: "guest_verifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_photo_comments_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_photo_comments_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "gallery_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_photo_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "gallery_photo_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_photo_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_verifications: {
        Row: {
          action_token: string | null
          action_type: string | null
          blog_post_id: string | null
          claim_id: string | null
          code: string | null
          code_attempts: number | null
          code_expires_at: string | null
          comment_id: string | null
          created_at: string | null
          date_key: string
          email: string
          event_id: string
          gallery_album_id: string | null
          gallery_image_id: string | null
          guest_name: string
          id: string
          locked_until: string | null
          profile_id: string | null
          rsvp_id: string | null
          timeslot_id: string | null
          token_expires_at: string | null
          token_used: boolean | null
          updated_at: string | null
          verified_at: string | null
        }
        Insert: {
          action_token?: string | null
          action_type?: string | null
          blog_post_id?: string | null
          claim_id?: string | null
          code?: string | null
          code_attempts?: number | null
          code_expires_at?: string | null
          comment_id?: string | null
          created_at?: string | null
          date_key: string
          email: string
          event_id: string
          gallery_album_id?: string | null
          gallery_image_id?: string | null
          guest_name: string
          id?: string
          locked_until?: string | null
          profile_id?: string | null
          rsvp_id?: string | null
          timeslot_id?: string | null
          token_expires_at?: string | null
          token_used?: boolean | null
          updated_at?: string | null
          verified_at?: string | null
        }
        Update: {
          action_token?: string | null
          action_type?: string | null
          blog_post_id?: string | null
          claim_id?: string | null
          code?: string | null
          code_attempts?: number | null
          code_expires_at?: string | null
          comment_id?: string | null
          created_at?: string | null
          date_key?: string
          email?: string
          event_id?: string
          gallery_album_id?: string | null
          gallery_image_id?: string | null
          guest_name?: string
          id?: string
          locked_until?: string | null
          profile_id?: string | null
          rsvp_id?: string | null
          timeslot_id?: string | null
          token_expires_at?: string | null
          token_used?: boolean | null
          updated_at?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_verifications_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_verifications_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "timeslot_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_verifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "event_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_verifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "guest_verifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_verifications_gallery_album_id_fkey"
            columns: ["gallery_album_id"]
            isOneToOne: false
            referencedRelation: "gallery_albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_verifications_gallery_image_id_fkey"
            columns: ["gallery_image_id"]
            isOneToOne: false
            referencedRelation: "gallery_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_verifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_verifications_rsvp_id_fkey"
            columns: ["rsvp_id"]
            isOneToOne: false
            referencedRelation: "event_rsvps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_verifications_timeslot_id_fkey"
            columns: ["timeslot_id"]
            isOneToOne: false
            referencedRelation: "event_timeslots"
            referencedColumns: ["id"]
          },
        ]
      }
      host_requests: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_highlights: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          end_date: string | null
          event_id: string | null
          highlight_type: string
          id: string
          image_url: string | null
          is_active: boolean | null
          link_text: string | null
          link_url: string | null
          performer_id: string | null
          start_date: string | null
          title: string
          updated_at: string | null
          venue_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          end_date?: string | null
          event_id?: string | null
          highlight_type: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_text?: string | null
          link_url?: string | null
          performer_id?: string | null
          start_date?: string | null
          title: string
          updated_at?: string | null
          venue_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          end_date?: string | null
          event_id?: string | null
          highlight_type?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_text?: string | null
          link_url?: string | null
          performer_id?: string | null
          start_date?: string | null
          title?: string
          updated_at?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_highlights_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_highlights_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "monthly_highlights_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_highlights_performer_id_fkey"
            columns: ["performer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_highlights_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["matched_venue_id"]
          },
          {
            foreignKeyName: "monthly_highlights_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          source: string | null
          subscribed_at: string | null
          unsubscribed_at: string | null
        }
        Insert: {
          email: string
          id?: string
          source?: string | null
          subscribed_at?: string | null
          unsubscribed_at?: string | null
        }
        Update: {
          email?: string
          id?: string
          source?: string | null
          subscribed_at?: string | null
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_admin_notifications: boolean
          email_claim_updates: boolean
          email_event_updates: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_admin_notifications?: boolean
          email_claim_updates?: boolean
          email_event_updates?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_admin_notifications?: boolean
          email_claim_updates?: boolean
          email_event_updates?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      occurrence_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          date_key: string
          event_id: string
          id: string
          override_cover_image_url: string | null
          override_notes: string | null
          override_patch: Json | null
          override_start_time: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_key: string
          event_id: string
          id?: string
          override_cover_image_url?: string | null
          override_notes?: string | null
          override_patch?: Json | null
          override_start_time?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_key?: string
          event_id?: string
          id?: string
          override_cover_image_url?: string | null
          override_notes?: string | null
          override_patch?: Json | null
          override_start_time?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "occurrence_overrides_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "occurrence_overrides_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      open_mic_claims: {
        Row: {
          created_at: string | null
          event_id: string | null
          id: string
          profile_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          profile_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          profile_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "open_mic_claims_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "open_mic_claims_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_mic_claims_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      open_mic_comments: {
        Row: {
          content: string
          created_at: string | null
          event_id: string
          hidden_by: string | null
          id: string
          is_deleted: boolean
          is_hidden: boolean
          parent_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          event_id: string
          hidden_by?: string | null
          id?: string
          is_deleted?: boolean
          is_hidden?: boolean
          parent_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          event_id?: string
          hidden_by?: string | null
          id?: string
          is_deleted?: boolean
          is_hidden?: boolean
          parent_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_mic_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "open_mic_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_mic_comments_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_mic_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "open_mic_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_mic_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_comments: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          edited_at: string | null
          guest_email: string | null
          guest_name: string | null
          guest_verification_id: string | null
          guest_verified: boolean
          hidden_by: string | null
          id: string
          is_deleted: boolean
          is_hidden: boolean
          parent_id: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          edited_at?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_verification_id?: string | null
          guest_verified?: boolean
          hidden_by?: string | null
          id?: string
          is_deleted?: boolean
          is_hidden?: boolean
          parent_id?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          edited_at?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_verification_id?: string | null
          guest_verified?: boolean
          hidden_by?: string | null
          id?: string
          is_deleted?: boolean
          is_hidden?: boolean
          parent_id?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_comments_guest_verification_id_fkey"
            columns: ["guest_verification_id"]
            isOneToOne: false
            referencedRelation: "guest_verifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_comments_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profile_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_comments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_images: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          image_url: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_url: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_url?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_images_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          available_for_hire: boolean | null
          avatar_url: string | null
          bandcamp_url: string | null
          bio: string | null
          cashapp_handle: string | null
          city: string | null
          created_at: string | null
          email: string | null
          facebook_url: string | null
          favorite_open_mic: string | null
          featured_at: string | null
          featured_rank: number | null
          featured_song_url: string | null
          full_name: string | null
          genres: string[] | null
          id: string
          instagram_url: string | null
          instruments: string[] | null
          interested_in_cowriting: boolean | null
          is_fan: boolean | null
          is_featured: boolean | null
          is_host: boolean | null
          is_public: boolean
          is_songwriter: boolean | null
          is_studio: boolean | null
          last_active_at: string | null
          no_show_count: number | null
          onboarding_complete: boolean | null
          open_to_collabs: boolean | null
          paypal_url: string | null
          referral_captured_at: string | null
          referral_source: string | null
          referral_via: string | null
          referred_by_profile_id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          slug: string | null
          song_links: string[] | null
          specialties: string[] | null
          spotify_url: string | null
          spotlight_type: string | null
          state: string | null
          tiktok_url: string | null
          twitter_url: string | null
          updated_at: string | null
          venmo_handle: string | null
          website_url: string | null
          youtube_url: string | null
          zip_code: string | null
        }
        Insert: {
          available_for_hire?: boolean | null
          avatar_url?: string | null
          bandcamp_url?: string | null
          bio?: string | null
          cashapp_handle?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          facebook_url?: string | null
          favorite_open_mic?: string | null
          featured_at?: string | null
          featured_rank?: number | null
          featured_song_url?: string | null
          full_name?: string | null
          genres?: string[] | null
          id?: string
          instagram_url?: string | null
          instruments?: string[] | null
          interested_in_cowriting?: boolean | null
          is_fan?: boolean | null
          is_featured?: boolean | null
          is_host?: boolean | null
          is_public?: boolean
          is_songwriter?: boolean | null
          is_studio?: boolean | null
          last_active_at?: string | null
          no_show_count?: number | null
          onboarding_complete?: boolean | null
          open_to_collabs?: boolean | null
          paypal_url?: string | null
          referral_captured_at?: string | null
          referral_source?: string | null
          referral_via?: string | null
          referred_by_profile_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          slug?: string | null
          song_links?: string[] | null
          specialties?: string[] | null
          spotify_url?: string | null
          spotlight_type?: string | null
          state?: string | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          venmo_handle?: string | null
          website_url?: string | null
          youtube_url?: string | null
          zip_code?: string | null
        }
        Update: {
          available_for_hire?: boolean | null
          avatar_url?: string | null
          bandcamp_url?: string | null
          bio?: string | null
          cashapp_handle?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          facebook_url?: string | null
          favorite_open_mic?: string | null
          featured_at?: string | null
          featured_rank?: number | null
          featured_song_url?: string | null
          full_name?: string | null
          genres?: string[] | null
          id?: string
          instagram_url?: string | null
          instruments?: string[] | null
          interested_in_cowriting?: boolean | null
          is_fan?: boolean | null
          is_featured?: boolean | null
          is_host?: boolean | null
          is_public?: boolean
          is_songwriter?: boolean | null
          is_studio?: boolean | null
          last_active_at?: string | null
          no_show_count?: number | null
          onboarding_complete?: boolean | null
          open_to_collabs?: boolean | null
          paypal_url?: string | null
          referral_captured_at?: string | null
          referral_source?: string | null
          referral_via?: string | null
          referred_by_profile_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          slug?: string | null
          song_links?: string[] | null
          specialties?: string[] | null
          spotify_url?: string | null
          spotlight_type?: string | null
          state?: string | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          venmo_handle?: string | null
          website_url?: string | null
          youtube_url?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_profile_id_fkey"
            columns: ["referred_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          font_preset: string
          id: string
          theme_preset: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          font_preset?: string
          id?: string
          theme_preset?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          font_preset?: string
          id?: string
          theme_preset?: string
          updated_at?: string
          updated_by?: string | null
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
          duration_min: number
          id: string
          note: string | null
          performer_id: string
          price_cents: number
          service_id: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string | null
        }
        Insert: {
          appointment_time: string
          created_at?: string | null
          duration_min?: number
          id?: string
          note?: string | null
          performer_id: string
          price_cents?: number
          service_id: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string | null
        }
        Update: {
          appointment_time?: string
          created_at?: string | null
          duration_min?: number
          id?: string
          note?: string | null
          performer_id?: string
          price_cents?: number
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
      timeslot_claims: {
        Row: {
          claimed_at: string | null
          guest_email: string | null
          guest_name: string | null
          guest_verification_id: string | null
          guest_verified: boolean | null
          id: string
          member_id: string | null
          offer_expires_at: string | null
          status: string
          timeslot_id: string
          updated_at: string | null
          updated_by: string | null
          waitlist_position: number | null
        }
        Insert: {
          claimed_at?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_verification_id?: string | null
          guest_verified?: boolean | null
          id?: string
          member_id?: string | null
          offer_expires_at?: string | null
          status?: string
          timeslot_id: string
          updated_at?: string | null
          updated_by?: string | null
          waitlist_position?: number | null
        }
        Update: {
          claimed_at?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_verification_id?: string | null
          guest_verified?: boolean | null
          id?: string
          member_id?: string | null
          offer_expires_at?: string | null
          status?: string
          timeslot_id?: string
          updated_at?: string | null
          updated_by?: string | null
          waitlist_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "timeslot_claims_guest_verification_id_fkey"
            columns: ["guest_verification_id"]
            isOneToOne: false
            referencedRelation: "guest_verifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeslot_claims_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeslot_claims_timeslot_id_fkey"
            columns: ["timeslot_id"]
            isOneToOne: false
            referencedRelation: "event_timeslots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeslot_claims_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_deletion_log: {
        Row: {
          actor_is_admin: boolean
          actor_is_super_admin: boolean
          actor_user_id: string | null
          buckets: Json
          created_at: string
          failures: Json
          id: string
          mode: string
          notes: string | null
          status: string
          target_user_id: string
          target_was_admin: boolean
        }
        Insert: {
          actor_is_admin?: boolean
          actor_is_super_admin?: boolean
          actor_user_id?: string | null
          buckets?: Json
          created_at?: string
          failures?: Json
          id?: string
          mode: string
          notes?: string | null
          status: string
          target_user_id: string
          target_was_admin?: boolean
        }
        Update: {
          actor_is_admin?: boolean
          actor_is_super_admin?: boolean
          actor_user_id?: string | null
          buckets?: Json
          created_at?: string
          failures?: Json
          id?: string
          mode?: string
          notes?: string | null
          status?: string
          target_user_id?: string
          target_was_admin?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_deletion_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_canonical: {
        Row: {
          address: string | null
          canonical_id: string | null
          city: string | null
          name: string | null
        }
        Insert: {
          address?: string | null
          canonical_id?: string | null
          city?: string | null
          name?: string | null
        }
        Update: {
          address?: string | null
          canonical_id?: string | null
          city?: string | null
          name?: string | null
        }
        Relationships: []
      }
      venue_claims: {
        Row: {
          cancelled_at: string | null
          created_at: string
          id: string
          message: string | null
          rejection_reason: string | null
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          venue_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          message?: string | null
          rejection_reason?: string | null
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          venue_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          message?: string | null
          rejection_reason?: string | null
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_claims_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["matched_venue_id"]
          },
          {
            foreignKeyName: "venue_claims_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_images: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          image_url: string
          storage_path: string
          uploaded_by: string | null
          venue_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_url: string
          storage_path: string
          uploaded_by?: string | null
          venue_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_url?: string
          storage_path?: string
          uploaded_by?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_images_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_images_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["matched_venue_id"]
          },
          {
            foreignKeyName: "venue_images_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          email_restriction: string | null
          expires_at: string
          id: string
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          token_hash: string
          venue_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by: string
          email_restriction?: string | null
          expires_at: string
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          token_hash: string
          venue_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          email_restriction?: string | null
          expires_at?: string
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          token_hash?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_invites_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["matched_venue_id"]
          },
          {
            foreignKeyName: "venue_invites_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_managers: {
        Row: {
          created_at: string
          created_by: string | null
          grant_method: string
          id: string
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          role: string
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          grant_method: string
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          role: string
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          grant_method?: string
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          role?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_managers_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "event_venue_match"
            referencedColumns: ["matched_venue_id"]
          },
          {
            foreignKeyName: "venue_managers_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          accessibility_notes: string | null
          address: string
          city: string
          contact_link: string | null
          cover_image_url: string | null
          created_at: string | null
          geocode_source: string | null
          geocoded_at: string | null
          google_maps_url: string | null
          id: string
          latitude: number | null
          longitude: number | null
          map_link: string | null
          name: string
          neighborhood: string | null
          notes: string | null
          parking_notes: string | null
          phone: string | null
          slug: string | null
          state: string
          updated_at: string | null
          website_url: string | null
          zip: string | null
        }
        Insert: {
          accessibility_notes?: string | null
          address: string
          city: string
          contact_link?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          geocode_source?: string | null
          geocoded_at?: string | null
          google_maps_url?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          map_link?: string | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          parking_notes?: string | null
          phone?: string | null
          slug?: string | null
          state: string
          updated_at?: string | null
          website_url?: string | null
          zip?: string | null
        }
        Update: {
          accessibility_notes?: string | null
          address?: string
          city?: string
          contact_link?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          geocode_source?: string | null
          geocoded_at?: string | null
          google_maps_url?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          map_link?: string | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          parking_notes?: string | null
          phone?: string | null
          slug?: string | null
          state?: string
          updated_at?: string | null
          website_url?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      volunteer_signups: {
        Row: {
          availability: string[] | null
          created_at: string | null
          email: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          preferred_roles: string[] | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          availability?: string[] | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          preferred_roles?: string[] | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          availability?: string[] | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          preferred_roles?: string[] | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      event_venue_match: {
        Row: {
          event_id: string | null
          matched_venue_id: string | null
          matched_venue_name: string | null
          raw_venue_name: string | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_old_logs: { Args: never; Returns: number }
      create_admin_notification: {
        Args: {
          p_message: string
          p_metadata?: Json
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_user_id?: string
        }
        Returns: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "admin_notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_user_notification: {
        Args: {
          p_link?: string
          p_message?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string | null
          title: string
          type: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_event_slug: {
        Args: { event_id: string; event_title: string }
        Returns: string
      }
      generate_event_timeslots: {
        Args: { p_event_id: string }
        Returns: {
          created_at: string | null
          date_key: string
          duration_minutes: number
          event_id: string
          id: string
          slot_index: number
          start_offset_minutes: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "event_timeslots"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      generate_profile_slug: {
        Args: { full_name: string; profile_id: string }
        Returns: string
      }
      generate_recurring_event_instances: {
        Args: { p_parent_event_id: string; p_weeks_ahead?: number }
        Returns: number
      }
      generate_venue_slug: {
        Args: { venue_id: string; venue_name: string }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      mark_timeslot_no_show: {
        Args: { p_claim_id: string; p_updated_by: string }
        Returns: {
          claimed_at: string | null
          guest_email: string | null
          guest_name: string | null
          guest_verification_id: string | null
          guest_verified: boolean | null
          id: string
          member_id: string | null
          offer_expires_at: string | null
          status: string
          timeslot_id: string
          updated_at: string | null
          updated_by: string | null
          waitlist_position: number | null
        }
        SetofOptions: {
          from: "*"
          to: "timeslot_claims"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_timeslot_performed: {
        Args: { p_claim_id: string; p_updated_by: string }
        Returns: {
          claimed_at: string | null
          guest_email: string | null
          guest_name: string | null
          guest_verification_id: string | null
          guest_verified: boolean | null
          id: string
          member_id: string | null
          offer_expires_at: string | null
          status: string
          timeslot_id: string
          updated_at: string | null
          updated_by: string | null
          waitlist_position: number | null
        }
        SetofOptions: {
          from: "*"
          to: "timeslot_claims"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      promote_timeslot_waitlist: {
        Args: { p_offer_window_minutes?: number; p_timeslot_id: string }
        Returns: string
      }
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
          duration_min: number
          id: string
          note: string | null
          performer_id: string
          price_cents: number
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
      upsert_notification_preferences: {
        Args: {
          p_email_admin_notifications?: boolean
          p_email_claim_updates?: boolean
          p_email_event_updates?: boolean
          p_user_id: string
        }
        Returns: {
          created_at: string
          email_admin_notifications: boolean
          email_claim_updates: boolean
          email_event_updates: boolean
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "notification_preferences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      appointment_status: "pending" | "confirmed" | "completed" | "cancelled"
      event_type:
        | "open_mic"
        | "showcase"
        | "song_circle"
        | "workshop"
        | "other"
        | "gig"
        | "meetup"
        | "kindred_group"
        | "jam_session"
      notification_type:
        | "new_user"
        | "event_signup"
        | "correction_submitted"
        | "gallery_created"
        | "blog_post_created"
        | "volunteer_signup"
        | "host_claim"
      user_role: "performer" | "host" | "studio" | "admin" | "fan" | "member"
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
      appointment_status: ["pending", "confirmed", "completed", "cancelled"],
      event_type: [
        "open_mic",
        "showcase",
        "song_circle",
        "workshop",
        "other",
        "gig",
        "meetup",
        "kindred_group",
        "jam_session",
      ],
      notification_type: [
        "new_user",
        "event_signup",
        "correction_submitted",
        "gallery_created",
        "blog_post_created",
        "volunteer_signup",
        "host_claim",
      ],
      user_role: ["performer", "host", "studio", "admin", "fan", "member"],
    },
  },
} as const
