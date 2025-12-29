/**
 * Test utilities for Open Mic Drop
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================
// TIME UTILITIES
// ============================================

/**
 * Get a future ISO timestamp
 */
export function getFutureTime(daysAhead: number = 7, hour: number = 14): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

/**
 * Get a past ISO timestamp
 */
export function getPastTime(daysAgo: number = 1, hour: number = 14): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

/**
 * Get current time + offset in minutes
 */
export function getTimeWithOffset(minutesOffset: number): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutesOffset);
  return date.toISOString();
}

// ============================================
// UUID UTILITIES
// ============================================

/**
 * Generate a valid UUID v4 for testing
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate an invalid UUID for negative testing
 */
export function getInvalidUUID(): string {
  return 'not-a-valid-uuid';
}

/**
 * Generate a valid but non-existent UUID
 */
export function getNonExistentUUID(): string {
  return '00000000-0000-4000-8000-000000000000';
}

// ============================================
// ASYNC UTILITIES
// ============================================

/**
 * Wait for a specified number of milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async function until it succeeds or max retries reached
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 100
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await wait(delayMs);
      }
    }
  }

  throw lastError;
}

// ============================================
// CONCURRENCY UTILITIES
// ============================================

/**
 * Execute multiple async functions concurrently and collect results
 */
export async function runConcurrently<T>(
  fns: Array<() => Promise<T>>
): Promise<Array<PromiseSettledResult<T>>> {
  return Promise.allSettled(fns.map((fn) => fn()));
}

/**
 * Count successes and failures from Promise.allSettled results
 */
export function countResults<T>(
  results: Array<PromiseSettledResult<T>>
): { successes: number; failures: number } {
  return {
    successes: results.filter((r) => r.status === 'fulfilled').length,
    failures: results.filter((r) => r.status === 'rejected').length,
  };
}

/**
 * Extract error messages from rejected promises
 */
export function getErrorMessages<T>(
  results: Array<PromiseSettledResult<T>>
): string[] {
  return results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => r.reason?.message || 'Unknown error');
}

// ============================================
// RPC CALL UTILITIES
// ============================================

/**
 * Call an RPC function and expect it to succeed
 */
export async function expectRpcSuccess<T>(
  client: SupabaseClient,
  functionName: string,
  params: Record<string, unknown>
): Promise<T> {
  const { data, error } = await client.rpc(functionName, params);

  if (error) {
    throw new Error(`RPC ${functionName} failed: ${error.message}`);
  }

  return data as T;
}

/**
 * Call an RPC function and expect it to fail with specific message
 */
export async function expectRpcError(
  client: SupabaseClient,
  functionName: string,
  params: Record<string, unknown>,
  expectedMessageContains?: string
): Promise<{ message: string; code: string }> {
  const { data, error } = await client.rpc(functionName, params);

  if (!error) {
    throw new Error(`Expected RPC ${functionName} to fail, but it succeeded with: ${JSON.stringify(data)}`);
  }

  if (expectedMessageContains && !error.message.includes(expectedMessageContains)) {
    throw new Error(
      `Expected error message to contain "${expectedMessageContains}", but got: "${error.message}"`
    );
  }

  return { message: error.message, code: error.code || 'UNKNOWN' };
}

// ============================================
// ASSERTION HELPERS
// ============================================

/**
 * Assert that an array has exactly N elements
 */
export function assertArrayLength<T>(arr: T[], expected: number, message?: string): void {
  if (arr.length !== expected) {
    throw new Error(
      message || `Expected array length ${expected}, but got ${arr.length}`
    );
  }
}

/**
 * Assert that a value is not null or undefined
 */
export function assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to be defined');
  }
}

/**
 * Assert that a string contains a substring
 */
export function assertContains(str: string, substring: string, message?: string): void {
  if (!str.includes(substring)) {
    throw new Error(
      message || `Expected "${str}" to contain "${substring}"`
    );
  }
}
