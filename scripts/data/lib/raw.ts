import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Raw fetch cache. Gitignored; the build reads only from here, so it is deterministic. */
export const RAW_DIR = "data/raw";
const MANIFEST = join(RAW_DIR, "manifest.json");

export const USER_AGENT = "GeoDex-build/1.0 (https://github.com/DIZAMU/GeoDex; data build script)";

type Manifest = Record<string, { url: string; fetchedAt: string }>;

export function readManifest(): Manifest {
  try {
    return JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
  } catch {
    return {};
  }
}

export function rawPath(name: string): string {
  return join(RAW_DIR, name);
}

export function readRaw(name: string): string {
  try {
    return readFileSync(rawPath(name), "utf8");
  } catch {
    throw new Error(`Missing raw file ${rawPath(name)}. Run pnpm data:fetch first.`);
  }
}

export function writeRaw(name: string, url: string, body: string): void {
  const path = rawPath(name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  const manifest = readManifest();
  manifest[name] = { url, fetchedAt: new Date().toISOString().slice(0, 10) };
  const sorted = Object.fromEntries(
    Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);
}

export function hasRaw(name: string): boolean {
  return name in readManifest();
}

export async function fetchText(url: string, init: RequestInit = {}): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, {
      ...init,
      headers: { "User-Agent": USER_AGENT, ...init.headers },
    });
    if (response.ok) return response.text();
    // Wikidata asks clients to back off on 429 and 5xx.
    if (attempt < 4 && (response.status === 429 || response.status >= 500)) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * 2 ** attempt));
      continue;
    }
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
}
