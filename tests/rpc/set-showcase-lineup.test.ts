/**
 * RPC Tests: rpc_admin_set_showcase_lineup
 * Tests showcase lineup management functionality
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
  unclaimSlotDirectly,
} from '../fixtures';
import { getNonExistentUUID, generateUUID } from '../utils';

describe('RPC: rpc_admin_set_showcase_lineup', () => {
  let performerClient: SupabaseClient;
  let hostClient: SupabaseClient;
  let adminUserClient: SupabaseClient;

  let testShowcaseEventId: string;
  let testShowcaseSlots: Array<{ id: string; slot_index: number }>;
  let testNonShowcaseEventId: string;

  beforeAll(async () => {
    performerClient = await createAuthenticatedClient(
      TEST_USERS.performer.email,
      TEST_USERS.performer.password
    );
    hostClient = await createAuthenticatedClient(
      TEST_USERS.host.email,
      TEST_USERS.host.password
    );
    adminUserClient = await createAuthenticatedClient(
      TEST_USERS.admin.email,
      TEST_USERS.admin.password
    );

    // Create showcase event with 3 slots (owned by host)
    const showcase = await createEventWithSlots(testUserIds.host, 3, {
      title: 'Test Showcase',
      is_showcase: true,
    });
    testShowcaseEventId = showcase.event.id;
    testShowcaseSlots = showcase.slots;

    // Create non-showcase event for negative testing
    const nonShowcase = await createEventWithSlots(testUserIds.host, 3, {
      title: 'Regular Open Mic',
      is_showcase: false,
    });
    testNonShowcaseEventId = nonShowcase.event.id;
  });

  afterAll(async () => {
    await performerClient.auth.signOut();
    await hostClient.auth.signOut();
    await adminUserClient.auth.signOut();
    await deleteTestEvent(testShowcaseEventId);
    await deleteTestEvent(testNonShowcaseEventId);
  });

  beforeEach(async () => {
    // Reset all showcase slots
    for (const slot of testShowcaseSlots) {
      await unclaimSlotDirectly(slot.id);
    }
  });

  describe('RPC-015: Valid lineup by admin', () => {
    it('should successfully set lineup as admin', async () => {
      const performerIds = [
        testUserIds.performer,
        testUserIds.performer2,
        testUserIds.host,
      ];

      const { data, error } = await adminUserClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: testShowcaseEventId,
          performer_ids: performerIds,
        }
      );

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(3);

      // Verify lineup order
      expect(data[0].performer_id).toBe(performerIds[0]);
      expect(data[1].performer_id).toBe(performerIds[1]);
      expect(data[2].performer_id).toBe(performerIds[2]);
    });
  });

  describe('Valid lineup by event host', () => {
    it('should successfully set lineup as host', async () => {
      const performerIds = [
        testUserIds.performer2,
        testUserIds.performer,
      ];

      // Only set 2 performers for 3 slots (partial lineup)
      const { data, error } = await hostClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: testShowcaseEventId,
          performer_ids: performerIds,
        }
      );

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Returns all slots, but only first 2 have performers
      expect(data[0].performer_id).toBe(performerIds[0]);
      expect(data[1].performer_id).toBe(performerIds[1]);
    });
  });

  describe('RPC-016: Not admin or host', () => {
    it('should fail when called by performer', async () => {
      const performerIds = [testUserIds.performer];

      const { data, error } = await performerClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: testShowcaseEventId,
          performer_ids: performerIds,
        }
      );

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Only admins or event host');
    });
  });

  describe('RPC-017: Non-showcase event', () => {
    it('should fail for regular open mic event', async () => {
      const performerIds = [testUserIds.performer];

      const { data, error } = await adminUserClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: testNonShowcaseEventId,
          performer_ids: performerIds,
        }
      );

      expect(error).not.toBeNull();
      expect(error?.message).toContain('only works for showcase events');
    });
  });

  describe('RPC-018: Duplicate performer IDs', () => {
    it('should fail when same performer appears twice', async () => {
      const performerIds = [
        testUserIds.performer,
        testUserIds.performer, // Duplicate!
        testUserIds.performer2,
      ];

      const { data, error } = await adminUserClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: testShowcaseEventId,
          performer_ids: performerIds,
        }
      );

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Duplicate performer IDs');
    });
  });

  describe('RPC-019: Invalid performer ID', () => {
    it('should fail when performer does not exist', async () => {
      const fakePerformerId = getNonExistentUUID();
      const performerIds = [
        testUserIds.performer,
        fakePerformerId,
      ];

      const { data, error } = await adminUserClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: testShowcaseEventId,
          performer_ids: performerIds,
        }
      );

      expect(error).not.toBeNull();
      expect(error?.message).toContain('do not exist');
    });
  });

  describe('RPC-020: Not enough slots', () => {
    it('should fail when more performers than slots', async () => {
      // 4 performers for 3 slots
      const performerIds = [
        testUserIds.performer,
        testUserIds.performer2,
        testUserIds.host,
        testUserIds.studio,
      ];

      const { data, error } = await adminUserClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: testShowcaseEventId,
          performer_ids: performerIds,
        }
      );

      expect(error).not.toBeNull();
      expect(error?.message).toContain('does not exist for this event');
    });
  });

  describe('Non-existent event', () => {
    it('should fail for non-existent event ID', async () => {
      const fakeEventId = getNonExistentUUID();
      const performerIds = [testUserIds.performer];

      const { data, error } = await adminUserClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: fakeEventId,
          performer_ids: performerIds,
        }
      );

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Event not found');
    });
  });

  describe('Returns all event slots ordered', () => {
    it('should return slots ordered by slot_index', async () => {
      const performerIds = [
        testUserIds.performer,
        testUserIds.performer2,
        testUserIds.host,
      ];

      const { data, error } = await adminUserClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: testShowcaseEventId,
          performer_ids: performerIds,
        }
      );

      expect(error).toBeNull();

      // Verify ordering
      for (let i = 0; i < data.length - 1; i++) {
        expect(data[i].slot_index).toBeLessThan(data[i + 1].slot_index);
      }
    });
  });

  describe('Lineup can be updated', () => {
    it('should allow changing existing lineup', async () => {
      // Set initial lineup
      await adminUserClient.rpc('rpc_admin_set_showcase_lineup', {
        event_id: testShowcaseEventId,
        performer_ids: [testUserIds.performer, testUserIds.performer2],
      });

      // Change lineup
      const newPerformerIds = [
        testUserIds.host,
        testUserIds.performer,
      ];

      const { data, error } = await adminUserClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: testShowcaseEventId,
          performer_ids: newPerformerIds,
        }
      );

      expect(error).toBeNull();
      expect(data[0].performer_id).toBe(newPerformerIds[0]);
      expect(data[1].performer_id).toBe(newPerformerIds[1]);
    });
  });
});
