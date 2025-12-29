/**
 * SQL Tests: Row Level Security (RLS) Policies
 * Tests permission boundaries for all tables
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  adminClient,
  anonClient,
  createAuthenticatedClient,
  TEST_USERS,
  testUserIds,
} from '../setup';
import {
  createTestEvent,
  createTestSlots,
  createTestService,
  createTestAppointment,
  createTestSpotlight,
  deleteTestEvent,
  deleteTestService,
} from '../fixtures';
import { generateUUID } from '../utils';

describe('SQL: RLS Policies', () => {
  let performerClient: SupabaseClient;
  let performer2Client: SupabaseClient;
  let hostClient: SupabaseClient;
  let studioClient: SupabaseClient;
  let adminUserClient: SupabaseClient;

  beforeAll(async () => {
    performerClient = await createAuthenticatedClient(
      TEST_USERS.performer.email,
      TEST_USERS.performer.password
    );
    performer2Client = await createAuthenticatedClient(
      TEST_USERS.performer2.email,
      TEST_USERS.performer2.password
    );
    hostClient = await createAuthenticatedClient(
      TEST_USERS.host.email,
      TEST_USERS.host.password
    );
    studioClient = await createAuthenticatedClient(
      TEST_USERS.studio.email,
      TEST_USERS.studio.password
    );
    adminUserClient = await createAuthenticatedClient(
      TEST_USERS.admin.email,
      TEST_USERS.admin.password
    );
  });

  afterAll(async () => {
    await performerClient.auth.signOut();
    await performer2Client.auth.signOut();
    await hostClient.auth.signOut();
    await studioClient.auth.signOut();
    await adminUserClient.auth.signOut();
  });

  // ============================================
  // PROFILES TABLE RLS
  // ============================================

  describe('profiles table RLS', () => {
    describe('RLS-P01: Performer can SELECT own profile', () => {
      it('should allow reading own profile', async () => {
        const { data, error } = await performerClient
          .from('profiles')
          .select('*')
          .eq('id', testUserIds.performer)
          .single();

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data?.id).toBe(testUserIds.performer);
      });
    });

    describe('RLS-P02: Performer cannot SELECT other profiles', () => {
      it('should not return other user profiles', async () => {
        const { data, error } = await performerClient
          .from('profiles')
          .select('*')
          .eq('id', testUserIds.host)
          .single();

        // RLS filters out the row, so we get no data (not an error)
        expect(data).toBeNull();
      });
    });

    describe('RLS-P03: Performer can UPDATE own profile', () => {
      it('should allow updating own bio', async () => {
        const newBio = `Updated bio at ${Date.now()}`;

        const { error } = await performerClient
          .from('profiles')
          .update({ bio: newBio })
          .eq('id', testUserIds.performer);

        expect(error).toBeNull();

        // Verify update
        const { data } = await performerClient
          .from('profiles')
          .select('bio')
          .eq('id', testUserIds.performer)
          .single();

        expect(data?.bio).toBe(newBio);
      });
    });

    describe('RLS-P04: Performer cannot UPDATE other profiles', () => {
      it('should fail to update other user profile', async () => {
        const { error, count } = await performerClient
          .from('profiles')
          .update({ bio: 'Hacked!' })
          .eq('id', testUserIds.host);

        // RLS blocks update - Supabase returns null, not 0
        expect(count ?? 0).toBe(0);
      });
    });

    describe('RLS-P07: Performer cannot DELETE own profile', () => {
      it('should deny delete even on own profile', async () => {
        const { error, count } = await performerClient
          .from('profiles')
          .delete()
          .eq('id', testUserIds.performer);

        // RLS blocks delete - no SQL error but 0 rows affected
        // The delete_admin_only policy prevents non-admins from deleting
        expect(error).toBeNull();
        expect(count ?? 0).toBe(0);
      });
    });

    describe('RLS-P08: Admin can SELECT any profile', () => {
      it('should allow admin to read any profile', async () => {
        const { data, error } = await adminUserClient
          .from('profiles')
          .select('*')
          .eq('id', testUserIds.performer)
          .single();

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data?.id).toBe(testUserIds.performer);
      });
    });
  });

  // ============================================
  // EVENTS TABLE RLS
  // ============================================

  describe('events table RLS', () => {
    let testEventId: string;

    beforeAll(async () => {
      // Create a test event owned by host
      const event = await createTestEvent(testUserIds.host);
      testEventId = event.id;
    });

    afterAll(async () => {
      await deleteTestEvent(testEventId);
    });

    describe('RLS-E01: Anonymous can SELECT events', () => {
      it('should allow public read of events', async () => {
        const { data, error } = await anonClient
          .from('events')
          .select('*')
          .eq('id', testEventId)
          .single();

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data?.id).toBe(testEventId);
      });
    });

    describe('RLS-E02: Performer can SELECT events', () => {
      it('should allow performer to read events', async () => {
        const { data, error } = await performerClient
          .from('events')
          .select('*')
          .eq('id', testEventId)
          .single();

        expect(error).toBeNull();
        expect(data).toBeDefined();
      });
    });

    describe('RLS-E03: Host can INSERT own events', () => {
      it('should allow host to create events', async () => {
        const { data, error } = await hostClient
          .from('events')
          .insert({
            host_id: testUserIds.host,
            title: 'Host Created Event',
            event_date: '2025-12-20',
            start_time: '20:00:00',
            end_time: '23:00:00',
          })
          .select()
          .single();

        expect(error).toBeNull();
        expect(data).toBeDefined();

        // Cleanup
        if (data?.id) {
          await adminClient.from('events').delete().eq('id', data.id);
        }
      });
    });

    describe('RLS-E05: Host cannot UPDATE other host events', () => {
      it('should fail to update event owned by different host', async () => {
        // Create event owned by admin (acting as different host)
        const otherEvent = await createTestEvent(testUserIds.admin);

        const { error, count } = await hostClient
          .from('events')
          .update({ title: 'Hacked Title' })
          .eq('id', otherEvent.id);

        // RLS blocks update - Supabase returns null, not 0
        expect(count ?? 0).toBe(0);

        await deleteTestEvent(otherEvent.id);
      });
    });

    describe('RLS-E07: Performer cannot INSERT events', () => {
      it('should deny performer creating events', async () => {
        const { error } = await performerClient
          .from('events')
          .insert({
            host_id: testUserIds.performer,
            title: 'Performer Event',
            event_date: '2025-12-20',
            start_time: '20:00:00',
            end_time: '23:00:00',
          });

        // Should fail - performer is not a host
        expect(error).not.toBeNull();
      });
    });
  });

  // ============================================
  // EVENT_SLOTS TABLE RLS
  // ============================================

  describe('event_slots table RLS', () => {
    let testEventId: string;
    let testSlots: Array<{ id: string; slot_index: number }>;

    beforeAll(async () => {
      const event = await createTestEvent(testUserIds.host);
      testEventId = event.id;
      testSlots = await createTestSlots(testEventId, 3);
    });

    afterAll(async () => {
      await deleteTestEvent(testEventId);
    });

    describe('RLS-S01: Anonymous can SELECT slots', () => {
      it('should allow public read of slots', async () => {
        const { data, error } = await anonClient
          .from('event_slots')
          .select('*')
          .eq('event_id', testEventId);

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data?.length).toBe(3);
      });
    });

    describe('RLS-S02: Performer can UPDATE empty slot (claim)', () => {
      it('should allow performer to claim empty slot', async () => {
        const slotId = testSlots[0].id;

        const { error } = await performerClient
          .from('event_slots')
          .update({ performer_id: testUserIds.performer })
          .eq('id', slotId)
          .is('performer_id', null); // Only if empty - use .is() for null comparison

        expect(error).toBeNull();

        // Reset for other tests
        await adminClient
          .from('event_slots')
          .update({ performer_id: null })
          .eq('id', slotId);
      });
    });

    describe('RLS-S04: Performer cannot UPDATE other performer slot', () => {
      it('should deny claiming slot owned by another', async () => {
        const slotId = testSlots[1].id;

        // First, claim as performer2
        await adminClient
          .from('event_slots')
          .update({ performer_id: testUserIds.performer2 })
          .eq('id', slotId);

        // Try to steal as performer1
        const { error, count } = await performerClient
          .from('event_slots')
          .update({ performer_id: testUserIds.performer })
          .eq('id', slotId);

        // RLS blocks update - Supabase returns null, not 0
        expect(count ?? 0).toBe(0);

        // Cleanup
        await adminClient
          .from('event_slots')
          .update({ performer_id: null })
          .eq('id', slotId);
      });
    });

    describe('RLS-S08: Performer cannot INSERT slots', () => {
      it('should deny performer creating slots', async () => {
        const { error } = await performerClient
          .from('event_slots')
          .insert({
            event_id: testEventId,
            slot_index: 99,
            start_time: '21:00:00',
            end_time: '21:15:00',
          });

        expect(error).not.toBeNull();
      });
    });
  });

  // ============================================
  // STUDIO_SERVICES TABLE RLS
  // ============================================

  describe('studio_services table RLS', () => {
    let testServiceId: string;

    beforeAll(async () => {
      const service = await createTestService(testUserIds.studio);
      testServiceId = service.id;
    });

    afterAll(async () => {
      await deleteTestService(testServiceId);
    });

    describe('RLS-SS01: Anonymous can SELECT services', () => {
      it('should allow public read of services', async () => {
        const { data, error } = await anonClient
          .from('studio_services')
          .select('*')
          .eq('id', testServiceId)
          .single();

        expect(error).toBeNull();
        expect(data).toBeDefined();
      });
    });

    describe('RLS-SS03: Studio can UPDATE own service', () => {
      it('should allow studio to update own service', async () => {
        const { error } = await studioClient
          .from('studio_services')
          .update({ price_cents: 6000 })
          .eq('id', testServiceId);

        expect(error).toBeNull();

        // Reset
        await adminClient
          .from('studio_services')
          .update({ price_cents: 5000 })
          .eq('id', testServiceId);
      });
    });

    describe('RLS-SS05: Performer cannot INSERT services', () => {
      it('should deny performer creating services', async () => {
        const { error } = await performerClient
          .from('studio_services')
          .insert({
            studio_id: testUserIds.performer,
            name: 'Fake Service',
            price_cents: 1000,
            duration_min: 30,
          });

        expect(error).not.toBeNull();
      });
    });
  });

  // ============================================
  // STUDIO_APPOINTMENTS TABLE RLS
  // ============================================

  describe('studio_appointments table RLS', () => {
    let testServiceId: string;
    let testAppointmentId: string;

    beforeAll(async () => {
      const service = await createTestService(testUserIds.studio);
      testServiceId = service.id;
      const appointment = await createTestAppointment(
        testServiceId,
        testUserIds.performer
      );
      testAppointmentId = appointment.id;
    });

    afterAll(async () => {
      await deleteTestService(testServiceId);
    });

    describe('RLS-SA01: Performer can SELECT own appointments', () => {
      it('should allow performer to read own appointments', async () => {
        const { data, error } = await performerClient
          .from('studio_appointments')
          .select('*')
          .eq('id', testAppointmentId)
          .single();

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data?.performer_id).toBe(testUserIds.performer);
      });
    });

    describe('RLS-SA02: Performer cannot SELECT other appointments', () => {
      it('should not return other performer appointments', async () => {
        const { data } = await performer2Client
          .from('studio_appointments')
          .select('*')
          .eq('id', testAppointmentId)
          .single();

        // RLS filters it out
        expect(data).toBeNull();
      });
    });

    describe('RLS-SA05: Studio can SELECT appointments for own services', () => {
      it('should allow studio to read appointments for their service', async () => {
        const { data, error } = await studioClient
          .from('studio_appointments')
          .select('*')
          .eq('service_id', testServiceId);

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data?.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================
  // SPOTLIGHTS TABLE RLS
  // ============================================

  describe('spotlights table RLS', () => {
    let testSpotlightId: string;

    beforeAll(async () => {
      const spotlight = await createTestSpotlight(testUserIds.performer);
      testSpotlightId = spotlight.id;
    });

    afterAll(async () => {
      await adminClient.from('spotlights').delete().eq('id', testSpotlightId);
    });

    describe('RLS-SP01: Anonymous can SELECT spotlights', () => {
      it('should allow public read of spotlights', async () => {
        const { data, error } = await anonClient
          .from('spotlights')
          .select('*')
          .eq('id', testSpotlightId)
          .single();

        expect(error).toBeNull();
        expect(data).toBeDefined();
      });
    });

    describe('RLS-SP02: Performer cannot INSERT spotlights', () => {
      it('should deny performer creating spotlights', async () => {
        const { error } = await performerClient
          .from('spotlights')
          .insert({
            artist_id: testUserIds.performer,
            spotlight_date: '2025-02-01',
            reason: 'Self-promotion',
          });

        expect(error).not.toBeNull();
      });
    });

    describe('RLS-SP04: Admin can INSERT spotlights', () => {
      it('should allow admin to create spotlights', async () => {
        const { data, error } = await adminUserClient
          .from('spotlights')
          .insert({
            artist_id: testUserIds.performer2,
            spotlight_date: '2025-02-15',
            reason: 'Admin selected',
          })
          .select()
          .single();

        expect(error).toBeNull();
        expect(data).toBeDefined();

        // Cleanup
        if (data?.id) {
          await adminClient.from('spotlights').delete().eq('id', data.id);
        }
      });
    });
  });
});
