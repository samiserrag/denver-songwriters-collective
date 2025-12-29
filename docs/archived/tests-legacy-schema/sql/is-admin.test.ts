/**
 * SQL Tests: is_admin() helper function
 * Tests the SECURITY DEFINER helper that checks admin status
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  adminClient,
  createAuthenticatedClient,
  TEST_USERS,
  testUserIds,
} from '../setup';
import { SupabaseClient } from '@supabase/supabase-js';

describe('SQL: is_admin() function', () => {
  let performerClient: SupabaseClient;
  let hostClient: SupabaseClient;
  let studioClient: SupabaseClient;
  let adminUserClient: SupabaseClient;

  beforeAll(async () => {
    // Create authenticated clients for each role
    performerClient = await createAuthenticatedClient(
      TEST_USERS.performer.email,
      TEST_USERS.performer.password
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
    // Sign out all clients
    await performerClient.auth.signOut();
    await hostClient.auth.signOut();
    await studioClient.auth.signOut();
    await adminUserClient.auth.signOut();
  });

  describe('SQL-001: Returns TRUE for admin user', () => {
    it('should return true when called by admin', async () => {
      const { data, error } = await adminUserClient.rpc('is_admin');

      expect(error).toBeNull();
      expect(data).toBe(true);
    });
  });

  describe('SQL-002: Returns FALSE for performer', () => {
    it('should return false when called by performer', async () => {
      const { data, error } = await performerClient.rpc('is_admin');

      expect(error).toBeNull();
      expect(data).toBe(false);
    });
  });

  describe('SQL-003: Returns FALSE for host', () => {
    it('should return false when called by host', async () => {
      const { data, error } = await hostClient.rpc('is_admin');

      expect(error).toBeNull();
      expect(data).toBe(false);
    });
  });

  describe('SQL-004: Returns FALSE for studio', () => {
    it('should return false when called by studio', async () => {
      const { data, error } = await studioClient.rpc('is_admin');

      expect(error).toBeNull();
      expect(data).toBe(false);
    });
  });

  describe('SQL-005: Returns FALSE for unauthenticated', () => {
    it('should return false when called without auth context', async () => {
      // Use anon client (no user session)
      const { createClient } = await import('@supabase/supabase-js');
      const anonClient = createClient(
        process.env.SUPABASE_TEST_URL || 'http://localhost:54321',
        process.env.SUPABASE_TEST_ANON_KEY || 'test-anon-key'
      );

      const { data, error } = await anonClient.rpc('is_admin');

      // Should return false (auth.uid() is null)
      expect(error).toBeNull();
      expect(data).toBe(false);
    });
  });
});
