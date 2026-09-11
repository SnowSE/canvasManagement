import { describe, it, expect } from "vitest";
import {
  collapseUnchanged,
  diffHtmlText,
  diffNormalizedHtml,
  htmlToTextLines,
  normalizeHtmlForDiff,
} from "./htmlTextDiff";

describe("htmlToTextLines", () => {
  it("gives one line per block element with entities decoded", () => {
    const lines = htmlToTextLines(
      '<h4>Title</h4><p>Hello &amp; <strong>world</strong>&nbsp;!</p><ul><li>a</li><li>b &lt; c</li></ul>',
    );
    expect(lines).toEqual(["Title", "Hello & world !", "a", "b < c"]);
  });

  it("drops scripts, blank lines and extra whitespace", () => {
    const lines = htmlToTextLines(
      "<script>var x = 1;</script><p>\n  spaced   out\n</p><p></p><br><div>end</div>",
    );
    expect(lines).toEqual(["spaced out", "end"]);
  });
});

describe("diffHtmlText", () => {
  it("pairs a reworded paragraph into word-level changes", () => {
    const lines = diffHtmlText(
      "<p>Include the Grafana screenshot.</p><p>same</p>",
      "<p>Include the dashboard screenshot.</p><p>same</p>",
    );
    expect(lines).toHaveLength(2);
    expect(lines[0].kind).toBe("changed");
    const removed = lines[0].parts.filter((p) => p.removed).map((p) => p.value);
    const added = lines[0].parts.filter((p) => p.added).map((p) => p.value);
    expect(removed).toEqual(["dashboard"]);
    expect(added).toEqual(["Grafana"]);
    expect(lines[1]).toEqual({ kind: "same", parts: [{ value: "same" }] });
  });

  it("marks a paragraph only in the file as added and only in Canvas as removed", () => {
    const lines = diffHtmlText(
      "<p>keep</p><p>new in file</p>",
      "<p>old in canvas</p><p>keep</p>",
    );
    expect(lines).toEqual([
      { kind: "changed", parts: [{ value: "old in canvas", removed: true }] },
      { kind: "same", parts: [{ value: "keep" }] },
      { kind: "changed", parts: [{ value: "new in file", added: true }] },
    ]);
  });

  it("reports nothing changed when the text matches", () => {
    const lines = diffHtmlText(
      '<p class="a">x</p><ul><li>y</li></ul>',
      "<p>x</p><ul><li>y</li></ul>",
    );
    expect(lines.every((l) => l.kind === "same")).toBe(true);
  });
});

describe("collapseUnchanged", () => {
  it("keeps one line of context around each change and counts the rest", () => {
    const same = (v: string) => ({ kind: "same" as const, parts: [{ value: v }] });
    const changed = { kind: "changed" as const, parts: [{ value: "c", added: true }] };
    const result = collapseUnchanged([
      same("1"),
      same("2"),
      same("3"),
      changed,
      same("5"),
      same("6"),
      same("7"),
    ]);
    expect(result).toEqual([
      { skipped: 2 },
      same("3"),
      changed,
      same("5"),
      { skipped: 2 },
    ]);
  });
});

describe("normalized html diff", () => {
  it("strips attributes other than href and puts each tag boundary on its own line", () => {
    expect(
      normalizeHtmlForDiff(
        '<p class="x" data-id="1">a <a href="/u" target="_blank">link</a></p>\n  <p>b</p>',
      ),
    ).toBe('<p>a <a href="/u">link</a>\n</p>\n<p>b</p>');
  });

  it("ignores attribute-only differences but reports an extra element", () => {
    expect(
      diffNormalizedHtml('<p class="x">a</p>', "<p>a</p>").some(
        (l) => l.added || l.removed,
      ),
    ).toBe(false);

    const lines = diffNormalizedHtml("<p>a</p><p>b</p>", "<p>a</p>");
    expect(lines.filter((l) => l.added).map((l) => l.value)).toEqual(["<p>b</p>"]);
    expect(lines.some((l) => l.removed)).toBe(false);
  });
});
