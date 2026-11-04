/**
 * Loading a new release. The service worker fetches a new version in the background and takes
 * over at once, but the page on screen is still the old one until it loads again. This reloads
 * it as soon as the new worker is in charge, except during a session or a drill: then it waits
 * until the learner leaves, so no question is cut off. Answers are saved one by one, so a
 * reload never loses one.
 */

/** Routes where a reload would cut off a question. */
const BUSY = /^\/(session|drill)(\/|$)/;

export function isBusy(path: string): boolean {
  return BUSY.test(path);
}

export function reloadOnUpdate(options: {
  serviceWorker: ServiceWorkerContainer | undefined;
  /** The current route's path. */
  path: () => string;
  /** Calls the listener after each route change. */
  onNavigate: (listener: () => void) => void;
  reload: () => void;
}): void {
  const { serviceWorker } = options;
  // On a first visit no older version is on screen, so the worker taking over needs no reload.
  if (!serviceWorker?.controller) return;
  let pending = false;
  const tryReload = () => {
    if (!pending || isBusy(options.path())) return;
    pending = false;
    options.reload();
  };
  serviceWorker.addEventListener("controllerchange", () => {
    pending = true;
    tryReload();
  });
  options.onNavigate(tryReload);
}
