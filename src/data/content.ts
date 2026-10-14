/**
 * Written content (PLAN.md 5.2): entity hooks and facts, confusions with contrast text, and
 * the compiled templates. Loaded as separate chunks, like the world data.
 */
import { pairKey } from "@/engine/confusions";
import type {
  Confusion,
  ContentGroupFile,
  EntityContent,
  HookType,
  TemplatesFile,
} from "@/engine/explain/types";

export type ContentIndex = {
  templates: TemplatesFile;
  byEntity: ReadonlyMap<string, EntityContent>;
  hookType: (hookId: string) => HookType | undefined;
  /** Contrast text for an unordered pair of entity ids, any dimension. */
  confusion: (a: string, b: string) => Confusion | undefined;
  confusions: readonly Confusion[];
};

export function assembleContent(
  groups: readonly ContentGroupFile[],
  confusions: readonly Confusion[],
  templates: TemplatesFile,
): ContentIndex {
  const byEntity = new Map<string, EntityContent>();
  const types = new Map<string, HookType>();
  for (const group of groups) {
    for (const entity of group.entities) {
      byEntity.set(entity.entityId, entity);
      const hooks = [
        ...entity.hooks.en,
        ...entity.hooks.nb,
        ...(entity.capitalHooks?.en ?? []),
        ...(entity.capitalHooks?.nb ?? []),
      ];
      for (const h of hooks) types.set(h.id, h.type);
    }
  }
  const pairs = new Map(confusions.map((c) => [pairKey(c.a, c.b), c]));
  return {
    templates,
    byEntity,
    hookType: (id) => types.get(id),
    confusion: (a, b) => pairs.get(pairKey(a, b)),
    confusions,
  };
}

let pending: Promise<ContentIndex> | null = null;

export function loadContent(): Promise<ContentIndex> {
  pending ??= (async () => {
    const modules = import.meta.glob<{ default: ContentGroupFile }>(
      "../../content/entities/*/*.json",
    );
    const [groups, confusions, templates] = await Promise.all([
      Promise.all(Object.values(modules).map((load) => load().then((m) => m.default))),
      import("../../content/confusions.json"),
      import("../generated/templates.json"),
    ]);
    return assembleContent(
      groups,
      (confusions.default as { confusions: Confusion[] }).confusions,
      templates.default as unknown as TemplatesFile,
    );
  })();
  return pending;
}
