import { describe, expect, it } from "vitest";
import { supabaseUrl } from "./config";

describe("supabaseUrl", () => {
  it("accepts the full URL or just the project id", () => {
    expect(supabaseUrl("https://xvcawgervgmjavvzxtsr.supabase.co")).toBe(
      "https://xvcawgervgmjavvzxtsr.supabase.co",
    );
    expect(supabaseUrl("https://xvcawgervgmjavvzxtsr.supabase.co/")).toBe(
      "https://xvcawgervgmjavvzxtsr.supabase.co",
    );
    expect(supabaseUrl(" xvcawgervgmjavvzxtsr ")).toBe("https://xvcawgervgmjavvzxtsr.supabase.co");
  });

  it("treats anything else as not configured", () => {
    expect(supabaseUrl(undefined)).toBeNull();
    expect(supabaseUrl("")).toBeNull();
    expect(supabaseUrl("not a url")).toBeNull();
    expect(supabaseUrl("http://example.com")).toBeNull();
  });
});
