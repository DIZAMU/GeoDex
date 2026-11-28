/**
 * The streak code: one code, held by the author, that lets a lost streak be set again in
 * Settings. Only its SHA-256 is here. GeoDex has no server, so the check runs in the browser,
 * like everything else; anyone can change their own progress in their own browser storage
 * anyway. The hash only keeps the code itself out of the public source.
 */
export const STREAK_CODE_SHA256 =
  "23ab863b0624d715359e6d3f09b47c658e186ef67be06b8246110f9fb1e44741";

/** Upper case, with spaces, dashes and anything else that is not a letter or digit removed. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isStreakCode(input: string, expected = STREAK_CODE_SHA256): Promise<boolean> {
  const code = normalizeCode(input);
  return code.length > 0 && (await sha256Hex(code)) === expected;
}

/** The most days a streak can be set to: ten years. */
export const MAX_RESTORED_STREAK = 3650;
