"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { User } from "@supabase/supabase-js";
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
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
