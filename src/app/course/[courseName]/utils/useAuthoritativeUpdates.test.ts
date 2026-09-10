import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAuthoritativeUpdates } from "./useAuthoritativeUpdates";

/**
 * Regression tests for the "Next button overwrites the new item with the
 * previous item's contents" bug.
 *
 * The editor keeps the text the user is editing in this hook. When navigation
 * swaps which item is open, the route component is reused, so the hook is NOT
 * remounted -- `useState(startingText)` does not re-run. Without an item
 * identity to key on, the hook keeps serving the PREVIOUS item's text while the
 * page query has already moved on to the new item. The editor's save effect
 * then sees "text differs from server" and writes the old text over the new
 * item's file.
 */
describe("useAuthoritativeUpdates", () => {
  const renderForItem = (
    itemKey: string,
    startingText: string,
    serverUpdatedAt: number
  ) =>
    renderHook(
      (props: {
        itemKey: string;
        startingText: string;
        serverUpdatedAt: number;
      }) => useAuthoritativeUpdates(props),
      { initialProps: { itemKey, startingText, serverUpdatedAt } }
    );

  it("keeps the user's typing while the same item stays open", () => {
    const { result, rerender } = renderForItem("page:lab-02", "lab 2", 1000);

    act(() => result.current.textUpdate("lab 2 edited"));
    // a re-render with the same item must not clobber what the user typed
    rerender({ itemKey: "page:lab-02", startingText: "lab 2", serverUpdatedAt: 1000 });

    expect(result.current.text).toBe("lab 2 edited");
    expect(result.current.clientIsAuthoritative).toBe(true);
  });

  it("re-seeds the text when navigation opens a different item", () => {
    const { result, rerender } = renderForItem("page:lab-02", "lab 2", 1000);

    act(() => result.current.textUpdate("lab 2 edited"));

    // the Next button: same component, different item
    rerender({ itemKey: "page:lab-03", startingText: "lab 3", serverUpdatedAt: 2000 });

    expect(result.current.text).toBe("lab 3");
  });

  it("is not authoritative immediately after navigating, even though the user just typed", () => {
    const { result, rerender } = renderForItem("page:lab-02", "lab 2", 1000);

    act(() => result.current.textUpdate("lab 2 edited"));
    rerender({ itemKey: "page:lab-03", startingText: "lab 3", serverUpdatedAt: 2000 });

    // this is what prevents the save effect from writing lab 2's text into lab 3
    expect(result.current.clientIsAuthoritative).toBe(false);
  });

  it("gives the editor a fresh monaco key when the item changes", () => {
    const { result, rerender } = renderForItem("page:lab-02", "lab 2", 1000);
    const keyBefore = result.current.monacoKey;

    rerender({ itemKey: "page:lab-03", startingText: "lab 3", serverUpdatedAt: 2000 });

    expect(result.current.monacoKey).not.toBe(keyBefore);
  });

  it("becomes authoritative again once the user types on the new item", () => {
    const { result, rerender } = renderForItem("page:lab-02", "lab 2", 1000);

    act(() => result.current.textUpdate("lab 2 edited"));
    rerender({ itemKey: "page:lab-03", startingText: "lab 3", serverUpdatedAt: 2000 });
    act(() => result.current.textUpdate("lab 3 edited"));

    expect(result.current.text).toBe("lab 3 edited");
    expect(result.current.clientIsAuthoritative).toBe(true);
  });

  it("still takes server updates for the same item when the client is behind", () => {
    const { result, rerender } = renderForItem("page:lab-02", "lab 2", 1000);

    // server moved well past anything the client has typed
    rerender({
      itemKey: "page:lab-02",
      startingText: "lab 2 from server",
      serverUpdatedAt: Date.now() + 60_000,
    });

    expect(result.current.clientIsAuthoritative).toBe(false);
  });
});
