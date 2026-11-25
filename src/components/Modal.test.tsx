// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Modal from "./Modal";

// A dialog covers the whole window, wherever it is opened from: drawn inside a
// bar with a blurred background (as Compare with Canvas's bottom bar has), a
// fixed box is held to that bar instead, and the dialog's buttons were cut off.
describe("a dialog", () => {
  const open = { isOpen: true, openModal: () => {}, closeModal: () => {} };
  it("is drawn at the top of the page, not inside what opened it", () => {
    render(
      <div data-testid="bar" style={{ backdropFilter: "blur(4px)" }}>
        <Modal modalControl={open}>{() => <button>Replace the file&apos;s value with Canvas&apos;s</button>}</Modal>
      </div>,
    );
    const button = screen.getByRole("button", { name: /Replace/ });
    expect(screen.getByTestId("bar").contains(button)).toBe(false);
    expect(document.body.contains(button)).toBe(true);
  });
  it("is not drawn at all while closed", () => {
    render(<Modal modalControl={{ ...open, isOpen: false }}>{() => <button>Replace</button>}</Modal>);
    expect(screen.queryByRole("button", { name: "Replace" })).toBeNull();
  });
});
