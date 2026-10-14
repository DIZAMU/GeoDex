import { Navigate, type RouteObject } from "react-router";
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
import { RouteError } from "./RouteError";

export const routes: RouteObject[] = [
  {
    errorElement: <RouteError />,
    children: [
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
      // Unknown addresses (old bookmarks, typos) go to Today instead of a bare 404.
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
];
