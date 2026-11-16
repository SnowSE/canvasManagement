// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PreviewTableMenu } from "./PreviewTableMenu";
import { markdownToHtmlNoImages } from "@/services/htmlMarkdownUtils";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: toast }));

const source = `# Grades

Some text.

| Task | Points |
| ---- | -----: |
| Lab  | 10 |
`;

let copied: Record<string, string> = {};
document.execCommand = () => {
  const event = new Event("copy", { cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, "clipboardData", {
    value: { setData: (type: string, value: string) => (copied[type] = value) },
  });
  document.dispatchEvent(event);
  return true;
};

function renderPreview(onEditHere = vi.fn()) {
  render(
    <PreviewTableMenu source={() => source} onEditHere={onEditHere}>
      <div dangerouslySetInnerHTML={{ __html: markdownToHtmlNoImages(source) }} />
    </PreviewTableMenu>,
  );
  // jsdom lays nothing out, so give the table a place on screen
  const table = document.querySelector("table")!;
  table.getBoundingClientRect = () => ({ top: 100, bottom: 300, left: 0, right: 500, width: 500, height: 200, x: 0, y: 100, toJSON: () => ({}) });
  return { table, onEditHere };
}

afterEach(() => {
  cleanup();
  copied = {};
  vi.clearAllMocks();
});

describe("the table menu", () => {
  it("shows a button on the table under the pointer, and none elsewhere", () => {
    const { table } = renderPreview();
    expect(screen.queryByRole("button", { name: /Table/ })).toBeNull();
    fireEvent.pointerOver(table.querySelector("td")!);
    expect(screen.getByRole("button", { name: /Table/ })).toBeTruthy();
  });

  it("copies the table's own markdown from the file", () => {
    const { table } = renderPreview();
    fireEvent.pointerOver(table.querySelector("td")!);
    fireEvent.click(screen.getByRole("button", { name: /Table/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Copy Table (Markdown)" }));
    expect(copied["text/plain"]).toBe("| Task | Points |\n| ---- | -----: |\n| Lab  | 10 |");
    expect(toast.success).toHaveBeenCalledWith("Copied the table as Markdown", expect.anything());
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("copies the table as HTML, rich and as source", () => {
    const { table } = renderPreview();
    fireEvent.pointerOver(table.querySelector("td")!);
    fireEvent.click(screen.getByRole("button", { name: /Table/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Copy Table (HTML)" }));
    expect(copied["text/html"]).toMatch(/^<table>[\s\S]*<td>Lab<\/td>/);
    expect(copied["text/plain"]).toBe(copied["text/html"]);
  });

  it("Edit Here hands over where the table starts in the file", () => {
    const { table, onEditHere } = renderPreview();
    fireEvent.pointerOver(table.querySelector("td")!);
    fireEvent.click(screen.getByRole("button", { name: /Table/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit Here" }));
    expect(onEditHere).toHaveBeenCalledWith(source.indexOf("| Task"));
  });

  it("stays up while the pointer moves from the table onto the button", () => {
    vi.useFakeTimers();
    try {
      const { table } = renderPreview();
      fireEvent.pointerOver(table.querySelector("td")!);
      const button = screen.getByRole("button", { name: /Table/ });
      fireEvent.pointerOver(button);
      fireEvent.click(button);
      vi.advanceTimersByTime(1000);
      expect(screen.getByRole("menu")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes the menu on Escape", () => {
    const { table } = renderPreview();
    fireEvent.pointerOver(table.querySelector("td")!);
    fireEvent.click(screen.getByRole("button", { name: /Table/ }));
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
