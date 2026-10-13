import { createBrowserRouter, RouterProvider } from "react-router";
import { LearnerProvider } from "@/features/study/useLearner";
import { routes } from "./routes";

const router = createBrowserRouter(routes);

export function App() {
  return (
    <LearnerProvider>
      <RouterProvider router={router} />
    </LearnerProvider>
  );
}
