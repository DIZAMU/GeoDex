import { describe, expect, it } from "vitest";
import { parseSignInProof } from "./signin";

describe("sign-in proof", () => {
  it("reads a typed code, with or without spaces", () => {
    expect(parseSignInProof("123456")).toEqual({ kind: "code", token: "123456" });
    expect(parseSignInProof(" 123 456 ")).toEqual({ kind: "code", token: "123456" });
  });

  it("reads the token from a pasted sign-in link", () => {
    const link =
      "https://abc.supabase.co/auth/v1/verify?token=9f2c1e&type=magiclink&redirect_to=https://geodex.example";
    expect(parseSignInProof(link)).toEqual({
      kind: "link",
      tokenHash: "9f2c1e",
      type: "magiclink",
    });
    expect(parseSignInProof(`Sign in: ${link}`)).toMatchObject({ tokenHash: "9f2c1e" });
    expect(parseSignInProof("https://x.example/?token_hash=abc&type=email")).toEqual({
      kind: "link",
      tokenHash: "abc",
      type: "email",
    });
  });

  it("rejects anything else", () => {
    expect(parseSignInProof("hello")).toBeNull();
    expect(parseSignInProof("123")).toBeNull();
    expect(parseSignInProof("https://abc.supabase.co/auth/v1/verify")).toBeNull();
  });
});
