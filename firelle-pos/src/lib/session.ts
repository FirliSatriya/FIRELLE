"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAuthProfile,
  getAuthSession,
  signOut,
  subscribeAuth,
  type AppRole,
  type CurrentProfile,
} from "@/lib/auth";
import { getStoreSettings } from "@/lib/data/settings";
import { LOGIN_PATH, landingFor } from "@/lib/navigation";

export { LOGIN_PATH, landingFor };

export interface SessionState {
  loading: boolean;
  userId: string | null;
  profile: CurrentProfile | null;
  role: AppRole | null;
}

/**
 * Resolves the active session + the caller's profile and redirects to `/login`
 * when there is no session or the account is deactivated.
 *
 * `ready` is true once the session has been resolved, so pages can hold off
 * their data queries until the profile (and therefore the RLS context) is
 * known. Production reads Supabase; demo reads the in-memory demo users.
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
    const session = await getAuthSession();

    if (!session) {
      setState({ loading: false, userId: null, profile: null, role: null });
      router.replace(LOGIN_PATH);
      return null;
    }

    const profile = await getAuthProfile(session.id);

    if (!profile || !profile.isActive) {
      await signOut();
      setState({ loading: false, userId: null, profile: null, role: null });
      router.replace(LOGIN_PATH);
      return null;
    }

    setState({
      loading: false,
      userId: session.id,
      profile,
      role: profile.role,
    });
    return profile;
  }, [router]);

  useEffect(() => {
    let active = true;

    // SIGNED_OUT is the only event that must end the session. Token refreshes
    // are intentionally ignored so a still-valid cashier session survives.
    const unsubscribe = subscribeAuth((event) => {
      if (event === "SIGNED_OUT") {
        router.replace(LOGIN_PATH);
      }
    });

    void (async () => {
      try {
        await reload();
      } catch {
        if (active) router.replace(LOGIN_PATH);
      }
    })();

    return () => {
      active = false;
      unsubscribe();
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

    getStoreSettings()
      .then((row) => {
        if (active && row) setSettings(row);
      })
      .catch(() => {
        /* receipts fall back to their defaults */
      });

    return () => {
      active = false;
    };
  }, []);

  return settings;
}
