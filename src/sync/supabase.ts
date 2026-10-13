/**
 * Supabase implementation of the sync backend, plus email-code sign-in (PLAN.md 5.6).
 * Loaded only when VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set; without
 * them the app is local-only and this module never loads.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AnswerMode, InputSetting, Rating } from "@/engine/types";
import type { Locale } from "@/i18n/locales";
import type { Sequenced, SyncBackend, WireReview, WireSettings, WireVote } from "./backend";
import { parseSignInProof } from "./signin";

type ReviewRow = {
  id: string;
  card_id: string;
  reviewed_at: string;
  rating: number;
  mode: string;
  input_setting: string;
  correct: boolean;
  chosen_answer: string | null;
  response_ms: number | null;
  duration_ms: number | null;
  snippet_ids: string[];
  scheduled: boolean;
  locale: string;
  device_id: string;
  server_seq: number;
};
type VoteRow = {
  id: string;
  card_id: string;
  hook_id: string;
  created_at_client: string;
  device_id: string;
  server_seq: number;
};

const iso = (ms: number) => new Date(ms).toISOString();
const ms = (value: string) => new Date(value).getTime();

function toReviewRow(e: WireReview): Omit<ReviewRow, "server_seq"> {
  return {
    id: e.id,
    card_id: e.cardId,
    reviewed_at: iso(e.reviewedAt),
    rating: e.rating,
    mode: e.mode,
    input_setting: e.inputSetting,
    correct: e.correct,
    chosen_answer: e.chosenAnswer,
    response_ms: e.responseMs,
    duration_ms: e.durationMs,
    snippet_ids: e.snippetIds,
    scheduled: e.scheduled,
    locale: e.locale,
    device_id: e.deviceId,
  };
}

function fromReviewRow(r: ReviewRow): Sequenced<WireReview> {
  return {
    id: r.id,
    cardId: r.card_id,
    reviewedAt: ms(r.reviewed_at),
    rating: r.rating as Rating,
    mode: r.mode as AnswerMode,
    inputSetting: r.input_setting as InputSetting,
    correct: r.correct,
    chosenAnswer: r.chosen_answer,
    responseMs: r.response_ms ?? 0,
    durationMs: r.duration_ms ?? r.response_ms ?? 0,
    snippetIds: r.snippet_ids,
    scheduled: r.scheduled,
    locale: r.locale as Locale,
    deviceId: r.device_id,
    seq: r.server_seq,
  };
}

export function supabaseBackend(client: SupabaseClient): SyncBackend {
  const fail = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  };
  return {
    async pushReviews(events) {
      if (events.length === 0) return;
      const { error } = await client
        .from("review_events")
        .upsert(events.map(toReviewRow), { onConflict: "id", ignoreDuplicates: true });
      fail(error);
    },
    async pushVotes(votes) {
      if (votes.length === 0) return;
      const rows = votes.map((v) => ({
        id: v.id,
        card_id: v.cardId,
        hook_id: v.hookId,
        created_at_client: iso(v.createdAt),
        device_id: v.deviceId,
      }));
      const { error } = await client
        .from("hook_vote_events")
        .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
      fail(error);
    },
    async pullReviews(afterSeq, limit) {
      const { data, error } = await client
        .from("review_events")
        .select("*")
        .gt("server_seq", afterSeq)
        .order("server_seq")
        .limit(limit);
      fail(error);
      return ((data ?? []) as ReviewRow[]).map(fromReviewRow);
    },
    async pullVotes(afterSeq, limit) {
      const { data, error } = await client
        .from("hook_vote_events")
        .select("*")
        .gt("server_seq", afterSeq)
        .order("server_seq")
        .limit(limit);
      fail(error);
      return ((data ?? []) as VoteRow[]).map(
        (r): Sequenced<WireVote> => ({
          id: r.id,
          cardId: r.card_id,
          hookId: r.hook_id,
          createdAt: ms(r.created_at_client),
          deviceId: r.device_id,
          seq: r.server_seq,
        }),
      );
    },
    async getSettings() {
      const { data, error } = await client
        .from("user_settings")
        .select("data, updated_at")
        .maybeSingle();
      fail(error);
      if (!data) return null;
      const row = data as { data: Omit<WireSettings, "updatedAt">; updated_at: string };
      return { ...row.data, updatedAt: ms(row.updated_at) };
    },
    async putSettings(settings) {
      const { updatedAt, ...data } = settings;
      const { error } = await client
        .from("user_settings")
        .upsert({ data, updated_at: iso(updatedAt) }, { onConflict: "user_id" });
      fail(error);
    },
  };
}

export function createSupabase(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    // A clicked email link lands on the app with the session in the URL; pick it up.
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

/** Sends a sign-in code. Never creates an account (DECISIONS.md 030). */
export async function sendCode(client: SupabaseClient, email: string): Promise<void> {
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) throw new Error(error.message);
}

/** Finishes sign-in with the emailed code or the pasted sign-in link. */
export async function verifyCode(
  client: SupabaseClient,
  email: string,
  input: string,
): Promise<void> {
  const proof = parseSignInProof(input);
  if (!proof) throw new Error("unreadable");
  const { error } =
    proof.kind === "code"
      ? await client.auth.verifyOtp({ email, token: proof.token, type: "email" })
      : await client.auth.verifyOtp({ token_hash: proof.tokenHash, type: proof.type as "email" });
  if (error) throw new Error(error.message);
}
