/**
 * Concurrency Tests: Race Condition Simulations
 * Tests FOR UPDATE locking and concurrent access patterns
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
  createTestService,
  deleteTestEvent,
  deleteTestService,
  unclaimSlotDirectly,
} from '../fixtures';
import { runConcurrently, countResults, getErrorMessages, getFutureTime } from '../utils';

describe('Concurrency: Race Condition Tests', () => {
  // ============================================
  // SLOT CLAIMING CONCURRENCY
  // ============================================

  describe('rpc_claim_open_mic_slot concurrency', () => {
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

      const { event, slots } = await createEventWithSlots(testUserIds.host, 5);
      testEventId = event.id;
      testSlots = slots;
    });

    afterAll(async () => {
      await performerClient.auth.signOut();
      await performer2Client.auth.signOut();
      await deleteTestEvent(testEventId);
    });

    beforeEach(async () => {
      for (const slot of testSlots) {
        await unclaimSlotDirectly(slot.id);
      }
    });

    describe('CONC-001: Two users claim same slot simultaneously', () => {
      it('should allow exactly one claim to succeed', async () => {
        const slotId = testSlots[0].id;

        // Execute both claims concurrently
        const results = await runConcurrently([
          () => performerClient.rpc('rpc_claim_open_mic_slot', { slot_id: slotId }),
          () => performer2Client.rpc('rpc_claim_open_mic_slot', { slot_id: slotId }),
        ]);

        // Count successes and failures
        const successes = results.filter(
          (r) => r.status === 'fulfilled' && !(r.value as any).error
        );
        const failures = results.filter(
          (r) => r.status === 'rejected' || (r.status === 'fulfilled' && (r.value as any).error)
        );

        // Exactly one should succeed
        expect(successes.length).toBe(1);
        expect(failures.length).toBe(1);

        // Verify database state
        const { data: slot } = await adminClient
          .from('event_slots')
          .select('performer_id')
          .eq('id', slotId)
          .single();

        // One of the two users should own it
        expect([testUserIds.performer, testUserIds.performer2]).toContain(
          slot?.performer_id
        );
      });
    });

    describe('CONC-002: Same user claims two slots simultaneously', () => {
      it('should allow exactly one claim to succeed', async () => {
        const slot1Id = testSlots[0].id;
        const slot2Id = testSlots[1].id;

        const results = await runConcurrently([
          () => performerClient.rpc('rpc_claim_open_mic_slot', { slot_id: slot1Id }),
          () => performerClient.rpc('rpc_claim_open_mic_slot', { slot_id: slot2Id }),
        ]);

        const successes = results.filter(
          (r) => r.status === 'fulfilled' && !(r.value as any).error
        );

        // Due to "one slot per event" rule, only one should succeed
        expect(successes.length).toBe(1);

        // Verify only one slot is claimed
        const { data: slots } = await adminClient
          .from('event_slots')
          .select('performer_id')
          .in('id', [slot1Id, slot2Id]);

        const claimed = slots?.filter((s) => s.performer_id === testUserIds.performer);
        expect(claimed?.length).toBe(1);
      });
    });

    describe('CONC-003: Multiple users claim multiple slots', () => {
      it('should handle high concurrency correctly', async () => {
        // Create additional test clients
        const hostClient = await createAuthenticatedClient(
          TEST_USERS.host.email,
          TEST_USERS.host.password
        );
        const studioClient = await createAuthenticatedClient(
          TEST_USERS.studio.email,
          TEST_USERS.studio.password
        );
        const adminUserClient = await createAuthenticatedClient(
          TEST_USERS.admin.email,
          TEST_USERS.admin.password
        );

        // 5 users try to claim 5 slots
        const slotIds = testSlots.map((s) => s.id);
        const clients = [
          performerClient,
          performer2Client,
          hostClient,
          studioClient,
          adminUserClient,
        ];

        const claims: Array<() => Promise<any>> = [];
        for (let i = 0; i < 5; i++) {
          for (let j = 0; j < 5; j++) {
            claims.push(() =>
              clients[i].rpc('rpc_claim_open_mic_slot', { slot_id: slotIds[j] })
            );
          }
        }

        await runConcurrently(claims);

        // Each user should have at most 1 slot
        const { data: slots } = await adminClient
          .from('event_slots')
          .select('performer_id')
          .eq('event_id', testEventId)
          .not('performer_id', 'is', null);

        const performerCounts = new Map<string, number>();
        slots?.forEach((s) => {
          const count = performerCounts.get(s.performer_id) || 0;
          performerCounts.set(s.performer_id, count + 1);
        });

        // No performer should have more than 1 slot
        performerCounts.forEach((count) => {
          expect(count).toBeLessThanOrEqual(1);
        });

        // Cleanup
        await hostClient.auth.signOut();
        await studioClient.auth.signOut();
        await adminUserClient.auth.signOut();
      });
    });
  });

  // ============================================
  // STUDIO BOOKING CONCURRENCY
  // ============================================

  describe('rpc_book_studio_service concurrency', () => {
    let performerClient: SupabaseClient;
    let performer2Client: SupabaseClient;
    let testServiceId: string;

    beforeAll(async () => {
      performerClient = await createAuthenticatedClient(
        TEST_USERS.performer.email,
        TEST_USERS.performer.password
      );
      performer2Client = await createAuthenticatedClient(
        TEST_USERS.performer2.email,
        TEST_USERS.performer2.password
      );

      const service = await createTestService(testUserIds.studio, {
        duration_min: 60,
      });
      testServiceId = service.id;
    });

    afterAll(async () => {
      await performerClient.auth.signOut();
      await performer2Client.auth.signOut();
      await deleteTestService(testServiceId);
    });

    beforeEach(async () => {
      await adminClient
        .from('studio_appointments')
        .delete()
        .eq('service_id', testServiceId);
    });

    describe('CONC-010: Two users book same time simultaneously', () => {
      it('should allow exactly one booking to succeed', async () => {
        const desiredTime = getFutureTime(14, 10); // 2 weeks from now at 10 AM

        const results = await runConcurrently([
          () =>
            performerClient.rpc('rpc_book_studio_service', {
              service_id: testServiceId,
              desired_time: desiredTime,
            }),
          () =>
            performer2Client.rpc('rpc_book_studio_service', {
              service_id: testServiceId,
              desired_time: desiredTime,
            }),
        ]);

        const successes = results.filter(
          (r) => r.status === 'fulfilled' && !(r.value as any).error
        );

        // Exactly one should succeed
        expect(successes.length).toBe(1);

        // Verify only one appointment exists
        const { data: appointments } = await adminClient
          .from('studio_appointments')
          .select('*')
          .eq('service_id', testServiceId);

        expect(appointments?.length).toBe(1);
      });
    });

    describe('CONC-011: Overlapping appointments', () => {
      it('should detect overlap correctly under concurrency', async () => {
        // Book at 10:00 and 10:30 (overlap for 60-min service)
        const time1 = new Date(getFutureTime(15, 10));
        const time2 = new Date(time1);
        time2.setMinutes(30);

        const results = await runConcurrently([
          () =>
            performerClient.rpc('rpc_book_studio_service', {
              service_id: testServiceId,
              desired_time: time1.toISOString(),
            }),
          () =>
            performer2Client.rpc('rpc_book_studio_service', {
              service_id: testServiceId,
              desired_time: time2.toISOString(),
            }),
        ]);

        const successes = results.filter(
          (r) => r.status === 'fulfilled' && !(r.value as any).error
        );

        // Only one should succeed (they overlap)
        expect(successes.length).toBe(1);
      });
    });

    describe('CONC-012: Non-overlapping appointments', () => {
      it('should allow both bookings when no overlap', async () => {
        // Book at 10:00 and 11:00 (no overlap for 60-min service)
        const time1 = getFutureTime(16, 10);
        const time2 = getFutureTime(16, 11);

        const results = await runConcurrently([
          () =>
            performerClient.rpc('rpc_book_studio_service', {
              service_id: testServiceId,
              desired_time: time1,
            }),
          () =>
            performer2Client.rpc('rpc_book_studio_service', {
              service_id: testServiceId,
              desired_time: time2,
            }),
        ]);

        const successes = results.filter(
          (r) => r.status === 'fulfilled' && !(r.value as any).error
        );

        // Both should succeed
        expect(successes.length).toBe(2);

        // Verify two appointments exist
        const { data: appointments } = await adminClient
          .from('studio_appointments')
          .select('*')
          .eq('service_id', testServiceId);

        expect(appointments?.length).toBe(2);
      });
    });
  });

  // ============================================
  // SHOWCASE LINEUP CONCURRENCY
  // ============================================

  describe('rpc_admin_set_showcase_lineup concurrency', () => {
    let adminUserClient: SupabaseClient;
    let hostClient: SupabaseClient;
    let testEventId: string;
    let testSlots: Array<{ id: string }>;

    beforeAll(async () => {
      adminUserClient = await createAuthenticatedClient(
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );
      hostClient = await createAuthenticatedClient(
        TEST_USERS.host.email,
        TEST_USERS.host.password
      );

      const { event, slots } = await createEventWithSlots(testUserIds.host, 3, {
        is_showcase: true,
      });
      testEventId = event.id;
      testSlots = slots;
    });

    afterAll(async () => {
      await adminUserClient.auth.signOut();
      await hostClient.auth.signOut();
      await deleteTestEvent(testEventId);
    });

    beforeEach(async () => {
      for (const slot of testSlots) {
        await unclaimSlotDirectly(slot.id);
      }
    });

    describe('CONC-020: Two admins set lineup simultaneously', () => {
      it('should result in atomic final lineup', async () => {
        const lineup1 = [testUserIds.performer, testUserIds.performer2];
        const lineup2 = [testUserIds.host, testUserIds.studio];

        await runConcurrently([
          () =>
            adminUserClient.rpc('rpc_admin_set_showcase_lineup', {
              event_id: testEventId,
              performer_ids: lineup1,
            }),
          () =>
            hostClient.rpc('rpc_admin_set_showcase_lineup', {
              event_id: testEventId,
              performer_ids: lineup2,
            }),
        ]);

        // Verify final state is one of the two lineups (not mixed)
        const { data: finalSlots } = await adminClient
          .from('event_slots')
          .select('slot_index, performer_id')
          .eq('event_id', testEventId)
          .order('slot_index');

        const finalLineup = finalSlots?.slice(0, 2).map((s) => s.performer_id);

        // Final lineup should be either lineup1 or lineup2 (atomic)
        const isLineup1 =
          finalLineup?.[0] === lineup1[0] && finalLineup?.[1] === lineup1[1];
        const isLineup2 =
          finalLineup?.[0] === lineup2[0] && finalLineup?.[1] === lineup2[1];

        // NOTE: Due to HIGH-3 issue (missing FOR UPDATE), this test may fail
        // with interleaved results. After fix, expect one of the two lineups.
        expect(isLineup1 || isLineup2).toBe(true);
      });
    });
  });
});
