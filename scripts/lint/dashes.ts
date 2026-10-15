/** U+2013 en dash and U+2014 em dash, banned in committed text by CONTRIBUTING.md. */
export const EN_DASH = String.fromCodePoint(0x2013);
export const EM_DASH = String.fromCodePoint(0x2014);

/** Third-party texts that must stay verbatim. */
export const VERBATIM_FILES = [/^LICENSE$/, /^public\/licenses\//];

const TEXT_EXTENSIONS =
  /\.(md|json|ts|tsx|js|mjs|cjs|css|html|svg|yml|yaml|toml|txt|sql)$|^\.[\w-]+$|\/\.[\w-]+$/;

export function shouldCheck(path: string): boolean {
  if (VERBATIM_FILES.some((pattern) => pattern.test(path))) return false;
  if (path === "pnpm-lock.yaml") return false;
  return TEXT_EXTENSIONS.test(path);
}

export type DashHit = { path: string; line: number; text: string };

export function findDashes(path: string, content: string): DashHit[] {
  return content
    .split("\n")
    .flatMap((text, index) =>
      text.includes(EN_DASH) || text.includes(EM_DASH)
        ? [{ path, line: index + 1, text: text.trim() }]
        : [],
    );
}
