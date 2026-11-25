// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDelayedSave } from "./useDelayedSave";

describe("saving what is typed (teichert#90)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** An editor showing `item` with `text` typed; each save says which item and text it would write, and whether on the way out. */
  const saves: string[] = [];
  const editor = (item: string, text: string) =>
    renderHook(({ item, text }) => useDelayedSave(item, 500, (leaving) => saves.push(`${item}: ${text}${leaving ? " (leaving)" : ""}`), [item, text]), { initialProps: { item, text } });
  beforeEach(() => (saves.length = 0));

  it("saves after the delay", () => {
    editor("lab 1", "typed");
    vi.advanceTimersByTime(500);
    expect(saves).toEqual(["lab 1: typed"]);
  });
  it("waits for the typing to pause: one save, of the last text", () => {
    const { rerender } = editor("lab 1", "t");
    vi.advanceTimersByTime(300);
    rerender({ item: "lab 1", text: "typed" });
    vi.advanceTimersByTime(500);
    expect(saves).toEqual(["lab 1: typed"]);
  });
  it("saves the last edit on the way to another item within the delay, as the item left", () => {
    const { rerender } = editor("lab 1", "typed");
    vi.advanceTimersByTime(100);
    rerender({ item: "lab 2", text: "lab 2's text" });
    expect(saves).toEqual(["lab 1: typed (leaving)"]);
  });
  it("saves the last edit when the editor closes within the delay", () => {
    const { unmount } = editor("lab 1", "typed");
    unmount();
    expect(saves).toEqual(["lab 1: typed (leaving)"]);
  });
  it("saves nothing more on the way out once the delay's save has run", () => {
    const { unmount } = editor("lab 1", "typed");
    vi.advanceTimersByTime(500);
    unmount();
    expect(saves).toEqual(["lab 1: typed"]);
  });
});
