/**
 * Module allocation (PLAN.md 6.3, step 4): splits the day's new-card allowance across the
 * enabled modules by weight. A module with fewer candidates than its share passes the rest
 * on, so the allowance is never wasted while any module has cards left.
 */
export type ModulePool = { id: string; weight: number; available: number };

export function allocateNew(allowance: number, pools: readonly ModulePool[]): Map<string, number> {
  const out = new Map(pools.map((p) => [p.id, 0]));
  let remaining = Math.max(0, Math.floor(allowance));
  let open = pools.filter((p) => p.weight > 0 && p.available > 0);
  while (remaining > 0 && open.length > 0) {
    const total = open.reduce((sum, p) => sum + p.weight, 0);
    // Largest remainder: whole shares first, then the leftovers by fractional part, then id.
    const shares = open.map((p) => {
      const exact = (remaining * p.weight) / total;
      return { p, whole: Math.floor(exact), fraction: exact - Math.floor(exact) };
    });
    let left = remaining - shares.reduce((sum, s) => sum + s.whole, 0);
    shares
      .sort((a, b) => b.fraction - a.fraction || a.p.id.localeCompare(b.p.id))
      .forEach((s) => {
        if (left > 0) {
          s.whole++;
          left--;
        }
      });
    let given = 0;
    for (const s of shares) {
      const room = s.p.available - (out.get(s.p.id) ?? 0);
      const take = Math.min(s.whole, room);
      out.set(s.p.id, (out.get(s.p.id) ?? 0) + take);
      given += take;
    }
    remaining -= given;
    open = open.filter((p) => (out.get(p.id) ?? 0) < p.available);
    if (given === 0) break;
  }
  return out;
}
