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
  it("sends a new learner from Today to the welcome page, which says it is free", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(
      <LearnerProvider>
        <RouterProvider router={router} />
      </LearnerProvider>,
    );
    expect(
      await screen.findByRole(
        "heading",
        { level: 1, name: "Learn the world, and keep it." },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/welcome");
    expect(screen.getByTestId("welcome-free")).toHaveTextContent(
      "Free. No ads, no account, no tracking.",
    );
    expect(screen.getByTestId("setup")).toBeInTheDocument();
  });

  it("shows navigation and the help button on the app screens", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/help"] });
    render(
      <LearnerProvider>
        <RouterProvider router={router} />
      </LearnerProvider>,
    );
    expect(screen.getByRole("link", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(await screen.findByTestId("app-map")).toBeInTheDocument();
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
