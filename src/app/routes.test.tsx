import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    // Header links on wide screens, the bottom bar on phones, and the footer.
    expect(screen.getAllByRole("link", { name: "Today" })).toHaveLength(3);
    expect(screen.getAllByRole("link", { name: "Settings" })).toHaveLength(3);
    expect(screen.getByTestId("footer-credit")).toHaveTextContent("Developed in 2026 by DIZAMU");
    expect(await screen.findByTestId("help-faq")).toBeInTheDocument();
  });

  it("renders Settings with theme and language controls", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/settings?tab=appearance"] });
    render(
      <LearnerProvider>
        <RouterProvider router={router} />
      </LearnerProvider>,
    );
    expect(
      await screen.findByRole("radiogroup", { name: "Appearance" }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Language" })).toBeInTheDocument();
    // Settings is in tabs; the Backup tab holds the backup file, the only way progress moves
    // between browsers (no accounts).
    expect(screen.getByRole("tab", { name: "Appearance" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Backup" }), { button: 0 });
    expect(await screen.findByRole("button", { name: "Download backup" })).toBeInTheDocument();
    expect(router.state.location.search).toBe("?tab=backup");
    expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
  });
});
