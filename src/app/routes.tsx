import type { RouteObject } from "react-router";
import { OnboardingScreen } from "@/features/onboarding/OnboardingScreen";
import { PlacementScreen } from "@/features/placement/PlacementScreen";
import { SessionScreen } from "@/features/session/SessionScreen";
import { SettingsScreen } from "@/features/settings/SettingsScreen";
import { TodayScreen } from "@/features/today/TodayScreen";
import { AppLayout } from "./AppLayout";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <TodayScreen /> },
      { path: "settings", element: <SettingsScreen /> },
      { path: "onboarding", element: <OnboardingScreen /> },
    ],
  },
  { path: "/placement", element: <PlacementScreen /> },
  { path: "/session", element: <SessionScreen /> },
];
