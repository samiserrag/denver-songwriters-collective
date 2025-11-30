/**
 * Test fixtures for Open Mic Drop
 * Provides factory functions for creating test data
 */

import { adminClient } from '../setup';

// ============================================
// TYPES
// ============================================

export interface TestEvent {
  id: string;
  host_id: string;
  title: string;
  is_showcase: boolean;
}

export interface TestSlot {
  id: string;
  event_id: string;
  slot_index: number;
  performer_id: string | null;
}

export interface TestService {
  id: string;
  studio_id: string;
  name: string;
  price_cents: number;
  duration_min: number;
}

export interface TestAppointment {
  id: string;
  service_id: string;
  performer_id: string;
  appointment_time: string;
  status: string;
}

// ============================================
// EVENT FIXTURES
// ============================================

/**
 * Create a test event
 */
export async function createTestEvent(
  hostId: string,
  options: Partial<{
    title: string;
    is_showcase: boolean;
    event_date: string;
    start_time: string;
    end_time: string;
  }> = {}
): Promise<TestEvent> {
  const { data, error } = await adminClient
    .from('events')
    .insert({
      host_id: hostId,
      title: options.title || 'Test Open Mic Night',
      description: 'A test event for automated testing',
      venue_name: 'Test Venue',
      venue_address: '123 Test Street',
      event_date: options.event_date || '2025-12-15',
      start_time: options.start_time || '19:00:00',
      end_time: options.end_time || '22:00:00',
      is_showcase: options.is_showcase ?? false,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create test event: ${error.message}`);
  return data as TestEvent;
}

/**
 * Create multiple test slots for an event
 */
export async function createTestSlots(
  eventId: string,
  count: number,
  options: Partial<{
    startHour: number;
    slotDurationMinutes: number;
  }> = {}
): Promise<TestSlot[]> {
  const startHour = options.startHour || 19;
  const slotDuration = options.slotDurationMinutes || 15;

  const slots = Array.from({ length: count }, (_, i) => {
    const startMinutes = i * slotDuration;
    const endMinutes = (i + 1) * slotDuration;
    const startH = startHour + Math.floor(startMinutes / 60);
    const startM = startMinutes % 60;
    const endH = startHour + Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;

    return {
      event_id: eventId,
      slot_index: i + 1,
      start_time: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`,
      end_time: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`,
      performer_id: null,
    };
  });

  const { data, error } = await adminClient.from('event_slots').insert(slots).select();

  if (error) throw new Error(`Failed to create test slots: ${error.message}`);
  return data as TestSlot[];
}

/**
 * Create an event with slots in one call
 */
export async function createEventWithSlots(
  hostId: string,
  slotCount: number,
  options: Partial<{
    title: string;
    is_showcase: boolean;
  }> = {}
): Promise<{ event: TestEvent; slots: TestSlot[] }> {
  const event = await createTestEvent(hostId, options);
  const slots = await createTestSlots(event.id, slotCount);
  return { event, slots };
}

// ============================================
// STUDIO FIXTURES
// ============================================

/**
 * Create a test studio service
 */
export async function createTestService(
  studioId: string,
  options: Partial<{
    name: string;
    description: string;
    price_cents: number;
    duration_min: number;
  }> = {}
): Promise<TestService> {
  const { data, error } = await adminClient
    .from('studio_services')
    .insert({
      studio_id: studioId,
      name: options.name || 'Recording Session',
      description: options.description || 'Professional recording service',
      price_cents: options.price_cents ?? 5000,
      duration_min: options.duration_min ?? 60,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create test service: ${error.message}`);
  return data as TestService;
}

/**
 * Create a test appointment
 */
export async function createTestAppointment(
  serviceId: string,
  performerId: string,
  options: Partial<{
    appointment_time: string;
    status: string;
    note: string;
  }> = {}
): Promise<TestAppointment> {
  const defaultTime = new Date();
  defaultTime.setDate(defaultTime.getDate() + 7); // 1 week from now
  defaultTime.setHours(14, 0, 0, 0);

  const { data, error } = await adminClient
    .from('studio_appointments')
    .insert({
      service_id: serviceId,
      performer_id: performerId,
      appointment_time: options.appointment_time || defaultTime.toISOString(),
      status: options.status || 'pending',
      note: options.note || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create test appointment: ${error.message}`);
  return data as TestAppointment;
}

// ============================================
// SPOTLIGHT FIXTURES
// ============================================

/**
 * Create a test spotlight
 */
export async function createTestSpotlight(
  artistId: string,
  options: Partial<{
    spotlight_date: string;
    reason: string;
  }> = {}
): Promise<{ id: string; artist_id: string }> {
  const { data, error } = await adminClient
    .from('spotlights')
    .insert({
      artist_id: artistId,
      spotlight_date: options.spotlight_date || '2025-01-15',
      reason: options.reason || 'Test spotlight',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create test spotlight: ${error.message}`);
  return data;
}

// ============================================
// CLEANUP UTILITIES
// ============================================

/**
 * Delete a specific event and its slots
 */
export async function deleteTestEvent(eventId: string): Promise<void> {
  await adminClient.from('event_slots').delete().eq('event_id', eventId);
  await adminClient.from('events').delete().eq('id', eventId);
}

/**
 * Delete a specific service and its appointments
 */
export async function deleteTestService(serviceId: string): Promise<void> {
  await adminClient.from('studio_appointments').delete().eq('service_id', serviceId);
  await adminClient.from('studio_services').delete().eq('id', serviceId);
}

/**
 * Claim a slot directly via admin client (for test setup)
 */
export async function claimSlotDirectly(slotId: string, performerId: string): Promise<void> {
  const { error } = await adminClient
    .from('event_slots')
    .update({ performer_id: performerId })
    .eq('id', slotId);

  if (error) throw new Error(`Failed to claim slot: ${error.message}`);
}

/**
 * Unclaim a slot directly via admin client (for test setup)
 */
export async function unclaimSlotDirectly(slotId: string): Promise<void> {
  const { error } = await adminClient
    .from('event_slots')
    .update({ performer_id: null })
    .eq('id', slotId);

  if (error) throw new Error(`Failed to unclaim slot: ${error.message}`);
}
