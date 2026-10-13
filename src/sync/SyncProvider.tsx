/**
 * Runs sync when Supabase is configured and the learner is signed in (PLAN.md 5.6): on app
 * open, at session end, when the tab is hidden, every 5 minutes, and when the connection
 * returns. Without configuration it does nothing and the app stays local-only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { db } from "@/db/db";
import { supabaseUrl } from "./config";
import { syncOnce } from "./sync";

const URL = supabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const SYNC_CONFIGURED = Boolean(URL && KEY);
export const SYNC_INTERVAL_MS = 5 * 60_000;
const SYNC_EVENT = "geodex:sync";
const LAST_SYNC_KEY = "geodex.lastSyncedAt";

/** Asks for a sync from anywhere, such as the end of a session. No-op when sync is off. */
export function requestSync(): void {
  window.dispatchEvent(new Event(SYNC_EVENT));
}

export type SyncStatus = "off" | "signed-out" | "idle" | "syncing" | "offline" | "error";

type SyncContextValue = {
  status: SyncStatus;
  email: string | null;
  lastSyncedAt: number | null;
  error: string | null;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
};

const noop = async () => {};
const SyncContext = createContext<SyncContextValue>({
  status: "off",
  email: null,
  lastSyncedAt: null,
  error: null,
  sendCode: noop,
  verifyCode: noop,
  signOut: noop,
  syncNow: noop,
});

export function useSync(): SyncContextValue {
  return useContext(SyncContext);
}

function readLastSync(): number | null {
  try {
    const value = Number(localStorage.getItem(LAST_SYNC_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>(SYNC_CONFIGURED ? "signed-out" : "off");
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(readLastSync);
  const running = useRef(false);
  const api = useRef<typeof import("./supabase") | null>(null);

  // Load the client only when configured, so local-only builds never download it.
  useEffect(() => {
    if (!SYNC_CONFIGURED || !URL || !KEY) return;
    let active = true;
    let unsubscribe = () => {};
    void import("./supabase").then(async (mod) => {
      if (!active) return;
      api.current = mod;
      const supabase = mod.createSupabase(URL, KEY);
      setClient(supabase);
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setEmail(data.session?.user.email ?? null);
      setStatus(data.session ? "idle" : "signed-out");
      const sub = supabase.auth.onAuthStateChange((_event, session) => {
        setEmail(session?.user.email ?? null);
        setStatus(session ? "idle" : "signed-out");
      });
      unsubscribe = () => sub.data.subscription.unsubscribe();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const syncNow = useCallback(async () => {
    const mod = api.current;
    if (!client || !mod || !email || running.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setStatus("offline");
      return;
    }
    running.current = true;
    setStatus("syncing");
    try {
      await syncOnce(db, mod.supabaseBackend(client));
      const now = Date.now();
      setLastSyncedAt(now);
      try {
        localStorage.setItem(LAST_SYNC_KEY, String(now));
      } catch {
        // Only a display convenience.
      }
      setError(null);
      setStatus("idle");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    } finally {
      running.current = false;
    }
  }, [client, email]);

  // Triggers: open (sign-in), session end, hidden tab, interval, back online.
  useEffect(() => {
    if (!email) return;
    void syncNow();
    const onHidden = () => {
      if (document.visibilityState === "hidden") void syncNow();
    };
    const onRequest = () => void syncNow();
    const timer = setInterval(() => void syncNow(), SYNC_INTERVAL_MS);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener(SYNC_EVENT, onRequest);
    window.addEventListener("online", onRequest);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener(SYNC_EVENT, onRequest);
      window.removeEventListener("online", onRequest);
    };
  }, [email, syncNow]);

  const value = useMemo<SyncContextValue>(
    () => ({
      status,
      email,
      lastSyncedAt,
      error,
      syncNow,
      sendCode: async (address) => {
        if (!client || !api.current) return;
        await api.current.sendCode(client, address.trim());
      },
      verifyCode: async (address, code) => {
        if (!client || !api.current) return;
        await api.current.verifyCode(client, address.trim(), code.trim());
      },
      signOut: async () => {
        if (!client) return;
        await client.auth.signOut();
      },
    }),
    [status, email, lastSyncedAt, error, syncNow, client],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
