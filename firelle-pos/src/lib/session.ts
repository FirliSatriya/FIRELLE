"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getCurrentProfile, type AppRole, type CurrentProfile } from "@/lib/supabase/products";

export interface SessionState {
  loading: boolean;
  userId: string | null;
  profile: CurrentProfile | null;
  role: AppRole | null;
}

/**
 * Resolves the Supabase session + the caller's profile row and redirects to
 * `/login` when there is no session or the account is deactivated.
 *
 * `ready` is true once the session has been resolved, so pages can hold off
 * their data queries until the profile (and therefore the RLS context) is
 * known. The hook is safe to call from several components at once: each call
 * only ever reflects *its own* resolution, and a sign-out redirects rather
 * than poisoning shared state.
 */
export function useSession() {
  const router = useRouter();

  const [state, setState] = useState<SessionState>({
    loading: true,
    userId: null,
    profile: null,
    role: null,
  });

  const reload = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setState({ loading: false, userId: null, profile: null, role: null });
      return null;
    }

    const profile = await getCurrentProfile(session.user.id);

    if (!profile || !profile.isActive) {
      await supabase.auth.signOut();
      setState({ loading: false, userId: null, profile: null, role: null });
      return null;
    }

    setState({
      loading: false,
      userId: session.user.id,
      profile,
      role: profile.role,
    });
    return profile;
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // SIGNED_OUT (or an invalidated token) is the only event that must end
      // the session. TOKEN_REFRESHED / USER_UPDATED must not, or a still-valid
      // cashier session would be mistaken for an expiry.
      if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
    });

    void (async () => {
      try {
        await reload();
      } catch {
        if (active) router.replace("/login");
      }
    })();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [reload, router]);

  return { ...state, ready: !state.loading, reload };
}

/** Read the singleton store settings used on receipts. */
export interface StoreSettings {
  store_name: string;
  store_address: string | null;
  store_phone: string | null;
  receipt_footer: string | null;
  receipt_paper: string;
  allow_negative_stock: boolean;
  low_stock_default: number;
}

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    supabase
      .from("settings")
      .select("*")
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setSettings(data as StoreSettings);
      });

    return () => {
      active = false;
    };
  }, []);

  return settings;
}