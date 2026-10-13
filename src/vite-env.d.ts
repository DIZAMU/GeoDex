/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Absent means local-only mode. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable key. Safe in the bundle: row-level security protects the data. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}
