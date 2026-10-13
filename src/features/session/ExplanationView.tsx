import { ThumbsDownIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Explanation } from "@/engine/explain/select";
import { Button } from "@/ui/button";

/**
 * Moment content (PLAN.md 7.1): the template line, contrast text, a memory hook in
 * Newsreader Italic (the cartographic type for memory cues), and a fact.
 */
export function ExplanationView({
  explanation,
  hidden = [],
  onNotHelpful,
}: {
  explanation: Explanation;
  hidden?: readonly string[];
  onNotHelpful?: (hookId: string) => void;
}) {
  const { t } = useTranslation();
  if (explanation.blocks.length === 0) return null;
  return (
    <div
      className="stagger flex flex-col gap-4"
      data-testid="explanation"
      data-moment={explanation.moment}
    >
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
              <div key={block.id} className="flex flex-col gap-1 border-l-2 border-primary pl-3">
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
                className="flex flex-col gap-2 rounded-lg bg-background/40 p-4"
                data-hook={block.id}
              >
                <figcaption className="text-sm text-muted-foreground">
                  {t("feedback.hookLabel")}
                </figcaption>
                <blockquote
                  className="max-w-[60ch] font-serif text-xl leading-snug italic"
                  lang={block.locale}
                >
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
          default:
            return (
              <p
                key={block.id}
                className="max-w-[60ch] text-muted-foreground"
                data-snippet={block.id}
              >
                {block.tier === 3 ? (
                  <span className="mr-2 text-sm text-foreground">{t("feedback.deeperLabel")}</span>
                ) : null}
                {block.text}
              </p>
            );
        }
      })}
    </div>
  );
}
