/**
 * RPC Tests: rpc_claim_open_mic_slot
 * Tests slot claiming functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  adminClient,
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

describe('RPC: rpc_claim_open_mic_slot', () => {
  let performerClient: SupabaseClient;
  let performer2Client: SupabaseClient;

  let testEventId: string;
  let testSlots: Array<{ id: string; slot_index: number }>;

  beforeAll(async () => {
    await ensureTestSetup();

    if (!testUserIds.performer || !testUserIds.performer2 || !testUserIds.host) {
      throw new Error('Test user IDs not properly initialized');
    }

    performerClient = await createAuthenticatedClient(
      TEST_USERS.performer.email,
      TEST_USERS.performer.password
    );
    performer2Client = await createAuthenticatedClient(
      TEST_USERS.performer2.email,
      TEST_USERS.performer2.password
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
    await performer2Client.auth.signOut();
    await deleteTestEvent(testEventId);
  });

  beforeEach(async () => {
    // Reset all slots to unclaimed before each test
    for (const slot of testSlots) {
      await unclaimSlotDirectly(slot.id);
    }
  });

  describe('RPC-001: Valid claim on empty slot', () => {
    it('should successfully claim an empty slot', async () => {
      const slotId = testSlots[0].id;

      const { data, error } = await performerClient.rpc('rpc_claim_open_mic_slot', {
        slot_id: slotId,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Verify the slot is now claimed
      const result = Array.isArray(data) ? data[0] : data;
      expect(result.performer_id).toBe(testUserIds.performer);
      expect(result.id).toBe(slotId);
    });
  });

  describe('RPC-002: Slot already taken', () => {
    it('should fail when slot is already claimed by another', async () => {
      const slotId = testSlots[0].id;

      // First, claim as performer2
      await claimSlotDirectly(slotId, testUserIds.performer2);

      // Try to claim as performer1
      const { data, error } = await performerClient.rpc('rpc_claim_open_mic_slot', {
        slot_id: slotId,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Slot not available');
    });
  });

  describe('RPC-003: User already has slot in event', () => {
    it('should fail when user already has a slot in this event', async () => {
      const slot1Id = testSlots[0].id;
      const slot2Id = testSlots[1].id;

      // First, claim slot 1
      await performerClient.rpc('rpc_claim_open_mic_slot', {
        slot_id: slot1Id,
      });

      // Try to claim slot 2
      const { data, error } = await performerClient.rpc('rpc_claim_open_mic_slot', {
        slot_id: slot2Id,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Slot not available');
      expect(error?.message).toContain('already have a slot');
    });
  });

  describe('RPC-004: Invalid slot_id', () => {
    it('should fail with non-existent slot UUID', async () => {
      const fakeSlotId = getNonExistentUUID();

      const { data, error } = await performerClient.rpc('rpc_claim_open_mic_slot', {
        slot_id: fakeSlotId,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Slot not available');
    });
  });

  describe('Claim returns correct slot data', () => {
    it('should return complete slot object with updated fields', async () => {
      const slotId = testSlots[2].id;

      const { data, error } = await performerClient.rpc('rpc_claim_open_mic_slot', {
        slot_id: slotId,
      });

      expect(error).toBeNull();

      const result = Array.isArray(data) ? data[0] : data;
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('event_id');
      expect(result).toHaveProperty('performer_id');
      expect(result).toHaveProperty('slot_index');
      expect(result).toHaveProperty('start_time');
      expect(result).toHaveProperty('end_time');
      expect(result).toHaveProperty('updated_at');
    });
  });

  describe('Multiple users can claim different slots', () => {
    it('should allow different users to claim different slots', async () => {
      const slot1Id = testSlots[0].id;
      const slot2Id = testSlots[1].id;

      // Performer 1 claims slot 1
      const { error: error1 } = await performerClient.rpc('rpc_claim_open_mic_slot', {
        slot_id: slot1Id,
      });
      expect(error1).toBeNull();

      // Performer 2 claims slot 2
      const { error: error2 } = await performer2Client.rpc('rpc_claim_open_mic_slot', {
        slot_id: slot2Id,
      });
      expect(error2).toBeNull();

      // Verify both slots are claimed correctly
      const { data: slots } = await adminClient
        .from('event_slots')
        .select('*')
        .in('id', [slot1Id, slot2Id]);

      const slot1 = slots?.find((s) => s.id === slot1Id);
      const slot2 = slots?.find((s) => s.id === slot2Id);

      expect(slot1?.performer_id).toBe(testUserIds.performer);
      expect(slot2?.performer_id).toBe(testUserIds.performer2);
    });
  });
});
