import { describe, it, expect, vi, afterEach } from "vitest";
import { markdownToHtmlNoImages } from "./htmlMarkdownUtils";
import { listTableExample } from "@/components/editor/help/MarkdownHelpSections";

const render = (markdown: string) =>
  new DOMParser().parseFromString(markdownToHtmlNoImages(markdown), "text/html");

const texts = (nodes: Iterable<Element>) =>
  [...nodes].map((n) => n.textContent?.trim() ?? "");

// the responsive table's rows, as the text of each cell
const rowsOf = (doc: Document) =>
  [...doc.querySelectorAll('[role="table"] [role="row"]')]
    .filter((row) => row.querySelector('[role="cell"]'))
    .map((row) => texts(row.querySelectorAll('[role="cell"]')));

const schedule = `<!-- table caption="Fall schedule" -->
- Date: Wed 8/26
  - Belt: White
  - Topic: bool, int, char
  - Due: —
- Fri 8/28
  - White
  - Console.ReadKey
- Mon 9/7
  - Topic: *No class: Labor Day*
- Mon 8/31
  - White
  - break, practice
  - Learning Log 1
`;

afterEach(() => vi.restoreAllMocks());

describe("list tables", () => {
  it("takes the columns from the first row and later values in order", () => {
    const doc = render(schedule);

    expect(texts(doc.querySelectorAll('[role="columnheader"]'))).toEqual([
      "Date",
      "Belt",
      "Topic",
      "Due",
    ]);
    expect(rowsOf(doc)).toEqual([
      ["Wed 8/26", "White", "bool, int, char", ""],
      ["Fri 8/28", "White", "Console.ReadKey", ""],
      ["Mon 9/7", "", "No class: Labor Day", ""],
      ["Mon 8/31", "White", "break, practice", "Learning Log 1"],
    ]);
  });

  it("names the table by its caption", () => {
    const doc = render(schedule);

    expect(doc.querySelector('[role="table"]')?.getAttribute("aria-label")).toBe(
      "Fall schedule"
    );
  });

  it("keeps a label that isn't a column as part of the value", () => {
    const doc = render(`<!-- table -->
- Date: Fri 12/11
  - Topic: Review
- Mon 12/14
  - Final Exam: Noon
`);

    expect(rowsOf(doc)[1]).toEqual(["Mon 12/14", "Final Exam: Noon"]);
  });

  it("accepts bold labels", () => {
    const doc = render(`<!-- table -->
- **Date:** Wed 8/26
  - **Topic**: Intro
- Fri 8/28
  - **Topic:** Scope
`);

    expect(texts(doc.querySelectorAll('[role="columnheader"]'))).toEqual(["Date", "Topic"]);
    expect(rowsOf(doc)).toEqual([
      ["Wed 8/26", "Intro"],
      ["Fri 8/28", "Scope"],
    ]);
  });

  it("leaves -, –, — and n/a empty", () => {
    const doc = render(`<!-- table -->
- Date: Mon
  - A: -
  - B: –
  - C: n/a
  - D: x
`);

    expect(rowsOf(doc)).toEqual([["Mon", "", "", "", "x"]]);
  });

  it("renders a value over several lines, with its own list", () => {
    const doc = render(`<!-- table -->
- Date: Mon
  - Reading: two chapters
    - Chapter 1
    - Chapter 2
`);

    const cell = doc.querySelectorAll('[role="table"] [role="cell"]')[1];
    expect(texts(cell.querySelectorAll("li"))).toEqual(["Chapter 1", "Chapter 2"]);
  });

  it("works with blank lines between rows", () => {
    const doc = render(`<!-- table -->
- Date: Mon
  - Topic: Intro

- Wed
  - Scope
`);

    expect(rowsOf(doc)).toEqual([
      ["Mon", "Intro"],
      ["Wed", "Scope"],
    ]);
  });

  it("resolves reference links defined after the table", () => {
    const doc = render(`<!-- table -->
- Date: Mon
  - Reading: [Norvig][norvig]

[norvig]: https://norvig.com/21-days.html
`);

    expect(doc.querySelector('[role="cell"] a')?.getAttribute("href")).toBe(
      "https://norvig.com/21-days.html"
    );
  });

  it("offers the same rows as a plain table under Show as a table", () => {
    const doc = render(schedule);
    const table = doc.querySelector("details table");

    expect(doc.querySelector("details > summary")?.textContent).toBe("Show as a table");
    expect(table?.querySelector("caption")?.textContent).toBe("Fall schedule");
    expect(texts(table!.querySelectorAll('th[scope="col"]'))).toEqual([
      "Date",
      "Belt",
      "Topic",
      "Due",
    ]);
    expect(
      [...table!.querySelectorAll("tbody tr")].map((tr) => texts(tr.children))
    ).toEqual(rowsOf(doc));
  });

  it("keeps the layout's calc() and #rgba colors through sanitizing", () => {
    const html = markdownToHtmlNoImages(schedule);

    expect(html).toMatch(/style="[^"]*calc\(/);
    expect(html).toMatch(/style="[^"]*#8887/);
  });

  it("warns about an option it doesn't know and still renders", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const doc = render(`<!-- table caption="x" sortable -->
- Date: Mon
  - Topic: Intro
`);

    expect(rowsOf(doc)).toEqual([["Mon", "Intro"]]);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("sortable"));
  });

  it("leaves a list without labels on its first row as a list, with a warning", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const doc = render(`<!-- table -->
- Mon
  - Intro
`);

    expect(doc.querySelector('[role="table"]')).toBeNull();
    expect(texts(doc.querySelectorAll("li"))[1]).toBe("Intro");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("label"));
  });

  it("leaves the comment alone inside a code block", () => {
    const html = markdownToHtmlNoImages("```\n<!-- table -->\n- Date: Mon\n```\n");

    expect(html).toContain("&lt;!-- table --&gt;");
    expect(html).not.toContain('role="table"');
  });

  it("leaves other comments and lists alone", () => {
    const doc = render(`<!-- note -->
- Date: Mon
  - Topic: Intro
`);

    expect(doc.querySelector('[role="table"]')).toBeNull();
    expect(doc.querySelectorAll("li")).toHaveLength(2);
  });

  it("renders the help pane's example", () => {
    const doc = render(listTableExample);

    expect(rowsOf(doc)).toEqual([
      ["Wed 8/26", "Intro", ""],
      ["Fri 8/28", "Scope and closures", "Lab 1"],
      ["Mon 9/7", "No class: Labor Day", ""],
    ]);
  });
});
