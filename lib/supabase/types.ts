/**
 * TypeScript types for Open Mic Drop Supabase schema
 * Generated from schema_phase1.sql
 */

// ============================================
// ENUMS
// ============================================

export type UserRole = 'performer' | 'host' | 'studio' | 'admin';

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

// ============================================
// DATABASE TABLES
// ============================================

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  venue_name: string | null;
  venue_address: string | null;
  event_date: string; // DATE as ISO string
  start_time: string; // TIME as HH:MM:SS
  end_time: string; // TIME as HH:MM:SS
  is_showcase: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventSlot {
  id: string;
  event_id: string;
  performer_id: string | null;
  slot_index: number;
  start_time: string; // TIME as HH:MM:SS
  end_time: string; // TIME as HH:MM:SS
  created_at: string;
  updated_at: string;
}

export interface StudioService {
  id: string;
  studio_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_min: number;
  created_at: string;
  updated_at: string;
}

export interface StudioAppointment {
  id: string;
  service_id: string;
  performer_id: string;
  appointment_time: string; // TIMESTAMPTZ as ISO string
  status: AppointmentStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Spotlight {
  id: string;
  artist_id: string;
  spotlight_date: string; // DATE as ISO string
  reason: string | null;
  created_at: string;
}

// ============================================
// RPC FUNCTION PARAMETERS
// ============================================

export interface ClaimSlotParams {
  slot_id: string;
}

export interface UnclaimSlotParams {
  slot_id: string;
}

export interface GetAvailableSlotsParams {
  event_id: string;
}

export interface BookStudioServiceParams {
  service_id: string;
  desired_time: string; // ISO timestamp
}

export interface SetShowcaseLineupParams {
  event_id: string;
  performer_ids: string[];
}

// ============================================
// RPC FUNCTION RETURN TYPES
// ============================================

export type ClaimSlotResult = EventSlot;

export type UnclaimSlotResult = EventSlot;

export type GetAvailableSlotsResult = EventSlot[];

export type BookStudioServiceResult = StudioAppointment;

export type SetShowcaseLineupResult = EventSlot[];

// ============================================
// HELPER TYPES
// ============================================

/**
 * Extended EventSlot with performer details
 */
export interface EventSlotWithPerformer extends EventSlot {
  performer?: Profile | null;
}

/**
 * Extended Event with host details
 */
export interface EventWithHost extends Event {
  host?: Profile;
}

/**
 * Extended StudioAppointment with service details
 */
export interface StudioAppointmentWithService extends StudioAppointment {
  service?: StudioService;
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
}

/**
 * Mutation state for hooks
 */
export interface MutationState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}
