import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import { ensureDeviceSettings, ensureSettings } from "@/db/settings";
import { LearnerProvider } from "@/features/study/useLearner";
import { routes } from "./routes";

beforeAll(async () => {
  await ensureSettings(db, "en");
  await ensureDeviceSettings(db);
});

// Each test renders a whole app; unmount it so the next one sees only its own screen.
afterEach(cleanup);

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
        { level: 1, name: "Every country, capital and flag, learned for good" },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/welcome");
    expect(screen.getByTestId("welcome-free")).toHaveTextContent(
      "Free, and it works offline. Your progress stays in this browser.",
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
    // Header links on wide screens and the bottom bar on phones: both are in the document.
    expect(screen.getAllByRole("link", { name: "Today" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Settings" })).toHaveLength(2);
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
      await screen.findByRole("radiogroup", { name: "Appearance" }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Language" })).toBeInTheDocument();
    // No accounts: progress moves between browsers only through backup files.
    expect(screen.getByRole("button", { name: "Download backup" })).toBeInTheDocument();
    expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
  });
});
