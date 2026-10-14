import { RotateCwIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/button";

/** Shown when a screen fails to render: what happened and the fix, in the app's own look. */
export function RouteError() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div
        role="alert"
        className="surface flex w-full max-w-md flex-col gap-4 p-8"
        data-testid="route-error"
      >
        <h1 className="font-name text-3xl tracking-tight">{t("error.title")}</h1>
        <p className="text-muted-foreground">{t("error.body")}</p>
        <Button size="lg" className="self-start" onClick={() => window.location.assign("/")}>
          <RotateCwIcon />
          {t("error.reload")}
        </Button>
      </div>
    </main>
  );
}
