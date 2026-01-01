"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface UseAuthResult {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  resendConfirmationEmail: (email: string) => Promise<{ error?: string; success?: boolean }>;
}

export function useAuth(): UseAuthResult {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function getInitialUser() {
      try {
        // First, try to get from session (faster, uses cookies)
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (session?.user) {
          setUser(session.user);
          setLoading(false);
          return;
        }

        // Fallback to getUser (more authoritative but slower)
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!isMounted) return;
        setUser(user ?? null);
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    }

    getInitialUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
      // Also ensure loading is false when auth state changes
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const resendConfirmationEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (error) {
      return { error: error.message };
    }

    return { success: true };
  }, [supabase]);

  return { user, loading, signOut, resendConfirmationEmail };
}
