/**
 * Supabase settings from the build environment. `VITE_SUPABASE_URL` may be the full project
 * URL or just the project id, which is easy to paste by mistake; both work.
 */
export function supabaseUrl(value: string | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  if (/^[a-z0-9]{20}$/.test(text)) return `https://${text}.supabase.co`;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.hostname === "localhost" ? url.origin : null;
  } catch {
    return null;
  }
}
