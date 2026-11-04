import { createBrowserRouter, RouterProvider } from "react-router";
import { LearnerProvider } from "@/features/study/useLearner";
import { routes } from "./routes";
import { reloadOnUpdate } from "./update";

const router = createBrowserRouter(routes);

// A new release that takes over loads itself, once any session in progress is left.
reloadOnUpdate({
  serviceWorker: typeof navigator === "undefined" ? undefined : navigator.serviceWorker,
  path: () => router.state.location.pathname,
  onNavigate: (listener) => {
    router.subscribe(listener);
  },
  reload: () => window.location.reload(),
});

export function App() {
  return (
    <LearnerProvider>
      <RouterProvider router={router} />
    </LearnerProvider>
  );
}
