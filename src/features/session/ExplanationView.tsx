import { FlagIcon, ThumbsDownIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { REPO_PUBLIC, REPO_URL } from "@/config";
import type { Explanation } from "@/engine/explain/select";
import { reportIssueUrl } from "@/engine/report";
import { Button } from "@/ui/button";

/**
 * Moment content (PLAN.md 7.1): the template line, contrast text, a memory hook in
 * Newsreader Italic (the cartographic type for memory cues), and a fact.
 */
export function ExplanationView({
  explanation,
  hidden = [],
  onNotHelpful,
  cardId,
}: {
  explanation: Explanation;
  hidden?: readonly string[];
  onNotHelpful?: (hookId: string) => void;
  /** The card the facts were shown for; with a public repository, facts get a report link. */
  cardId?: string;
}) {
  const { t, i18n } = useTranslation();
  if (explanation.blocks.length === 0) return null;
  return (
    <div className="flex flex-col gap-4" data-testid="explanation" data-moment={explanation.moment}>
      {explanation.blocks.map((block) => {
        switch (block.kind) {
          case "template":
            return (
              <p key={block.id} className="max-w-[60ch] text-base" data-snippet={block.id}>
                {block.text}
              </p>
            );
          case "contrast":
            return (
              <div key={block.id} className="flex flex-col gap-1 rounded-lg bg-muted p-3">
                <p className="text-sm text-muted-foreground">{t("feedback.contrastLabel")}</p>
                <p className="max-w-[60ch]">{block.text}</p>
              </div>
            );
          case "hook":
            return hidden.includes(block.id) ? (
              <p key={block.id} className="text-sm text-muted-foreground">
                {t("feedback.hookHidden")}
              </p>
            ) : (
              <figure
                key={block.id}
                className="flex flex-col gap-2 rounded-lg bg-card p-4"
                data-hook={block.id}
              >
                <figcaption className="text-sm text-muted-foreground">
                  {t("feedback.hookLabel")}
                </figcaption>
                <blockquote className="max-w-[60ch] text-lg leading-snug" lang={block.locale}>
                  {block.text}
                </blockquote>
                {onNotHelpful ? (
                  <Button
                    variant="ghost"
                    className="-ml-2 self-start text-muted-foreground"
                    onClick={() => onNotHelpful(block.id)}
                    data-testid="not-helpful"
                  >
                    <ThumbsDownIcon aria-hidden />
                    {t("feedback.notHelpful")}
                    <kbd className="ml-1 rounded border border-border px-1.5 text-xs">N</kbd>
                  </Button>
                ) : null}
              </figure>
            );
          default: {
            const fact = (
              <p
                key={block.id}
                className="max-w-[60ch] text-muted-foreground"
                data-snippet={block.id}
              >
                {block.text}
                {REPO_PUBLIC && cardId ? (
                  <a
                    className="ml-2 inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
                    href={reportIssueUrl(REPO_URL, {
                      snippetId: block.id,
                      cardId,
                      locale: i18n.language,
                      text: block.text,
                      title: t("report.title", { id: block.id }),
                      body: t("report.body", {
                        id: block.id,
                        card: cardId,
                        locale: i18n.language,
                        text: block.text,
                      }),
                    })}
                    target="_blank"
                    rel="noreferrer"
                    data-testid="report-fact"
                  >
                    <FlagIcon aria-hidden className="size-3.5" />
                    {t("report.link")}
                  </a>
                ) : null}
              </p>
            );
            // A tier 3 fact (the least known kind, content/VOICE.md) gets a heading of its own,
            // set like the other labelled blocks: small and muted, above the text.
            return block.tier === 3 ? (
              <div key={block.id} className="flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">{t("feedback.bonusLabel")}</p>
                {fact}
              </div>
            ) : (
              fact
            );
          }
        }
      })}
    </div>
  );
}
