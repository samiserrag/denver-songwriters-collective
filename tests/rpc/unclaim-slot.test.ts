/**
 * RPC Tests: rpc_unclaim_open_mic_slot
 * Tests slot unclaiming functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  adminClient,
  createAuthenticatedClient,
  TEST_USERS,
  testUserIds,
} from '../setup';
import {
  createEventWithSlots,
  deleteTestEvent,
  claimSlotDirectly,
  unclaimSlotDirectly,
} from '../fixtures';
import { getNonExistentUUID } from '../utils';

describe('RPC: rpc_unclaim_open_mic_slot', () => {
  let performerClient: SupabaseClient;
  let performer2Client: SupabaseClient;

  let testEventId: string;
  let testSlots: Array<{ id: string; slot_index: number }>;

  beforeAll(async () => {
    performerClient = await createAuthenticatedClient(
      TEST_USERS.performer.email,
      TEST_USERS.performer.password
    );
    performer2Client = await createAuthenticatedClient(
      TEST_USERS.performer2.email,
      TEST_USERS.performer2.password
    );

    // Create event with 3 slots
    const { event, slots } = await createEventWithSlots(testUserIds.host, 3);
    testEventId = event.id;
    testSlots = slots;
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

  describe('RPC-005: Valid unclaim of owned slot', () => {
    it('should successfully unclaim a slot the user owns', async () => {
      const slotId = testSlots[0].id;

      // First, claim the slot
      await claimSlotDirectly(slotId, testUserIds.performer);

      // Then unclaim it
      const { data, error } = await performerClient.rpc('rpc_unclaim_open_mic_slot', {
        slot_id: slotId,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Verify the slot is now unclaimed
      const result = Array.isArray(data) ? data[0] : data;
      expect(result.performer_id).toBeNull();
      expect(result.id).toBe(slotId);
    });
  });

  describe('RPC-006: Not owner - slot belongs to another user', () => {
    it('should fail when trying to unclaim another user slot', async () => {
      const slotId = testSlots[0].id;

      // Claim as performer2
      await claimSlotDirectly(slotId, testUserIds.performer2);

      // Try to unclaim as performer1
      const { data, error } = await performerClient.rpc('rpc_unclaim_open_mic_slot', {
        slot_id: slotId,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('does not belong to you');
    });
  });

  describe('RPC-007: Already empty slot', () => {
    it('should fail when trying to unclaim an empty slot', async () => {
      const slotId = testSlots[0].id;

      // Slot is already empty (from beforeEach)
      const { data, error } = await performerClient.rpc('rpc_unclaim_open_mic_slot', {
        slot_id: slotId,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('does not belong to you');
    });
  });

  describe('Unclaim returns correct slot data', () => {
    it('should return complete slot object with null performer_id', async () => {
      const slotId = testSlots[1].id;

      // First claim it
      await claimSlotDirectly(slotId, testUserIds.performer);

      // Then unclaim
      const { data, error } = await performerClient.rpc('rpc_unclaim_open_mic_slot', {
        slot_id: slotId,
      });

      expect(error).toBeNull();

      const result = Array.isArray(data) ? data[0] : data;
      expect(result).toHaveProperty('id', slotId);
      expect(result).toHaveProperty('event_id', testEventId);
      expect(result).toHaveProperty('performer_id', null);
      expect(result).toHaveProperty('slot_index');
      expect(result).toHaveProperty('updated_at');
    });
  });

  describe('Can reclaim after unclaiming', () => {
    it('should allow user to claim again after unclaiming', async () => {
      const slotId = testSlots[0].id;

      // Claim
      await performerClient.rpc('rpc_claim_open_mic_slot', { slot_id: slotId });

      // Unclaim
      await performerClient.rpc('rpc_unclaim_open_mic_slot', { slot_id: slotId });

      // Claim again
      const { data, error } = await performerClient.rpc('rpc_claim_open_mic_slot', {
        slot_id: slotId,
      });

      expect(error).toBeNull();
      const result = Array.isArray(data) ? data[0] : data;
      expect(result.performer_id).toBe(testUserIds.performer);
    });
  });

  describe('Other user can claim after unclaim', () => {
    it('should allow another user to claim a freshly unclaimed slot', async () => {
      const slotId = testSlots[0].id;

      // Performer 1 claims
      await performerClient.rpc('rpc_claim_open_mic_slot', { slot_id: slotId });

      // Performer 1 unclaims
      await performerClient.rpc('rpc_unclaim_open_mic_slot', { slot_id: slotId });

      // Performer 2 claims
      const { data, error } = await performer2Client.rpc('rpc_claim_open_mic_slot', {
        slot_id: slotId,
      });

      expect(error).toBeNull();
      const result = Array.isArray(data) ? data[0] : data;
      expect(result.performer_id).toBe(testUserIds.performer2);
    });
  });
});
