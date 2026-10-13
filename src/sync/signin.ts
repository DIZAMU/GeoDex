/**
 * What the learner typed or pasted to finish signing in: the code from the email, or the
 * whole sign-in link. Pasting the link works on iOS home-screen apps, whose storage is
 * separate from Safari's, and needs no custom email template (DECISIONS.md 031).
 */
export type SignInProof =
  | { kind: "code"; token: string }
  | { kind: "link"; tokenHash: string; type: string };

export function parseSignInProof(input: string): SignInProof | null {
  const text = input.trim();
  if (/^\d{6,10}$/.test(text.replace(/\s/g, ""))) {
    return { kind: "code", token: text.replace(/\s/g, "") };
  }
  const match = text.match(/https?:\/\/\S+/);
  if (!match) return null;
  try {
    const url = new URL(match[0]);
    const tokenHash = url.searchParams.get("token_hash") ?? url.searchParams.get("token");
    if (!tokenHash) return null;
    return { kind: "link", tokenHash, type: url.searchParams.get("type") ?? "email" };
  } catch {
    return null;
  }
}
