// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isBusy, reloadOnUpdate } from "./update";

/** A stand-in for navigator.serviceWorker: an event target with a controller. */
function worker(controlled: boolean) {
  const target = new EventTarget() as EventTarget & { controller: object | null };
  target.controller = controlled ? {} : null;
  return target as unknown as ServiceWorkerContainer;
}

function setup(path: string, controlled = true) {
  const sw = worker(controlled);
  const state = { path, reloads: 0, listeners: [] as (() => void)[] };
  reloadOnUpdate({
    serviceWorker: sw,
    path: () => state.path,
    onNavigate: (listener) => state.listeners.push(listener),
    reload: () => {
      state.reloads++;
    },
  });
  const navigate = (to: string) => {
    state.path = to;
    for (const listener of state.listeners) listener();
  };
  const takeOver = () => sw.dispatchEvent(new Event("controllerchange"));
  return { state, navigate, takeOver };
}

describe("reload on update", () => {
  it("knows which routes are busy", () => {
    expect(isBusy("/session")).toBe(true);
    expect(isBusy("/drill")).toBe(true);
    expect(isBusy("/")).toBe(false);
    expect(isBusy("/sessions-log")).toBe(false);
    expect(isBusy("/atlas/NOR")).toBe(false);
  });

  it("reloads at once when a new version takes over outside a session", () => {
    const { state, takeOver } = setup("/");
    takeOver();
    expect(state.reloads).toBe(1);
  });

  it("waits until the learner leaves a session, then reloads once", () => {
    const { state, navigate, takeOver } = setup("/session");
    takeOver();
    expect(state.reloads).toBe(0);
    navigate("/session");
    expect(state.reloads).toBe(0);
    navigate("/");
    expect(state.reloads).toBe(1);
    navigate("/atlas");
    expect(state.reloads).toBe(1);
  });

  it("does nothing on a first visit, when no older version is on screen", () => {
    const { state, takeOver } = setup("/", false);
    takeOver();
    expect(state.reloads).toBe(0);
  });

  it("does nothing without service workers", () => {
    expect(() =>
      reloadOnUpdate({
        serviceWorker: undefined,
        path: () => "/",
        onNavigate: () => {},
        reload: () => {},
      }),
    ).not.toThrow();
  });
});
