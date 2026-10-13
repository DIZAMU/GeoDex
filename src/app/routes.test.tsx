import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import { ensureDeviceSettings, ensureSettings } from "@/db/settings";
import { LearnerProvider } from "@/features/study/useLearner";
import { routes } from "./routes";

beforeAll(async () => {
  await ensureSettings(db, "en");
  await ensureDeviceSettings(db);
});

describe("routes", () => {
  it("renders Today with navigation and asks a new learner to set up", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(
      <LearnerProvider>
        <RouterProvider router={router} />
      </LearnerProvider>,
    );
    expect(screen.getByRole("link", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Today" }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(await screen.findByTestId("setup")).toHaveAttribute("href", "/onboarding");
  });

  it("renders Settings with theme and language controls", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/settings"] });
    render(
      <LearnerProvider>
        <RouterProvider router={router} />
      </LearnerProvider>,
    );
    expect(
      await screen.findByRole("group", { name: "Theme" }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Language" })).toBeInTheDocument();
    // Without Supabase env vars the app is local-only and says so.
    expect(screen.getByText(/Sync is off in this build/)).toBeInTheDocument();
  });
});
