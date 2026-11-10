import { ArrowUpIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/** How far down the page, in pixels, before the button shows. */
const SHOW_AFTER = 600;

/**
 * A round button low on the right that scrolls back to the top. It appears once the page has
 * been scrolled a good way, sits above the phone's bottom bar, and fades in and out.
 */
export function BackToTop() {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const update = () => setShown(window.scrollY > SHOW_AFTER);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <button
      type="button"
      aria-label={t("footer.toTop")}
      title={t("footer.toTop")}
      data-testid="back-to-top"
      tabIndex={shown ? 0 : -1}
      aria-hidden={!shown}
      onClick={() => {
        const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      }}
      className={`fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex size-11 items-center justify-center rounded-full bg-foreground text-background shadow-[var(--elevation)] transition-all duration-200 ease-(--ease-ui) hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:right-6 sm:bottom-6 ${
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <ArrowUpIcon aria-hidden className="size-5" />
    </button>
  );
}
