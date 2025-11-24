/**
 * Error handling utilities for Supabase RPC functions
 * Parses Postgres errors and provides user-friendly messages
 */

// ============================================
// ERROR CLASSES
// ============================================

export class SupabaseRPCError extends Error {
  code: string;
  details: string | null;
  hint: string | null;

  constructor(message: string, code: string = 'UNKNOWN_ERROR', details: string | null = null, hint: string | null = null) {
    super(message);
    this.name = 'SupabaseRPCError';
    this.code = code;
    this.details = details;
    this.hint = hint;
  }
}

// ============================================
// ERROR MESSAGE MAPPING
// ============================================

const ERROR_MESSAGES: Record<string, string> = {
  // RPC-specific errors from Phase 2
  'Slot not available or you already have a slot in this event':
    'This slot is no longer available, or you already have a slot in this event.',

  'Slot not found or does not belong to you':
    'You can only unclaim slots that belong to you.',

  'Time slot already booked':
    'This time slot is already booked. Please choose a different time.',

  'Service not found':
    'The requested service could not be found.',

  'Appointment time must be in the future':
    'Please select a time in the future for your appointment.',

  'Only admins or event host can set showcase lineup':
    'You must be an admin or the event host to manage the lineup.',

  'Event not found':
    'The requested event could not be found.',

  'This function only works for showcase events':
    'This operation is only allowed for showcase events.',

  'Duplicate performer IDs found in lineup input':
    'The same performer cannot be assigned to multiple slots.',

  'One or more performer IDs do not exist':
    'One or more selected performers do not exist in the system.',

  'does not exist for this event. Create slots first':
    'Not enough slots exist for this event. Please create more slots first.',

  // Generic Supabase/Postgres errors
  'JWT expired':
    'Your session has expired. Please sign in again.',

  'Invalid JWT':
    'Invalid session. Please sign in again.',

  'new row violates row-level security policy':
    'You do not have permission to perform this action.',

  'permission denied':
    'You do not have permission to perform this action.',

  'Network request failed':
    'Network error. Please check your connection and try again.',
};

// ============================================
// ERROR PARSER
// ============================================

/**
 * Parse Supabase/Postgres errors and return user-friendly messages
 */
export function parseSupabaseError(error: any): SupabaseRPCError {
  // Handle null/undefined
  if (!error) {
    return new SupabaseRPCError('An unknown error occurred', 'UNKNOWN_ERROR');
  }

  // If already our custom error, return as-is
  if (error instanceof SupabaseRPCError) {
    return error;
  }

  // Extract error details
  const message = error.message || error.msg || 'An unknown error occurred';
  const code = error.code || error.error_code || 'UNKNOWN_ERROR';
  const details = error.details || error.error_description || null;
  const hint = error.hint || null;

  // Try to find a user-friendly message
  let userMessage = message;
  for (const [pattern, friendlyMessage] of Object.entries(ERROR_MESSAGES)) {
    if (message.includes(pattern)) {
      userMessage = friendlyMessage;
      break;
    }
  }

  return new SupabaseRPCError(userMessage, code, details, hint);
}

/**
 * Check if error is a specific RPC error type
 */
export function isSlotNotAvailableError(error: any): boolean {
  const message = error?.message || '';
  return message.includes('Slot not available') || message.includes('already have a slot');
}

export function isDoubleBookingError(error: any): boolean {
  const message = error?.message || '';
  return message.includes('Time slot already booked');
}

export function isUnauthorizedError(error: any): boolean {
  const message = error?.message || '';
  return message.includes('permission denied') ||
         message.includes('Only admins') ||
         message.includes('not belong to you');
}

export function isValidationError(error: any): boolean {
  const message = error?.message || '';
  return message.includes('Duplicate performer') ||
         message.includes('do not exist') ||
         message.includes('must be in the future');
}

export function isNetworkError(error: any): boolean {
  const message = error?.message || '';
  return message.includes('Network request failed') ||
         message.includes('Failed to fetch');
}
