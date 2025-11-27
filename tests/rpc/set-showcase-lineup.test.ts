/****
 * RPC Tests: rpc_admin_set_showcase_lineup
 * Tests showcase lineup management functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  adminClient,
  createAuthenticatedClient,
  TEST_USERS
} from '../setup';
import {
  createEventWithSlots,
  deleteTestEvent,
  unclaimSlotDirectly,
} from '../fixtures';
import { getNonExistentUUID, generateUUID } from '../utils';

describe('RPC: rpc_admin_set_showcase_lineup', () => {
  let hostClient: SupabaseClient;
  let adminUserClient: SupabaseClient;

  let localUserIds: Record<string, string>;

  beforeAll(async () => {
    // Step 1: Fetch test users from Auth
    const { data: userList } = await adminClient.auth.admin.listUsers();
    const users = userList?.users ?? [];

    const host = users.find(u => u.email === TEST_USERS.host.email);
    const admin = users.find(u => u.email === TEST_USERS.admin.email);
    const performer = users.find(u => u.email === TEST_USERS.performer.email);
    const performer2 = users.find(u => u.email === TEST_USERS.performer2.email);

    if (!host || !admin || !performer || !performer2) {
      throw new Error('Test users not found. Run setup first.');
    }

    localUserIds = {
      host: host.id,
      admin: admin.id,
      performer: performer.id,
      performer2: performer2.id,
    };

    // Step 2: Create clients
    hostClient = await createAuthenticatedClient(
      TEST_USERS.host.email,
      TEST_USERS.host.password
    );
    adminUserClient = await createAuthenticatedClient(
      TEST_USERS.admin.email,
      TEST_USERS.admin.password
    );
  });

  afterAll(async () => {
    await hostClient?.auth.signOut();
    await adminUserClient?.auth.signOut();
  });

  describe('RPC-015: Valid lineup by admin', () => {
    it('should successfully set lineup as admin', async () => {
      const { event, slots } = await createEventWithSlots(localUserIds.host, 3, {
        is_showcase: true,
        title: 'Isolated Showcase Test Event',
      });
      const eventId = event.id;

      const performerIds = [
        localUserIds.performer,
        localUserIds.performer2,
        localUserIds.host,
      ];

      const { data, error } = await adminUserClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: eventId,
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

      await deleteTestEvent(eventId);
    });
  });

  describe('Valid lineup by event host', () => {
    it('should successfully set lineup as host', async () => {
      const { event, slots } = await createEventWithSlots(localUserIds.host, 3, {
        is_showcase: true,
        title: 'Isolated Showcase Test Event',
      });
      const eventId = event.id;

      const performerIds = [
        localUserIds.performer2,
        localUserIds.performer,
      ];

      // Only set 2 performers for 3 slots (partial lineup)
      const { data, error } = await hostClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: eventId,
          performer_ids: performerIds,
        }
      );

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Returns all slots, but only first 2 have performers
      expect(data[0].performer_id).toBe(performerIds[0]);
      expect(data[1].performer_id).toBe(performerIds[1]);

      await deleteTestEvent(eventId);
    });
  });

  describe('RPC-016: Not admin or host', () => {
    it('should fail when called by performer', async () => {
      const performerClient = await createAuthenticatedClient(
        TEST_USERS.performer.email,
        TEST_USERS.performer.password
      );
      const performerIds = [localUserIds.performer];

      // Using a fresh event creation to avoid relying on global event removed by instructions
      const { event, slots } = await createEventWithSlots(localUserIds.host, 3, {
        is_showcase: true,
        title: 'Isolated Showcase Test Event',
      });
      const eventId = event.id;

      const { data, error } = await performerClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: eventId,
          performer_ids: performerIds,
        }
      );

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Only admins or event host');
      await performerClient.auth.signOut();

      await deleteTestEvent(eventId);
    });
  });

  describe('RPC-017: Non-showcase event', () => {
    it('should fail for regular open mic event', async () => {
      // Create non-showcase event for this test
      const { event: nonShowcaseEvent } = await createEventWithSlots(localUserIds.host, 3, {
        title: 'Regular Open Mic',
        is_showcase: false,
      });
      const eventId = nonShowcaseEvent.id;
      const performerIds = [localUserIds.performer];

      const { data, error } = await adminUserClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: eventId,
          performer_ids: performerIds,
        }
      );

      expect(error).not.toBeNull();
      expect(error?.message).toContain('only works for showcase events');
      await deleteTestEvent(eventId);
    });
  });

  describe('RPC-018: Duplicate performer IDs', () => {
    it('should fail when same performer appears twice', async () => {
      const { event, slots } = await createEventWithSlots(localUserIds.host, 3, {
        is_showcase: true,
        title: 'Isolated Showcase Test Event',
      });
      const eventId = event.id;

      const performerIds = [
        localUserIds.performer,
        localUserIds.performer, // Duplicate!
        localUserIds.performer2,
      ];

      const { data, error } = await adminUserClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: eventId,
          performer_ids: performerIds,
        }
      );

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Duplicate performer IDs');

      await deleteTestEvent(eventId);
    });
  });

  describe('RPC-019: Invalid performer ID', () => {
    it('should fail when performer does not exist', async () => {
      const { event, slots } = await createEventWithSlots(localUserIds.host, 3, {
        is_showcase: true,
        title: 'Isolated Showcase Test Event',
      });
      const eventId = event.id;

      const fakePerformerId = getNonExistentUUID();
      const performerIds = [
        localUserIds.performer,
        fakePerformerId,
      ];

      const { data, error } = await adminUserClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: eventId,
          performer_ids: performerIds,
        }
      );

      expect(error).not.toBeNull();
      expect(error?.message).toContain('do not exist');

      await deleteTestEvent(eventId);
    });
  });

  describe('RPC-020: Not enough slots', () => {
    it('should fail when more performers than slots', async () => {
      const { event, slots } = await createEventWithSlots(localUserIds.host, 3, {
        is_showcase: true,
        title: 'Isolated Showcase Test Event',
      });
      const eventId = event.id;

      // 4 performers for 3 slots
      const performerIds = [
        localUserIds.performer,
        localUserIds.performer2,
        localUserIds.host,
        localUserIds.admin,
      ];

      const { data, error } = await adminUserClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: eventId,
          performer_ids: performerIds,
        }
      );

      expect(error).not.toBeNull();
      expect(error?.message).toContain('does not exist for this event');

      await deleteTestEvent(eventId);
    });
  });

  describe('Non-existent event', () => {
    it('should fail for non-existent event ID', async () => {
      const fakeEventId = getNonExistentUUID();
      const performerIds = [localUserIds.performer];

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
      const { event, slots } = await createEventWithSlots(localUserIds.host, 3, {
        is_showcase: true,
        title: 'Isolated Showcase Test Event',
      });
      const eventId = event.id;

      const performerIds = [
        localUserIds.performer,
        localUserIds.performer2,
        localUserIds.host,
      ];

      const { data, error } = await adminUserClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: eventId,
          performer_ids: performerIds,
        }
      );

      expect(error).toBeNull();

      // Verify ordering
      for (let i = 0; i < data.length - 1; i++) {
        expect(data[i].slot_index).toBeLessThan(data[i + 1].slot_index);
      }

      await deleteTestEvent(eventId);
    });
  });

  describe('Lineup can be updated', () => {
    it('should allow changing existing lineup', async () => {
      const { event, slots } = await createEventWithSlots(localUserIds.host, 3, {
        is_showcase: true,
        title: 'Isolated Showcase Test Event',
      });
      const eventId = event.id;

      // Set initial lineup
      await adminUserClient.rpc('rpc_admin_set_showcase_lineup', {
        event_id: eventId,
        performer_ids: [localUserIds.performer, localUserIds.performer2],
      });

      // Change lineup
      const newPerformerIds = [
        localUserIds.host,
        localUserIds.performer,
      ];

      const { data, error } = await adminUserClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: eventId,
          performer_ids: newPerformerIds,
        }
      );

      expect(error).toBeNull();
      expect(data[0].performer_id).toBe(newPerformerIds[0]);
      expect(data[1].performer_id).toBe(newPerformerIds[1]);

      await deleteTestEvent(eventId);
    });
  });
});
