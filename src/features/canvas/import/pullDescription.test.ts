// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { pullDescription } from "./pullDescription";
import { markdownToHTMLSafe } from "@/services/htmlMarkdownUtils";
import { htmlIsCloseEnough } from "@/services/utils/htmlIsCloseEnough";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";

const settings = { name: "course", canvasId: 100, assets: [] } as unknown as LocalCourseSettings;
const render = (markdownString: string) => markdownToHTMLSafe({ markdownString, settings });

const file = `# Staged rollouts

First *paragraph*, as the file has it.

\`\`\`mermaid
graph LR
  A --> B
\`\`\`

- one
- two

Last paragraph.
`;
/** Canvas's copy: what the file renders to, with one thing changed there. */
const canvas = (change: (html: string) => string) => change(render(file));
const edited = (html: string) => html.replace("as the file has it.", "edited in Canvas.");
const pulled = (change: (html: string) => string) => pullDescription(file, canvas(change), render)!;

describe("pulling a description from Canvas: only the blocks that differ", () => {
  it("leaves a file that already matches as it is", () => {
    expect(pulled((html) => html)).toBe(file);
  });
  it("takes a changed paragraph as Canvas has it, HTML and all", () => {
    expect(pulled(edited)).toContain("<p>First <em>paragraph</em>, edited in Canvas.</p>");
  });
  it("keeps every other block as the file wrote it: a diagram stays its source, a list its dashes", () => {
    const text = pulled(edited);
    expect([text.startsWith("# Staged rollouts\n"), text.includes("```mermaid\ngraph LR\n  A --> B\n```"), text.includes("- one\n- two"), text.includes("Last paragraph.")]).toEqual([true, true, true, true]);
  });
  it("drops the file's version of a block it replaced", () => {
    expect(pulled(edited)).not.toContain("as the file has it");
  });
  it("adds a block only Canvas has, where Canvas has it", () => {
    const text = pulled((html) => html.replace("<ul>", "<p>Added in Canvas.</p><ul>"));
    expect(text.indexOf("Added in Canvas")).toBeGreaterThan(text.indexOf("```mermaid"));
    expect(text.indexOf("Added in Canvas")).toBeLessThan(text.indexOf("- one"));
  });
  it("removes a block Canvas no longer has", () => {
    expect(pulled((html) => html.replace("<p>Last paragraph.</p>", ""))).not.toContain("Last paragraph");
  });
  it("leaves the file reading as Canvas does, whatever changed", () => {
    for (const change of [edited, (html: string) => html.replace("<p>Last paragraph.</p>", "<h2>New ending</h2><p>Two blocks.</p>"), (html: string) => `<link rel="stylesheet" href="https://example.com/theme.css">${edited(html)}<script src="https://example.com/theme.js"></script>`])
      expect(htmlIsCloseEnough(render(pulled(change)), canvas(change))).toBe(true);
  });
  it("keeps a block of the file's that shows nothing on the page (it has nothing in Canvas to differ from)", () => {
    const hidden = "```quiztext encoded-name=pq hide\nsecret\n```\n\n";
    const withHidden = hidden + file;
    expect(pullDescription(withHidden, edited(render(withHidden)), render)).toContain(hidden.trim());
  });
});
