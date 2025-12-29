/**
 * RPC Tests: rpc_get_available_slots_for_event
 * Tests fetching available (unclaimed) slots
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  adminClient,
  anonClient,
  createAuthenticatedClient,
  TEST_USERS,
  testUserIds,
  ensureTestSetup,
} from '../setup';
import {
  createEventWithSlots,
  deleteTestEvent,
  claimSlotDirectly,
  unclaimSlotDirectly,
} from '../fixtures';
import { getNonExistentUUID } from '../utils';

describe('RPC: rpc_get_available_slots_for_event', () => {
  let performerClient: SupabaseClient;

  let testEventId: string;
  let testSlots: Array<{ id: string; slot_index: number }>;

  beforeAll(async () => {
    await ensureTestSetup();

    if (!testUserIds.performer || !testUserIds.host) {
      throw new Error('Test user IDs not properly initialized');
    }

    performerClient = await createAuthenticatedClient(
      TEST_USERS.performer.email,
      TEST_USERS.performer.password
    );

    // Create event with 5 slots
    const { event, slots } = await createEventWithSlots(testUserIds.host, 5);
    testEventId = event.id;
    testSlots = slots;

    // Verify event exists
    const { data: verifyEvent, error: verifyError } = await adminClient
      .from('events')
      .select('id')
      .eq('id', testEventId)
      .single();

    if (verifyError || !verifyEvent) {
      throw new Error(`Test setup failed: event ${testEventId} not visible in DB. Error: ${verifyError?.message}`);
    }
  });

  afterAll(async () => {
    await performerClient.auth.signOut();
    await deleteTestEvent(testEventId);
  });

  beforeEach(async () => {
    // Reset all slots to unclaimed
    for (const slot of testSlots) {
      await unclaimSlotDirectly(slot.id);
    }
  });

  describe('RPC-008: Has available slots', () => {
    it('should return only unclaimed slots', async () => {
      // Claim 2 slots, leave 3 available
      await claimSlotDirectly(testSlots[0].id, testUserIds.performer);
      await claimSlotDirectly(testSlots[1].id, testUserIds.performer2);

      const { data, error } = await performerClient.rpc(
        'rpc_get_available_slots_for_event',
        { event_id: testEventId }
      );

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(3);

      // Verify all returned slots have null performer_id
      data.forEach((slot: any) => {
        expect(slot.performer_id).toBeNull();
      });
    });
  });

  describe('RPC-009: None available', () => {
    it('should return empty array when all slots are taken', async () => {
      // Claim all slots
      await claimSlotDirectly(testSlots[0].id, testUserIds.performer);
      await claimSlotDirectly(testSlots[1].id, testUserIds.performer2);
      await claimSlotDirectly(testSlots[2].id, testUserIds.host);
      await claimSlotDirectly(testSlots[3].id, testUserIds.studio);
      await claimSlotDirectly(testSlots[4].id, testUserIds.admin);

      const { data, error } = await performerClient.rpc(
        'rpc_get_available_slots_for_event',
        { event_id: testEventId }
      );

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });
  });

  describe('RPC-010: Invalid event_id', () => {
    it('should return empty array for non-existent event', async () => {
      const fakeEventId = getNonExistentUUID();

      const { data, error } = await performerClient.rpc(
        'rpc_get_available_slots_for_event',
        { event_id: fakeEventId }
      );

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });
  });

  describe('All slots available', () => {
    it('should return all slots when none are claimed', async () => {
      const { data, error } = await performerClient.rpc(
        'rpc_get_available_slots_for_event',
        { event_id: testEventId }
      );

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBe(5);
    });
  });

  describe('Slots are ordered by slot_index', () => {
    it('should return slots in slot_index order', async () => {
      const { data, error } = await performerClient.rpc(
        'rpc_get_available_slots_for_event',
        { event_id: testEventId }
      );

      expect(error).toBeNull();

      // Verify ordering
      for (let i = 0; i < data.length - 1; i++) {
        expect(data[i].slot_index).toBeLessThan(data[i + 1].slot_index);
      }
    });
  });

  describe('Anonymous user can fetch available slots', () => {
    it('should allow unauthenticated access', async () => {
      const { data, error } = await anonClient.rpc(
        'rpc_get_available_slots_for_event',
        { event_id: testEventId }
      );

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBe(5);
    });
  });

  describe('Returns complete slot data', () => {
    it('should return all slot fields', async () => {
      const { data, error } = await performerClient.rpc(
        'rpc_get_available_slots_for_event',
        { event_id: testEventId }
      );

      expect(error).toBeNull();
      expect(data.length).toBeGreaterThan(0);

      const slot = data[0];
      expect(slot).toHaveProperty('id');
      expect(slot).toHaveProperty('event_id', testEventId);
      expect(slot).toHaveProperty('performer_id', null);
      expect(slot).toHaveProperty('slot_index');
      expect(slot).toHaveProperty('start_time');
      expect(slot).toHaveProperty('end_time');
      expect(slot).toHaveProperty('created_at');
      expect(slot).toHaveProperty('updated_at');
    });
  });
});
