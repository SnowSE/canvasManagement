// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  copyToClipboard,
  findMarkdownTable,
  htmlTableToMarkdown,
  tableHeaders,
  tableRowCells,
} from "./previewTables";
import { markdownToHtmlNoImages } from "@/services/htmlMarkdownUtils";

const tableFrom = (html: string) => {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.querySelector("table")!;
};

describe("tableRowCells", () => {
  it("splits on pipes, not escaped ones", () => {
    expect(tableRowCells("| a | b \\| c |")).toEqual(["a", "b \\| c"]);
    expect(tableRowCells("a | b")).toEqual(["a", "b"]);
  });
});

describe("findMarkdownTable", () => {
  const source = `Intro

| **Task** | Points |
| -------- | -----: |
| [Lab](lab.md) | 10 |
| Quiz | 5 |

Between.

| Task | Points |
| --- | --- |
| Exam | 50 |
`;

  it("finds the table's lines by its header, formatting and links aside", () => {
    const found = findMarkdownTable(source, ["Task", "Points"], 0.1)!;
    expect(found.text).toBe("| **Task** | Points |\n| -------- | -----: |\n| [Lab](lab.md) | 10 |\n| Quiz | 5 |");
    expect(source.slice(found.start, found.start + 10)).toBe("| **Task**");
  });

  it("picks the matching table nearest the preview position", () => {
    expect(findMarkdownTable(source, ["Task", "Points"], 0.9)!.text).toContain("Exam");
  });

  it("removes the indentation of a table inside a list item", () => {
    const found = findMarkdownTable("1. Grades:\n\n   | A | B |\n   |---|---|\n   | 1 | 2 |\n", ["A", "B"], 0.5)!;
    expect(found.text).toBe("| A | B |\n|---|---|\n| 1 | 2 |");
  });

  it("is undefined when no pipe table has that header, like an HTML table", () => {
    expect(findMarkdownTable(source, ["Name", "Score"], 0.5)).toBeUndefined();
    expect(findMarkdownTable("<table><tr><th>A</th></tr></table>", ["A"], 0)).toBeUndefined();
  });

  it("doesn't take a settings --- line for a table", () => {
    expect(findMarkdownTable("Name: x | y\n---\nbody", ["Name: x", "y"], 0)).toBeUndefined();
  });

  it("finds a table the renderer made, by the headers it rendered", () => {
    const html = markdownToHtmlNoImages(source);
    const div = document.createElement("div");
    div.innerHTML = html;
    expect(tableHeaders(div.querySelector("table")!)).toEqual(["Task", "Points"]);
  });
});

describe("htmlTableToMarkdown", () => {
  it("writes a pipe table with alignment, inline formatting and escaped pipes", () => {
    const table = tableFrom(`<table>
      <thead><tr><th>Name</th><th align="right">Score</th><th style="text-align:center">Note</th></tr></thead>
      <tbody>
        <tr><td><strong>Ada</strong></td><td>10</td><td><a href="https://example.com">site</a> | <code>x</code></td></tr>
        <tr><td>Bo</td><td>7</td></tr>
      </tbody></table>`);
    expect(htmlTableToMarkdown(table)).toBe(
      [
        "| Name | Score | Note |",
        "| --- | --: | :-: |",
        "| **Ada** | 10 | [site](https://example.com) \\| `x` |",
        "| Bo | 7 |  |",
      ].join("\n"),
    );
  });

  it("uses the first row as the header when there's no thead, and joins lines in a cell with <br>", () => {
    const table = tableFrom("<table><tr><td>A</td></tr><tr><td><p>one</p><p>two</p></td></tr></table>");
    expect(htmlTableToMarkdown(table)).toBe("| A |\n| --- |\n| one<br>two |");
  });
});

describe("copyToClipboard", () => {
  it("puts the text, and the HTML beside it, on the clipboard", () => {
    const data: Record<string, string> = {};
    document.execCommand = () => {
      const event = new Event("copy", { cancelable: true }) as ClipboardEvent;
      Object.defineProperty(event, "clipboardData", {
        value: { setData: (type: string, value: string) => (data[type] = value) },
      });
      document.dispatchEvent(event);
      return true;
    };
    expect(copyToClipboard({ text: "<table></table>", html: "<table></table>" })).toBe(true);
    expect(data).toEqual({ "text/plain": "<table></table>", "text/html": "<table></table>" });
  });
});
