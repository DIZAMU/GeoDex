import type { RouteObject } from "react-router";
import { AtlasScreen } from "@/features/atlas/AtlasScreen";
import { EntryScreen } from "@/features/atlas/EntryScreen";
import { DrillScreen } from "@/features/drill/DrillScreen";
import { OnboardingScreen } from "@/features/onboarding/OnboardingScreen";
import { PlacementScreen } from "@/features/placement/PlacementScreen";
import { SessionScreen } from "@/features/session/SessionScreen";
import { SettingsScreen } from "@/features/settings/SettingsScreen";
import { StatsScreen } from "@/features/stats/StatsScreen";
import { TodayScreen } from "@/features/today/TodayScreen";
import { AppLayout } from "./AppLayout";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <TodayScreen /> },
      { path: "atlas", element: <AtlasScreen /> },
      { path: "atlas/:id", element: <EntryScreen /> },
      { path: "stats", element: <StatsScreen /> },
      { path: "settings", element: <SettingsScreen /> },
      { path: "onboarding", element: <OnboardingScreen /> },
    ],
  },
  { path: "/placement", element: <PlacementScreen /> },
  { path: "/session", element: <SessionScreen /> },
  { path: "/drill", element: <DrillScreen /> },
];
