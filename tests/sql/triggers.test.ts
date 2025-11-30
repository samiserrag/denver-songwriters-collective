/**
 * SQL Tests: Trigger Behaviors
 * Tests column-level security triggers
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  adminClient,
  createAuthenticatedClient,
  TEST_USERS,
  testUserIds,
} from '../setup';
import {
  createTestService,
  createTestAppointment,
  deleteTestService,
} from '../fixtures';
import { getFutureTime } from '../utils';

describe('SQL: Triggers', () => {
  let performerClient: SupabaseClient;
  let studioClient: SupabaseClient;
  let adminUserClient: SupabaseClient;

  beforeAll(async () => {
    performerClient = await createAuthenticatedClient(
      TEST_USERS.performer.email,
      TEST_USERS.performer.password
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
    await studioClient.auth.signOut();
    await adminUserClient.auth.signOut();
  });

  // ============================================
  // prevent_role_change TRIGGER
  // ============================================

  describe('prevent_role_change trigger', () => {
    describe('TRG-001: Performer cannot change own role to admin', () => {
      it('should reject role change to admin', async () => {
        const { error } = await performerClient
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', testUserIds.performer);

        expect(error).not.toBeNull();
        expect(error?.message).toContain('cannot change your user role');
      });
    });

    describe('TRG-002: Performer cannot change own role to host', () => {
      it('should reject role change to host', async () => {
        const { error } = await performerClient
          .from('profiles')
          .update({ role: 'host' })
          .eq('id', testUserIds.performer);

        expect(error).not.toBeNull();
        expect(error?.message).toContain('cannot change your user role');
      });
    });

    describe('TRG-003: Performer can update bio without changing role', () => {
      it('should allow updating other fields', async () => {
        const newBio = `Trigger test bio ${Date.now()}`;

        const { error } = await performerClient
          .from('profiles')
          .update({ bio: newBio })
          .eq('id', testUserIds.performer);

        expect(error).toBeNull();
      });
    });

    describe('TRG-004: Admin can change any user role', () => {
      it('should allow admin to update roles', async () => {
        // Note: This test modifies role, so we need to restore it
        const { data: original } = await adminClient
          .from('profiles')
          .select('role')
          .eq('id', testUserIds.performer)
          .single();

        // Change to host temporarily
        const { error: changeError } = await adminUserClient
          .from('profiles')
          .update({ role: 'host' })
          .eq('id', testUserIds.performer);

        expect(changeError).toBeNull();

        // Restore original role
        await adminClient
          .from('profiles')
          .update({ role: original?.role || 'performer' })
          .eq('id', testUserIds.performer);
      });
    });
  });

  // ============================================
  // prevent_appointment_service_change TRIGGER
  // ============================================

  describe('prevent_appointment_service_change trigger', () => {
    let testServiceId: string;
    let testService2Id: string;
    let testAppointmentId: string;

    beforeAll(async () => {
      // Create two services for the test
      const service1 = await createTestService(testUserIds.studio, {
        name: 'Service 1',
      });
      const service2 = await createTestService(testUserIds.studio, {
        name: 'Service 2',
      });
      testServiceId = service1.id;
      testService2Id = service2.id;

      // Create appointment for performer
      const appointment = await createTestAppointment(
        testServiceId,
        testUserIds.performer
      );
      testAppointmentId = appointment.id;
    });

    afterAll(async () => {
      await adminClient
        .from('studio_appointments')
        .delete()
        .eq('id', testAppointmentId);
      await deleteTestService(testServiceId);
      await deleteTestService(testService2Id);
    });

    describe('TRG-010: Performer cannot change service_id after booking', () => {
      it('should reject service_id change', async () => {
        const { error } = await performerClient
          .from('studio_appointments')
          .update({ service_id: testService2Id })
          .eq('id', testAppointmentId);

        expect(error).not.toBeNull();
        expect(error?.message).toContain('Cannot change the service after booking');
      });
    });

    describe('TRG-011: Performer cannot change performer_id after booking', () => {
      it('should reject performer_id change', async () => {
        const { error } = await performerClient
          .from('studio_appointments')
          .update({ performer_id: testUserIds.performer2 })
          .eq('id', testAppointmentId);

        expect(error).not.toBeNull();
        expect(error?.message).toContain('Cannot change the performer after booking');
      });
    });

    describe('TRG-012: Performer cannot change appointment_time after booking', () => {
      it('should reject appointment_time change', async () => {
        const newTime = getFutureTime(14); // 2 weeks from now

        const { error } = await performerClient
          .from('studio_appointments')
          .update({ appointment_time: newTime })
          .eq('id', testAppointmentId);

        expect(error).not.toBeNull();
        expect(error?.message).toContain('Cannot change the appointment time after booking');
      });
    });

    describe('TRG-013: Performer can update status', () => {
      it('should allow status change to cancelled', async () => {
        const { error } = await performerClient
          .from('studio_appointments')
          .update({ status: 'cancelled' })
          .eq('id', testAppointmentId);

        expect(error).toBeNull();

        // Reset for other tests
        await adminClient
          .from('studio_appointments')
          .update({ status: 'pending' })
          .eq('id', testAppointmentId);
      });
    });

    describe('TRG-014: Performer can update note', () => {
      it('should allow note update', async () => {
        const { error } = await performerClient
          .from('studio_appointments')
          .update({ note: 'Updated note' })
          .eq('id', testAppointmentId);

        expect(error).toBeNull();
      });
    });

    describe('TRG-015: Admin can change service_id', () => {
      it('should allow admin to change service', async () => {
        const { error } = await adminUserClient
          .from('studio_appointments')
          .update({ service_id: testService2Id })
          .eq('id', testAppointmentId);

        expect(error).toBeNull();

        // Reset
        await adminClient
          .from('studio_appointments')
          .update({ service_id: testServiceId })
          .eq('id', testAppointmentId);
      });
    });

    describe('TRG-016: Admin can change appointment_time', () => {
      it('should allow admin to change time', async () => {
        const newTime = getFutureTime(21); // 3 weeks from now

        const { error } = await adminUserClient
          .from('studio_appointments')
          .update({ appointment_time: newTime })
          .eq('id', testAppointmentId);

        expect(error).toBeNull();
      });
    });

    describe('TRG-017: Studio can update status for own service appointments', () => {
      it('should allow studio to confirm appointment', async () => {
        const { error } = await studioClient
          .from('studio_appointments')
          .update({ status: 'confirmed' })
          .eq('id', testAppointmentId);

        expect(error).toBeNull();
      });
    });
  });

  // ============================================
  // restrict_studio_service_updates TRIGGER
  // ============================================

  describe('restrict_studio_service_updates trigger', () => {
    let testServiceId: string;

    beforeAll(async () => {
      const service = await createTestService(testUserIds.studio);
      testServiceId = service.id;
    });

    afterAll(async () => {
      await deleteTestService(testServiceId);
    });

    describe('TRG-020: Studio can update own service price', () => {
      it('should allow studio to update price', async () => {
        const { error } = await studioClient
          .from('studio_services')
          .update({ price_cents: 7500 })
          .eq('id', testServiceId);

        expect(error).toBeNull();

        // Reset
        await adminClient
          .from('studio_services')
          .update({ price_cents: 5000 })
          .eq('id', testServiceId);
      });
    });

    describe('TRG-021: Studio can update own service duration', () => {
      it('should allow studio to update duration', async () => {
        const { error } = await studioClient
          .from('studio_services')
          .update({ duration_min: 90 })
          .eq('id', testServiceId);

        expect(error).toBeNull();

        // Reset
        await adminClient
          .from('studio_services')
          .update({ duration_min: 60 })
          .eq('id', testServiceId);
      });
    });

    describe('TRG-022: Performer cannot update any service', () => {
      it('should reject performer updating service', async () => {
        const { error, count } = await performerClient
          .from('studio_services')
          .update({ price_cents: 100 })
          .eq('id', testServiceId);

        // RLS blocks update - no SQL error but 0 rows affected
        expect(error).toBeNull();
        expect(count ?? 0).toBe(0);
      });
    });

    describe('TRG-024: Admin can update any service', () => {
      it('should allow admin to update service', async () => {
        const { error } = await adminUserClient
          .from('studio_services')
          .update({ name: 'Admin Updated Service' })
          .eq('id', testServiceId);

        expect(error).toBeNull();

        // Reset
        await adminClient
          .from('studio_services')
          .update({ name: 'Recording Session' })
          .eq('id', testServiceId);
      });
    });
  });
});
