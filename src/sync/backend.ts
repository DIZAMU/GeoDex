/**
 * The server side of sync, as the sync engine sees it (PLAN.md 5.6). Supabase implements it
 * in production; an in-memory server implements it for tests.
 */
import type { HookVoteEvent, ReviewEvent, SettingsRow } from "@/db/db";

/** An event as it travels: everything but the local `synced` flag. */
export type WireReview = Omit<ReviewEvent, "synced">;
export type WireVote = Omit<HookVoteEvent, "synced">;
export type WireSettings = Omit<SettingsRow, "id">;
export type Sequenced<T> = T & { seq: number };

export type SyncBackend = {
  /** Inserts events, ignoring ids the server already has. Idempotent. */
  pushReviews(events: readonly WireReview[]): Promise<void>;
  pushVotes(votes: readonly WireVote[]): Promise<void>;
  /** Events with server sequence greater than `afterSeq`, in sequence order. */
  pullReviews(afterSeq: number, limit: number): Promise<Sequenced<WireReview>[]>;
  pullVotes(afterSeq: number, limit: number): Promise<Sequenced<WireVote>[]>;
  getSettings(): Promise<WireSettings | null>;
  putSettings(settings: WireSettings): Promise<void>;
};

/** A server held in memory: the same rules as the real one, for tests and demos. */
export function memoryBackend() {
  const reviews: Sequenced<WireReview>[] = [];
  const votes: Sequenced<WireVote>[] = [];
  let settings: WireSettings | null = null;
  let seq = 0;
  const insert = <T extends { id: string }>(table: Sequenced<T>[], rows: readonly T[]) => {
    const ids = new Set(table.map((r) => r.id));
    for (const row of rows) {
      if (ids.has(row.id)) continue;
      ids.add(row.id);
      seq += 1;
      table.push({ ...structuredClone(row), seq });
    }
  };
  const page = <T>(table: Sequenced<T>[], afterSeq: number, limit: number) =>
    table
      .filter((r) => r.seq > afterSeq)
      .sort((a, b) => a.seq - b.seq)
      .slice(0, limit)
      .map((r) => structuredClone(r));
  const backend: SyncBackend = {
    pushReviews: async (rows) => insert(reviews, rows),
    pushVotes: async (rows) => insert(votes, rows),
    pullReviews: async (afterSeq, limit) => page(reviews, afterSeq, limit),
    pullVotes: async (afterSeq, limit) => page(votes, afterSeq, limit),
    getSettings: async () => (settings ? structuredClone(settings) : null),
    putSettings: async (next) => {
      settings = structuredClone(next);
    },
  };
  return { backend, reviews, votes, settings: () => settings };
}
