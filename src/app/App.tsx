import { createBrowserRouter, RouterProvider } from "react-router";
import { LearnerProvider } from "@/features/study/useLearner";
import { SyncProvider } from "@/sync/SyncProvider";
import { routes } from "./routes";

const router = createBrowserRouter(routes);

export function App() {
  return (
    <SyncProvider>
      <LearnerProvider>
        <RouterProvider router={router} />
      </LearnerProvider>
    </SyncProvider>
  );
}
