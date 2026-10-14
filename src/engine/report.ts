/**
 * "Report a wrong fact" (PLAN.md Phase 10): a prefilled GitHub issue, no backend. The
 * learner's browser opens the link; nothing is sent from the app.
 */
export type FactReport = {
  /** Snippet id, such as "NOR.f2". */
  snippetId: string;
  cardId: string;
  locale: string;
  /** The fact as the learner saw it. */
  text: string;
  /** Worded in the learner's language by the caller. */
  title: string;
  body: string;
};

/** The new-issue URL with the title, body and a label filled in. */
export function reportIssueUrl(repoUrl: string, report: FactReport): string {
  const params = new URLSearchParams({
    title: report.title,
    body: report.body,
    labels: "content",
  });
  return `${repoUrl.replace(/\/$/, "")}/issues/new?${params.toString()}`;
}
