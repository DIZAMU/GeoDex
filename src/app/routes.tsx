import { Navigate, type RouteObject } from "react-router";
import { AtlasScreen } from "@/features/atlas/AtlasScreen";
import { EntryScreen } from "@/features/atlas/EntryScreen";
import { DrillScreen } from "@/features/drill/DrillScreen";
import { HelpScreen } from "@/features/help/HelpScreen";
import { OnboardingScreen } from "@/features/onboarding/OnboardingScreen";
import { SessionScreen } from "@/features/session/SessionScreen";
import { SettingsScreen } from "@/features/settings/SettingsScreen";
import { StatsScreen } from "@/features/stats/StatsScreen";
import { TodayScreen } from "@/features/today/TodayScreen";
import { WelcomeScreen } from "@/features/welcome/WelcomeScreen";
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
          { path: "help", element: <HelpScreen /> },
          { path: "onboarding", element: <OnboardingScreen /> },
        ],
      },
      { path: "/welcome", element: <WelcomeScreen /> },
      // 1.0 had a placement test here; 2.0 starts everyone from the beginning.
      { path: "/placement", element: <Navigate to="/" replace /> },
      { path: "/session", element: <SessionScreen /> },
      { path: "/drill", element: <DrillScreen /> },
      // Unknown addresses (old bookmarks, typos) go to Today instead of a bare 404.
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
];
