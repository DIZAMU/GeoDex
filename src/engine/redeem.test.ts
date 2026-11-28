// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isStreakCode, normalizeCode, STREAK_CODE_SHA256, sha256Hex } from "./redeem";

describe("the streak code", () => {
  it("ignores case, spaces and dashes", () => {
    expect(normalizeCode(" gdx-ab12 cd34 ")).toBe("GDXAB12CD34");
  });

  it("hashes with SHA-256", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("accepts only the code whose hash it holds", async () => {
    const expected = await sha256Hex("GDXTEST2345");
    expect(await isStreakCode("gdx-test-2345", expected)).toBe(true);
    expect(await isStreakCode("gdx-test-2346", expected)).toBe(false);
    expect(await isStreakCode("", expected)).toBe(false);
    expect(STREAK_CODE_SHA256).toMatch(/^[0-9a-f]{64}$/);
  });
});
