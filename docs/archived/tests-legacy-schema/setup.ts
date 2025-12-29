/**
 * Global test setup for Open Mic Drop
 * Configures Supabase clients and test utilities
 */

// Load test environment variables BEFORE validation
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

import { assertTestEnvironment } from './utils/validateTestEnvironment';
assertTestEnvironment();

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================
// ENVIRONMENT VARIABLES
// ============================================

const SUPABASE_TEST_URL = process.env.SUPABASE_TEST_URL || 'http://localhost:54321';
const SUPABASE_TEST_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY || 'test-anon-key';
const SUPABASE_TEST_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY || 'test-service-role-key';

// ============================================
// SUPABASE TEST CLIENTS
// ============================================

/**
 * Admin client with service role key - bypasses RLS
 */
export const adminClient: SupabaseClient = createClient(
  SUPABASE_TEST_URL,
  SUPABASE_TEST_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Anonymous client - respects RLS
 */
export const anonClient: SupabaseClient = createClient(
  SUPABASE_TEST_URL,
  SUPABASE_TEST_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Create an authenticated client for a specific user
 */
export async function createAuthenticatedClient(
  email: string,
  password: string
): Promise<SupabaseClient> {
  // Disable session persistence to avoid cross-fork JWT contamination
  const client = createClient(SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: { 'X-Client-Testing': 'true' }
    }
  });

  // Step 1: Sign in
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;

  // Step 2: Force session synchronization
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError || !sessionData?.session?.access_token) {
    throw new Error("Failed to initialize session for " + email);
  }

  return client;
}

// ============================================
// TEST USER CREDENTIALS
// ============================================

export const TEST_USERS = {
  performer: {
    email: 'test-performer@openmictest.com',
    password: 'TestPass123!',
    role: 'performer' as const,
  },
  performer2: {
    email: 'test-performer2@openmictest.com',
    password: 'TestPass123!',
    role: 'performer' as const,
  },
  host: {
    email: 'test-host@openmictest.com',
    password: 'TestPass123!',
    role: 'host' as const,
  },
  studio: {
    email: 'test-studio@openmictest.com',
    password: 'TestPass123!',
    role: 'studio' as const,
  },
  admin: {
    email: 'test-admin@openmictest.com',
    password: 'TestPass123!',
    role: 'admin' as const,
  },
};

// ============================================
// DATABASE UTILITIES
// ============================================

/**
 * Clear all test data from database
 */
export async function clearTestData(): Promise<void> {
  // Delete in reverse dependency order
  await adminClient.from('spotlights').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await adminClient.from('studio_appointments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await adminClient.from('studio_services').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await adminClient.from('event_slots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await adminClient.from('events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  // Don't delete profiles - they're tied to auth users
}

/**
 * Create test users via Auth API and insert profiles
 */
export async function setupTestUsers(): Promise<Record<string, string>> {
  const userIds: Record<string, string> = {};

  for (const [key, user] of Object.entries(TEST_USERS)) {
    // Try to create user (may already exist)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
    });

    let userId: string;

    if (authError) {
      // User might already exist, try to get them
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u) => u.email === user.email);
      if (existingUser) {
        userId = existingUser.id;
      } else {
        throw new Error(`Failed to create/find user ${user.email}: ${authError.message}`);
      }
    } else {
      userId = authData.user.id;
    }

    userIds[key] = userId;

    // Upsert profile
    await adminClient.from('profiles').upsert({
      id: userId,
      full_name: `Test ${key.charAt(0).toUpperCase() + key.slice(1)}`,
      role: user.role,
      bio: `Test ${user.role} account`,
    });
  }

  return userIds;
}

// ============================================
// GLOBAL HOOKS
// ============================================

let testUserIds: Record<string, string> = {};

/**
 * Ensure test users are set up (idempotent)
 * Call this in test-specific beforeAll hooks to guarantee users exist
 */
export async function ensureTestSetup(): Promise<void> {
  if (Object.keys(testUserIds).length === 0) {
    testUserIds = await setupTestUsers();
  }
}

beforeAll(async () => {
  // Setup test users once before all tests
  await ensureTestSetup();
});

afterAll(async () => {
  // Cleanup after all tests
  await clearTestData();
});

beforeEach(() => {
  // Reset any mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Additional cleanup if needed
});

// ============================================
// EXPORTS
// ============================================

export { testUserIds };

// Re-export vitest utilities
export { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
