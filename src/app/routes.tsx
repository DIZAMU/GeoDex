import type { RouteObject } from "react-router";
import { TodayScreen } from "@/features/today/TodayScreen";
import { AppLayout } from "./AppLayout";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppLayout />,
    children: [{ index: true, element: <TodayScreen /> }],
  },
];
