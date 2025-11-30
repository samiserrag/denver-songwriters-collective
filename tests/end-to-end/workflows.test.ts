/**
 * End-to-End Workflow Tests
 * Tests complete user flows from start to finish
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
  createTestService,
  deleteTestEvent,
  deleteTestService,
  unclaimSlotDirectly,
} from '../fixtures';
import { getFutureTime, wait } from '../utils';

describe('E2E: User Workflows', () => {
  // ============================================
  // WORKFLOW 1: Open Mic Slot Claiming
  // ============================================

  describe('Open Mic Slot Claiming Workflow', () => {
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

      const { event, slots } = await createEventWithSlots(testUserIds.host, 5, {
        title: 'E2E Test Open Mic',
      });
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
      for (const slot of testSlots) {
        await unclaimSlotDirectly(slot.id);
      }
    });

    it('complete workflow: view → claim → verify → unclaim → verify', async () => {
      // STEP 1: View available slots
      const { data: availableSlots1, error: fetchError1 } = await performerClient.rpc(
        'rpc_get_available_slots_for_event',
        { event_id: testEventId }
      );

      expect(fetchError1).toBeNull();
      expect(availableSlots1.length).toBe(5);

      // STEP 2: Claim a slot
      const slotToClaim = testSlots[2];
      const { data: claimedSlot, error: claimError } = await performerClient.rpc(
        'rpc_claim_open_mic_slot',
        { slot_id: slotToClaim.id }
      );

      expect(claimError).toBeNull();
      const claimed = Array.isArray(claimedSlot) ? claimedSlot[0] : claimedSlot;
      expect(claimed.performer_id).toBe(testUserIds.performer);

      // STEP 3: Verify slot is no longer available
      const { data: availableSlots2 } = await performerClient.rpc(
        'rpc_get_available_slots_for_event',
        { event_id: testEventId }
      );

      expect(availableSlots2.length).toBe(4);
      expect(availableSlots2.find((s: any) => s.id === slotToClaim.id)).toBeUndefined();

      // STEP 4: Attempt to claim second slot (should fail)
      const { error: secondClaimError } = await performerClient.rpc(
        'rpc_claim_open_mic_slot',
        { slot_id: testSlots[3].id }
      );

      expect(secondClaimError).not.toBeNull();
      expect(secondClaimError?.message).toContain('already have a slot');

      // STEP 5: Unclaim the slot
      const { data: unclaimedSlot, error: unclaimError } = await performerClient.rpc(
        'rpc_unclaim_open_mic_slot',
        { slot_id: slotToClaim.id }
      );

      expect(unclaimError).toBeNull();
      const unclaimed = Array.isArray(unclaimedSlot) ? unclaimedSlot[0] : unclaimedSlot;
      expect(unclaimed.performer_id).toBeNull();

      // STEP 6: Verify slot is available again
      const { data: availableSlots3 } = await performerClient.rpc(
        'rpc_get_available_slots_for_event',
        { event_id: testEventId }
      );

      expect(availableSlots3.length).toBe(5);

      // STEP 7: Other user can now claim the unclaimed slot
      const { data: newClaim, error: newClaimError } = await performer2Client.rpc(
        'rpc_claim_open_mic_slot',
        { slot_id: slotToClaim.id }
      );

      expect(newClaimError).toBeNull();
      const newClaimed = Array.isArray(newClaim) ? newClaim[0] : newClaim;
      expect(newClaimed.performer_id).toBe(testUserIds.performer2);
    });

    it('competing users: first-come-first-served for last slot', async () => {
      // Claim 4 of 5 slots directly
      for (let i = 0; i < 4; i++) {
        await adminClient
          .from('event_slots')
          .update({ performer_id: testUserIds.host })
          .eq('id', testSlots[i].id);
      }

      const lastSlotId = testSlots[4].id;

      // Both users try to claim the last slot
      const results = await Promise.allSettled([
        performerClient.rpc('rpc_claim_open_mic_slot', { slot_id: lastSlotId }),
        performer2Client.rpc('rpc_claim_open_mic_slot', { slot_id: lastSlotId }),
      ]);

      // Count successes
      const successes = results.filter((r) => {
        if (r.status === 'rejected') return false;
        return !r.value.error;
      });

      expect(successes.length).toBe(1);

      // Verify final state
      const { data: finalSlot } = await adminClient
        .from('event_slots')
        .select('performer_id')
        .eq('id', lastSlotId)
        .single();

      expect([testUserIds.performer, testUserIds.performer2]).toContain(
        finalSlot?.performer_id
      );
    });
  });

  // ============================================
  // WORKFLOW 2: Studio Booking
  // ============================================

  describe('Studio Booking Workflow', () => {
    let performerClient: SupabaseClient;
    let performer2Client: SupabaseClient;
    let testServiceId: string;

    beforeAll(async () => {
      await ensureTestSetup();

      if (!testUserIds.performer || !testUserIds.performer2 || !testUserIds.studio) {
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

      const service = await createTestService(testUserIds.studio, {
        name: 'E2E Recording Session',
        duration_min: 60,
        price_cents: 5000,
      });
      testServiceId = service.id;

      // Verify service exists
      const { data: verifyService, error: verifyError } = await adminClient
        .from('studio_services')
        .select('id')
        .eq('id', testServiceId)
        .single();

      if (verifyError || !verifyService) {
        throw new Error(`Test setup failed: service ${testServiceId} not visible in DB. Error: ${verifyError?.message}`);
      }
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

    it('complete workflow: book → verify → attempt duplicate → book different time', async () => {
      const bookingTime1 = getFutureTime(7, 14); // 1 week, 2 PM
      const bookingTime2 = getFutureTime(7, 15); // 1 week, 3 PM

      // STEP 1: Book first appointment
      const { data: appt1, error: bookError1 } = await performerClient.rpc(
        'rpc_book_studio_service',
        {
          service_id: testServiceId,
          desired_time: bookingTime1,
        }
      );

      expect(bookError1).toBeNull();
      const appointment1 = Array.isArray(appt1) ? appt1[0] : appt1;
      expect(appointment1.status).toBe('pending');
      expect(appointment1.performer_id).toBe(testUserIds.performer);

      // STEP 2: Verify appointment in database
      const { data: verifyAppt } = await adminClient
        .from('studio_appointments')
        .select('*')
        .eq('id', appointment1.id)
        .single();

      expect(verifyAppt?.service_id).toBe(testServiceId);

      // STEP 3: Attempt to book same time (should fail)
      const { error: duplicateError } = await performer2Client.rpc(
        'rpc_book_studio_service',
        {
          service_id: testServiceId,
          desired_time: bookingTime1,
        }
      );

      expect(duplicateError).not.toBeNull();
      expect(duplicateError?.message).toContain('Time slot already booked');

      // STEP 4: Book different (adjacent) time
      const { data: appt2, error: bookError2 } = await performer2Client.rpc(
        'rpc_book_studio_service',
        {
          service_id: testServiceId,
          desired_time: bookingTime2,
        }
      );

      expect(bookError2).toBeNull();
      const appointment2 = Array.isArray(appt2) ? appt2[0] : appt2;
      expect(appointment2.performer_id).toBe(testUserIds.performer2);

      // STEP 5: Verify both appointments exist
      const { data: allAppts } = await adminClient
        .from('studio_appointments')
        .select('*')
        .eq('service_id', testServiceId);

      expect(allAppts?.length).toBe(2);
    });

    it('trigger protection: cannot change appointment_time after booking', async () => {
      const originalTime = getFutureTime(10, 10);
      const newTime = getFutureTime(10, 16);

      // Book appointment
      const { data: appt } = await performerClient.rpc('rpc_book_studio_service', {
        service_id: testServiceId,
        desired_time: originalTime,
      });

      const appointment = Array.isArray(appt) ? appt[0] : appt;

      // Attempt to change time
      const { error: updateError } = await performerClient
        .from('studio_appointments')
        .update({ appointment_time: newTime })
        .eq('id', appointment.id);

      expect(updateError).not.toBeNull();
      expect(updateError?.message).toContain('Cannot change the appointment time');
    });
  });

  // ============================================
  // WORKFLOW 3: Showcase Lineup Management
  // ============================================

  describe('Showcase Lineup Management Workflow', () => {
    let hostClient: SupabaseClient;
    let adminUserClient: SupabaseClient;
    let performerClient: SupabaseClient;
    let testShowcaseId: string;
    let testSlots: Array<{ id: string }>;

    beforeAll(async () => {
      await ensureTestSetup();

      if (!testUserIds.host || !testUserIds.admin || !testUserIds.performer) {
        throw new Error('Test user IDs not properly initialized');
      }

      hostClient = await createAuthenticatedClient(
        TEST_USERS.host.email,
        TEST_USERS.host.password
      );
      adminUserClient = await createAuthenticatedClient(
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );
      performerClient = await createAuthenticatedClient(
        TEST_USERS.performer.email,
        TEST_USERS.performer.password
      );

      const { event, slots } = await createEventWithSlots(testUserIds.host, 4, {
        title: 'E2E Showcase',
        is_showcase: true,
      });
      testShowcaseId = event.id;
      testSlots = slots;

      // Verify event exists
      const { data: verifyEvent, error: verifyError } = await adminClient
        .from('events')
        .select('id')
        .eq('id', testShowcaseId)
        .single();

      if (verifyError || !verifyEvent) {
        throw new Error(`Test setup failed: event ${testShowcaseId} not visible in DB. Error: ${verifyError?.message}`);
      }
    });

    afterAll(async () => {
      await hostClient.auth.signOut();
      await adminUserClient.auth.signOut();
      await performerClient.auth.signOut();
      await deleteTestEvent(testShowcaseId);
    });

    beforeEach(async () => {
      for (const slot of testSlots) {
        await unclaimSlotDirectly(slot.id);
      }
    });

    it('complete workflow: host sets lineup → verify → update lineup → verify', async () => {
      const initialLineup = [testUserIds.performer, testUserIds.performer2];

      // STEP 1: Host sets initial lineup
      const { data: slots1, error: setError1 } = await hostClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: testShowcaseId,
          performer_ids: initialLineup,
        }
      );

      expect(setError1).toBeNull();
      expect(slots1[0].performer_id).toBe(initialLineup[0]);
      expect(slots1[1].performer_id).toBe(initialLineup[1]);

      // STEP 2: Verify in database
      const { data: verifySlots1 } = await adminClient
        .from('event_slots')
        .select('slot_index, performer_id')
        .eq('event_id', testShowcaseId)
        .order('slot_index');

      expect(verifySlots1?.[0].performer_id).toBe(initialLineup[0]);
      expect(verifySlots1?.[1].performer_id).toBe(initialLineup[1]);

      // STEP 3: Update lineup (reorder + add)
      const updatedLineup = [testUserIds.performer2, testUserIds.host, testUserIds.performer];

      const { data: slots2, error: setError2 } = await hostClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: testShowcaseId,
          performer_ids: updatedLineup,
        }
      );

      expect(setError2).toBeNull();
      expect(slots2[0].performer_id).toBe(updatedLineup[0]);
      expect(slots2[1].performer_id).toBe(updatedLineup[1]);
      expect(slots2[2].performer_id).toBe(updatedLineup[2]);

      // STEP 4: Verify update persisted
      const { data: verifySlots2 } = await adminClient
        .from('event_slots')
        .select('slot_index, performer_id')
        .eq('event_id', testShowcaseId)
        .order('slot_index');

      expect(verifySlots2?.[0].performer_id).toBe(updatedLineup[0]);
      expect(verifySlots2?.[1].performer_id).toBe(updatedLineup[1]);
      expect(verifySlots2?.[2].performer_id).toBe(updatedLineup[2]);
    });

    it('authorization: performer cannot set lineup', async () => {
      const { error } = await performerClient.rpc('rpc_admin_set_showcase_lineup', {
        event_id: testShowcaseId,
        performer_ids: [testUserIds.performer],
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Only admins or event host');
    });

    it('authorization: admin can set any showcase lineup', async () => {
      const { data, error } = await adminUserClient.rpc(
        'rpc_admin_set_showcase_lineup',
        {
          event_id: testShowcaseId,
          performer_ids: [testUserIds.admin],
        }
      );

      expect(error).toBeNull();
      const slots = Array.isArray(data) ? data : [data];
      expect(slots[0].performer_id).toBe(testUserIds.admin);
    });

    it('validation: duplicate performers rejected', async () => {
      const { error } = await hostClient.rpc('rpc_admin_set_showcase_lineup', {
        event_id: testShowcaseId,
        performer_ids: [testUserIds.performer, testUserIds.performer],
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Duplicate performer IDs');
    });
  });

  // ============================================
  // WORKFLOW 4: Multi-User Interaction
  // ============================================

  describe('Multi-User Interaction Workflow', () => {
    let performer1: SupabaseClient;
    let performer2: SupabaseClient;
    let host: SupabaseClient;
    let testEventId: string;
    let testSlots: Array<{ id: string; slot_index: number }>;

    beforeAll(async () => {
      await ensureTestSetup();

      if (!testUserIds.performer || !testUserIds.performer2 || !testUserIds.host) {
        throw new Error('Test user IDs not properly initialized');
      }

      performer1 = await createAuthenticatedClient(
        TEST_USERS.performer.email,
        TEST_USERS.performer.password
      );
      performer2 = await createAuthenticatedClient(
        TEST_USERS.performer2.email,
        TEST_USERS.performer2.password
      );
      host = await createAuthenticatedClient(
        TEST_USERS.host.email,
        TEST_USERS.host.password
      );

      const { event, slots } = await createEventWithSlots(testUserIds.host, 3, {
        title: 'Multi-User E2E',
      });
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
      await performer1.auth.signOut();
      await performer2.auth.signOut();
      await host.auth.signOut();
      await deleteTestEvent(testEventId);
    });

    beforeEach(async () => {
      for (const slot of testSlots) {
        await unclaimSlotDirectly(slot.id);
      }
    });

    it('real-time scenario: slot availability updates as users claim', async () => {
      // All users see 3 available slots initially
      const [check1, check2, check3] = await Promise.all([
        performer1.rpc('rpc_get_available_slots_for_event', { event_id: testEventId }),
        performer2.rpc('rpc_get_available_slots_for_event', { event_id: testEventId }),
        host.rpc('rpc_get_available_slots_for_event', { event_id: testEventId }),
      ]);

      expect(check1.data.length).toBe(3);
      expect(check2.data.length).toBe(3);
      expect(check3.data.length).toBe(3);

      // Performer 1 claims slot 1
      await performer1.rpc('rpc_claim_open_mic_slot', { slot_id: testSlots[0].id });

      // Small delay to ensure consistency
      await wait(100);

      // Others now see 2 available
      const [recheck1, recheck2] = await Promise.all([
        performer2.rpc('rpc_get_available_slots_for_event', { event_id: testEventId }),
        host.rpc('rpc_get_available_slots_for_event', { event_id: testEventId }),
      ]);

      expect(recheck1.data.length).toBe(2);
      expect(recheck2.data.length).toBe(2);

      // Performer 2 claims slot 2
      await performer2.rpc('rpc_claim_open_mic_slot', { slot_id: testSlots[1].id });

      // Host claims slot 3
      await host.rpc('rpc_claim_open_mic_slot', { slot_id: testSlots[2].id });

      // All slots now taken
      const finalCheck = await performer1.rpc('rpc_get_available_slots_for_event', {
        event_id: testEventId,
      });

      expect(finalCheck.data.length).toBe(0);

      // Verify final state
      const { data: finalSlots } = await adminClient
        .from('event_slots')
        .select('slot_index, performer_id')
        .eq('event_id', testEventId)
        .order('slot_index');

      expect(finalSlots?.[0].performer_id).toBe(testUserIds.performer);
      expect(finalSlots?.[1].performer_id).toBe(testUserIds.performer2);
      expect(finalSlots?.[2].performer_id).toBe(testUserIds.host);
    });
  });
});
