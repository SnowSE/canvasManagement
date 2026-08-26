import { describe, it, expect } from "vitest";
import { resolveRelativeMdHrefsInHtml } from "./urlUtils";
import { markdownToHtmlNoImages } from "./htmlMarkdownUtils";

describe("resolveRelativeMdHrefsInHtml", () => {
  it("rewrites a relative page link to the in-app module item route", () => {
    const html =
      '<a href="../../01%20Chaos%20KV/pages/KV%20Wire%20Protocol%20Spec.md">spec</a>';
    const result = resolveRelativeMdHrefsInHtml(html, "distributed");
    expect(result).toBe(
      '<a href="/course/distributed/modules/01%20Chaos%20KV/page/KV%20Wire%20Protocol%20Spec">spec</a>'
    );
  });

  it("rewrites assignment and quiz links", () => {
    const assignments = resolveRelativeMdHrefsInHtml(
      '<a href="../../01%20Chaos%20KV/assignments/W01%20Single-Node%20KV%20Store.md">hw</a>',
      "distributed"
    );
    expect(assignments).toContain(
      'href="/course/distributed/modules/01%20Chaos%20KV/assignment/W01%20Single-Node%20KV%20Store"'
    );
    const quizzes = resolveRelativeMdHrefsInHtml(
      '<a href="../../01%20Chaos%20KV/quizzes/W03%20Reading%20Quiz.md">quiz</a>',
      "distributed"
    );
    expect(quizzes).toContain("/quiz/W03%20Reading%20Quiz");
  });

  it("leaves absolute urls, root-relative urls, and non-md links alone", () => {
    const cases = [
      '<a href="https://example.com/pages/thing.md">x</a>',
      '<a href="/course/foo/modules/bar/page/baz">x</a>',
      '<a href="../../01%20Chaos%20KV/pages/notes.txt">x</a>',
      '<a href="mailto:someone@example.com">x</a>',
    ];
    for (const html of cases) {
      expect(resolveRelativeMdHrefsInHtml(html, "distributed")).toBe(html);
    }
  });

  it("leaves relative md links it cannot map (unknown folder, too few segments) alone", () => {
    const unknownFolder = '<a href="../../01%20Chaos%20KV/notes/readme.md">x</a>';
    expect(resolveRelativeMdHrefsInHtml(unknownFolder, "d")).toBe(
      unknownFolder
    );
    const tooShort = '<a href="readme.md">x</a>';
    expect(resolveRelativeMdHrefsInHtml(tooShort, "d")).toBe(tooShort);
    const noModuleSegment = '<a href="../quizzes/W03%20Reading%20Quiz.md">x</a>';
    expect(resolveRelativeMdHrefsInHtml(noModuleSegment, "d")).toBe(
      noModuleSegment
    );
  });

  it("works end to end on rendered markdown", () => {
    const markdown =
      "Walk the [KV Wire Protocol Spec](../../01%20Chaos%20KV/pages/KV%20Wire%20Protocol%20Spec.md) on the projector";
    const html = resolveRelativeMdHrefsInHtml(
      markdownToHtmlNoImages(markdown),
      "distributed"
    );
    expect(html).toContain(
      'href="/course/distributed/modules/01%20Chaos%20KV/page/KV%20Wire%20Protocol%20Spec"'
    );
  });
});
