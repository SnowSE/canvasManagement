import { describe, it, expect } from "vitest";
import { resolveCanvasPageHrefsInHtml } from "./urlUtils";

const pages = [
  { moduleName: "01 Intro", name: "Belt Tour" },
  { moduleName: "01 Intro", name: "ClassworkProfile" },
];

describe("resolveCanvasPageHrefsInHtml", () => {
  it("sends a canvas-style page link to the local page", () => {
    const html = '<a href="../pages/belt-tour">tour</a>';
    expect(resolveCanvasPageHrefsInHtml(html, "1400", pages)).toBe(
      '<a href="/course/1400/modules/01%20Intro/page/Belt%20Tour">tour</a>'
    );
  });

  it("keeps the #fragment", () => {
    const html = '<a href="../pages/belt-tour#:~:text=%C2%A74.3">tour</a>';
    expect(resolveCanvasPageHrefsInHtml(html, "1400", pages)).toBe(
      '<a href="/course/1400/modules/01%20Intro/page/Belt%20Tour#:~:text=%C2%A74.3">tour</a>'
    );
  });

  it("matches the way canvas does, ignoring case", () => {
    const html = '<a href="../pages/ClassworkProfile">profile</a>';
    expect(resolveCanvasPageHrefsInHtml(html, "1400", pages)).toContain(
      'href="/course/1400/modules/01%20Intro/page/ClassworkProfile"'
    );
  });

  it("leaves everything that isn't a link to a known page alone", () => {
    const cases = [
      '<a href="../pages/no-such-page">x</a>',
      '<a href="../assignments/belt-tour">x</a>',
      '<a href="https://example.com/pages/belt-tour">x</a>',
      '<a href="../pages/Belt%20Tour.md">x</a>',
      '<img src="../pages/belt-tour">',
    ];
    for (const html of cases) {
      expect(resolveCanvasPageHrefsInHtml(html, "1400", pages)).toBe(html);
    }
  });
});
