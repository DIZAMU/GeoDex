import { RotateCwIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/button";

/** Shown when a screen fails to render: what happened and the fix, in the app's own look. */
export function RouteError() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-4 py-16">
      <div role="alert" className="flex flex-col items-start gap-4" data-testid="route-error">
        <h1 className="text-3xl font-medium tracking-tight">{t("error.title")}</h1>
        <p className="text-muted-foreground">{t("error.body")}</p>
        <Button size="lg" onClick={() => window.location.assign("/")}>
          <RotateCwIcon />
          {t("error.reload")}
        </Button>
      </div>
    </main>
  );
}
