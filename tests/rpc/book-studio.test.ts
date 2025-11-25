/**
 * RPC Tests: rpc_book_studio_service
 * Tests studio appointment booking functionality
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
  createTestService,
  deleteTestService,
} from '../fixtures';
import { getFutureTime, getPastTime, getNonExistentUUID } from '../utils';

describe('RPC: rpc_book_studio_service', () => {
  let performerClient: SupabaseClient;
  let performer2Client: SupabaseClient;

  let testServiceId: string;
  let testServiceDuration: number;

  beforeAll(async () => {
    performerClient = await createAuthenticatedClient(
      TEST_USERS.performer.email,
      TEST_USERS.performer.password
    );
    performer2Client = await createAuthenticatedClient(
      TEST_USERS.performer2.email,
      TEST_USERS.performer2.password
    );

    // Create test service (60 min duration)
    const service = await createTestService(testUserIds.studio, {
      duration_min: 60,
    });
    testServiceId = service.id;
    testServiceDuration = service.duration_min;
  });

  afterAll(async () => {
    await performerClient.auth.signOut();
    await performer2Client.auth.signOut();
    await deleteTestService(testServiceId);
  });

  beforeEach(async () => {
    // Clear all appointments for this service before each test
    await adminClient
      .from('studio_appointments')
      .delete()
      .eq('service_id', testServiceId);
  });

  describe('RPC-011: Valid booking', () => {
    it('should successfully book a future time slot', async () => {
      const futureTime = getFutureTime(7, 14); // 1 week from now at 2 PM

      const { data, error } = await performerClient.rpc('rpc_book_studio_service', {
        service_id: testServiceId,
        desired_time: futureTime,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      const result = Array.isArray(data) ? data[0] : data;
      expect(result.service_id).toBe(testServiceId);
      expect(result.performer_id).toBe(testUserIds.performer);
      expect(result.status).toBe('pending');
    });
  });

  describe('RPC-012: Double booking - exact time conflict', () => {
    it('should fail when exact time slot is already booked', async () => {
      const futureTime = getFutureTime(8, 10); // Specific time

      // First booking
      await performerClient.rpc('rpc_book_studio_service', {
        service_id: testServiceId,
        desired_time: futureTime,
      });

      // Second booking at same time
      const { data, error } = await performer2Client.rpc('rpc_book_studio_service', {
        service_id: testServiceId,
        desired_time: futureTime,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Time slot already booked');
    });
  });

  describe('Overlapping appointments', () => {
    it('should fail when new appointment overlaps with existing', async () => {
      // Book 2 PM
      const time1 = getFutureTime(9, 14);
      await performerClient.rpc('rpc_book_studio_service', {
        service_id: testServiceId,
        desired_time: time1,
      });

      // Try to book 2:30 PM (overlaps with 2-3 PM booking)
      const time2 = getFutureTime(9, 14); // Same day
      const overlappingDate = new Date(time2);
      overlappingDate.setMinutes(30);

      const { data, error } = await performer2Client.rpc('rpc_book_studio_service', {
        service_id: testServiceId,
        desired_time: overlappingDate.toISOString(),
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Time slot already booked');
    });
  });

  describe('Adjacent appointments - no overlap', () => {
    it('should allow booking immediately after existing appointment', async () => {
      // Book 2 PM (60 min, ends at 3 PM)
      const time1 = getFutureTime(10, 14);
      await performerClient.rpc('rpc_book_studio_service', {
        service_id: testServiceId,
        desired_time: time1,
      });

      // Book 3 PM (starts when first ends)
      const time2 = getFutureTime(10, 15); // 3 PM

      const { data, error } = await performer2Client.rpc('rpc_book_studio_service', {
        service_id: testServiceId,
        desired_time: time2,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('RPC-013: Past time', () => {
    it('should fail when booking time is in the past', async () => {
      const pastTime = getPastTime(1, 14);

      const { data, error } = await performerClient.rpc('rpc_book_studio_service', {
        service_id: testServiceId,
        desired_time: pastTime,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('must be in the future');
    });
  });

  describe('RPC-014: Invalid service_id', () => {
    it('should fail with non-existent service', async () => {
      const fakeServiceId = getNonExistentUUID();
      const futureTime = getFutureTime(7, 14);

      const { data, error } = await performerClient.rpc('rpc_book_studio_service', {
        service_id: fakeServiceId,
        desired_time: futureTime,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Service not found');
    });
  });

  describe('Returns complete appointment data', () => {
    it('should return all appointment fields', async () => {
      const futureTime = getFutureTime(11, 14);

      const { data, error } = await performerClient.rpc('rpc_book_studio_service', {
        service_id: testServiceId,
        desired_time: futureTime,
      });

      expect(error).toBeNull();

      const result = Array.isArray(data) ? data[0] : data;
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('service_id', testServiceId);
      expect(result).toHaveProperty('performer_id', testUserIds.performer);
      expect(result).toHaveProperty('appointment_time');
      expect(result).toHaveProperty('status', 'pending');
      expect(result).toHaveProperty('note');
      expect(result).toHaveProperty('created_at');
      expect(result).toHaveProperty('updated_at');
    });
  });

  describe('Cancelled appointments do not block', () => {
    it('should allow booking time slot of cancelled appointment', async () => {
      const futureTime = getFutureTime(12, 14);

      // Create and cancel first booking
      const { data: booking1 } = await performerClient.rpc('rpc_book_studio_service', {
        service_id: testServiceId,
        desired_time: futureTime,
      });

      const result1 = Array.isArray(booking1) ? booking1[0] : booking1;
      await adminClient
        .from('studio_appointments')
        .update({ status: 'cancelled' })
        .eq('id', result1.id);

      // Book same time with different user
      const { data, error } = await performer2Client.rpc('rpc_book_studio_service', {
        service_id: testServiceId,
        desired_time: futureTime,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });
});
