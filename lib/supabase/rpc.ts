/**
 * Type-safe wrappers for all Supabase RPC functions
 * Compatible with both client and server Supabase instances
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  EventSlot,
  StudioAppointment,
  ClaimSlotParams,
  UnclaimSlotParams,
  GetAvailableSlotsParams,
  BookStudioServiceParams,
  SetShowcaseLineupParams,
} from './types';
import { parseSupabaseError } from './errors';

// ============================================
// OPEN MIC SLOT BOOKING
// ============================================

/**
 * Claim an available open mic slot
 * @param client - Supabase client instance
 * @param slotId - UUID of the slot to claim
 * @returns The claimed slot
 * @throws SupabaseRPCError if slot is not available or user already has a slot
 */
export async function claimOpenMicSlot(
  client: SupabaseClient,
  slotId: string
): Promise<EventSlot> {
  try {
    const { data, error } = await client.rpc('rpc_claim_open_mic_slot', {
      slot_id: slotId,
    });

    if (error) {
      throw parseSupabaseError(error);
    }

    // CRITICAL FIX: Unwrap array response
    const result = Array.isArray(data) ? data[0] : data;

    if (!result) {
      throw parseSupabaseError({
        message: 'Operation failed to return data',
        code: 'NO_DATA',
      });
    }

    return result as EventSlot;
  } catch (error) {
    throw parseSupabaseError(error);
  }
}

/**
 * Unclaim a previously claimed slot
 * @param client - Supabase client instance
 * @param slotId - UUID of the slot to unclaim
 * @returns The unclaimed slot
 * @throws SupabaseRPCError if slot doesn't belong to user
 */
export async function unclaimOpenMicSlot(
  client: SupabaseClient,
  slotId: string
): Promise<EventSlot> {
  try {
    const { data, error } = await client.rpc('rpc_unclaim_open_mic_slot', {
      slot_id: slotId,
    });

    if (error) {
      throw parseSupabaseError(error);
    }

    // CRITICAL FIX: Unwrap array response
    const result = Array.isArray(data) ? data[0] : data;

    if (!result) {
      throw parseSupabaseError({
        message: 'Operation failed to return data',
        code: 'NO_DATA',
      });
    }

    return result as EventSlot;
  } catch (error) {
    throw parseSupabaseError(error);
  }
}

/**
 * Get all available (unclaimed) slots for an event
 * @param client - Supabase client instance
 * @param eventId - UUID of the event
 * @returns Array of available slots
 */
export async function getAvailableSlotsForEvent(
  client: SupabaseClient,
  eventId: string
): Promise<EventSlot[]> {
  try {
    const { data, error } = await client.rpc('rpc_get_available_slots_for_event', {
      event_id: eventId,
    });

    if (error) {
      throw parseSupabaseError(error);
    }

    // RPC returns array, can be empty
    return (data as EventSlot[]) || [];
  } catch (error) {
    throw parseSupabaseError(error);
  }
}

// ============================================
// STUDIO BOOKING
// ============================================

/**
 * Book a studio service appointment
 * @param client - Supabase client instance
 * @param serviceId - UUID of the studio service
 * @param desiredTime - ISO timestamp for appointment (must be in future)
 * @returns The created appointment
 * @throws SupabaseRPCError if time slot is already booked or service not found
 */
export async function bookStudioService(
  client: SupabaseClient,
  serviceId: string,
  desiredTime: string
): Promise<StudioAppointment> {
  try {
    const { data, error } = await client.rpc('rpc_book_studio_service', {
      service_id: serviceId,
      desired_time: desiredTime,
    });

    if (error) {
      throw parseSupabaseError(error);
    }

    // CRITICAL FIX: Unwrap array response
    const result = Array.isArray(data) ? data[0] : data;

    if (!result) {
      throw parseSupabaseError({
        message: 'Operation failed to return data',
        code: 'NO_DATA',
      });
    }

    return result as StudioAppointment;
  } catch (error) {
    throw parseSupabaseError(error);
  }
}

// ============================================
// SHOWCASE / LINEUP MANAGEMENT
// ============================================

/**
 * Set performer lineup for a showcase event (Admin/Host only)
 * @param client - Supabase client instance
 * @param eventId - UUID of the showcase event
 * @param performerIds - Array of performer UUIDs in lineup order
 * @returns Array of updated slots with assigned performers
 * @throws SupabaseRPCError if user is not authorized or validation fails
 */
export async function setShowcaseLineup(
  client: SupabaseClient,
  eventId: string,
  performerIds: string[]
): Promise<EventSlot[]> {
  try {
    const { data, error } = await client.rpc('rpc_admin_set_showcase_lineup', {
      event_id: eventId,
      performer_ids: performerIds,
    });

    if (error) {
      throw parseSupabaseError(error);
    }

    if (!data) {
      throw parseSupabaseError({
        message: 'No data returned from lineup update',
        code: 'NO_DATA',
      });
    }

    return data as EventSlot[];
  } catch (error) {
    throw parseSupabaseError(error);
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if a slot is available (not claimed)
 */
export function isSlotAvailable(slot: EventSlot): boolean {
  return slot.performer_id === null;
}

/**
 * Check if current user owns a slot
 * @param slot - The slot to check
 * @param userId - Current user's ID
 */
export function isSlotOwnedByUser(slot: EventSlot, userId: string | undefined): boolean {
  if (!userId) return false;
  return slot.performer_id === userId;
}

/**
 * Format slot time range for display
 * @param slot - The slot with start/end times
 */
export function formatSlotTime(slot: EventSlot): string {
  return `${slot.start_time} - ${slot.end_time}`;
}

/**
 * Calculate price in dollars from cents
 */
export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(dollars);
}
