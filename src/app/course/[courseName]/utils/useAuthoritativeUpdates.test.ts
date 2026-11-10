// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAuthoritativeUpdates } from "./useAuthoritativeUpdates";

/**
 * The editor keeps the text the user is editing in this hook. When navigation
 * swaps which item is open, the route component is reused, so the hook is NOT
 * remounted -- `useState(startingText)` does not re-run. Without an item
 * identity to key on, the hook keeps serving the PREVIOUS item's text while the
 * page query has already moved on to the new item. The editor's save effect
 * then sees "text differs from server" and writes the old text over the new
 * item's file.
 *
 * And the server's text wins only when it changed outside this editor: the
 * echo of the editor's own save, however late, must not replace the typing.
 */
describe("useAuthoritativeUpdates", () => {
  const renderForItem = (itemKey: string, startingText: string) =>
    renderHook(
      (props: { itemKey: string; startingText: string }) => useAuthoritativeUpdates(props),
      { initialProps: { itemKey, startingText } }
    );

  it("keeps the user's typing while the same item stays open", () => {
    const { result, rerender } = renderForItem("page:lab-02", "lab 2");

    act(() => result.current.textUpdate("lab 2 edited"));
    // a re-render with the same item must not clobber what the user typed
    rerender({ itemKey: "page:lab-02", startingText: "lab 2" });

    expect(result.current.text).toBe("lab 2 edited");
    expect(result.current.clientIsAuthoritative).toBe(true);
  });

  it("re-seeds the text when navigation opens a different item", () => {
    const { result, rerender } = renderForItem("page:lab-02", "lab 2");

    act(() => result.current.textUpdate("lab 2 edited"));

    // the Next button: same component, different item
    rerender({ itemKey: "page:lab-03", startingText: "lab 3" });

    expect(result.current.text).toBe("lab 3");
  });

  it("is not authoritative immediately after navigating, even though the user just typed", () => {
    const { result, rerender } = renderForItem("page:lab-02", "lab 2");

    act(() => result.current.textUpdate("lab 2 edited"));
    rerender({ itemKey: "page:lab-03", startingText: "lab 3" });

    // this is what prevents the save effect from writing lab 2's text into lab 3
    expect(result.current.clientIsAuthoritative).toBe(false);
  });

  it("gives the editor a fresh monaco key when the item changes", () => {
    const { result, rerender } = renderForItem("page:lab-02", "lab 2");
    const keyBefore = result.current.monacoKey;

    rerender({ itemKey: "page:lab-03", startingText: "lab 3" });

    expect(result.current.monacoKey).not.toBe(keyBefore);
  });

  it("becomes authoritative again once the user types on the new item", () => {
    const { result, rerender } = renderForItem("page:lab-02", "lab 2");

    act(() => result.current.textUpdate("lab 2 edited"));
    rerender({ itemKey: "page:lab-03", startingText: "lab 3" });
    act(() => result.current.textUpdate("lab 3 edited"));

    expect(result.current.text).toBe("lab 3 edited");
    expect(result.current.clientIsAuthoritative).toBe(true);
  });

  it("stays authoritative when a refetch brings back what it saved, or an earlier save, however late", () => {
    const { result, rerender } = renderForItem("page:lab-02", "lab 2");

    act(() => result.current.textUpdate("lab 2 edited"));
    act(() => result.current.textSaved("lab 2 edited"));
    act(() => result.current.textUpdate("lab 2 edited more"));
    act(() => result.current.textSaved("lab 2 edited more"));

    // the echo of the first save, landing after the second was sent
    rerender({ itemKey: "page:lab-02", startingText: "lab 2 edited" });
    expect(result.current.clientIsAuthoritative).toBe(true);
    // a late read from before any save
    rerender({ itemKey: "page:lab-02", startingText: "lab 2" });
    expect(result.current.clientIsAuthoritative).toBe(true);
    expect(result.current.text).toBe("lab 2 edited more");
  });

  it("lets the server win when the text changed outside this editor", () => {
    const { result, rerender } = renderForItem("page:lab-02", "lab 2");

    act(() => result.current.textUpdate("lab 2 edited"));
    rerender({ itemKey: "page:lab-02", startingText: "lab 2 changed in another window" });

    expect(result.current.clientIsAuthoritative).toBe(false);
  });

  it("is authoritative on the server's text once it has taken it", () => {
    const { result, rerender } = renderForItem("page:lab-02", "lab 2");
    const keyBefore = result.current.monacoKey;

    rerender({ itemKey: "page:lab-02", startingText: "lab 2 changed in another window" });
    act(() => result.current.textUpdate("lab 2 changed in another window", true));

    expect(result.current.monacoKey).not.toBe(keyBefore);
    expect(result.current.clientIsAuthoritative).toBe(true);
  });
});
