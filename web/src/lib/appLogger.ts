/**
 * Application Logger
 *
 * Logs errors and debug info to the app_logs table for admin debugging.
 * Works on both client and server side.
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface LogOptions {
  source?: string;
  userId?: string;
  userEmail?: string;
  url?: string;
  userAgent?: string;
}

/**
 * Log an event to the app_logs table
 */
export async function logToDatabase(
  level: LogLevel,
  message: string,
  context: LogContext = {},
  options: LogOptions = {}
): Promise<void> {
  try {
    const supabase = createSupabaseBrowserClient();

    // Get current user if not provided
    let userId = options.userId;
    let userEmail = options.userEmail;

    if (!userId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        userEmail = user.email;
      }
    }

    // Get browser info if on client
    const url = options.url || (typeof window !== "undefined" ? window.location.href : undefined);
    const userAgent =
      options.userAgent || (typeof window !== "undefined" ? navigator.userAgent : undefined);

    await supabase.from("app_logs").insert({
      level,
      message,
      context,
      user_id: userId || null,
      user_email: userEmail || null,
      source: options.source || null,
      url: url || null,
      user_agent: userAgent || null,
    });
  } catch (err) {
    // Don't throw - just console.error so logging failures don't break the app
    console.error("[AppLogger] Failed to log to database:", err);
  }
}

/**
 * Convenience methods
 */
export const appLogger = {
  debug: (message: string, context?: LogContext, options?: LogOptions) =>
    logToDatabase("debug", message, context, options),

  info: (message: string, context?: LogContext, options?: LogOptions) =>
    logToDatabase("info", message, context, options),

  warn: (message: string, context?: LogContext, options?: LogOptions) =>
    logToDatabase("warn", message, context, options),

  error: (message: string, context?: LogContext, options?: LogOptions) =>
    logToDatabase("error", message, context, options),

  /**
   * Log an Error object with stack trace
   */
  logError: (error: Error, source?: string, additionalContext?: LogContext) =>
    logToDatabase(
      "error",
      error.message,
      {
        name: error.name,
        stack: error.stack,
        ...additionalContext,
      },
      { source }
    ),
};

export default appLogger;
