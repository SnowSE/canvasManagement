import { describe, it, expect } from "vitest";
import { absoluteCourseLinks, fillEmbed, renameEmbed } from "./frontPageEmbed";

describe("fillEmbed", () => {
  it("replaces only what is inside the page's marker", () => {
    const home =
      '<div id="banner"><h2>Welcome</h2></div>\n' +
      '<div id="embed-course-schedule"><p>old</p></div>\n' +
      "<p>&nbsp;</p>";

    expect(fillEmbed(home, "course-schedule", "<p>new</p>")).toBe(
      '<div id="banner"><h2>Welcome</h2></div>\n' +
        '<div id="embed-course-schedule"><p>new</p></div>\n' +
        "<p>&nbsp;</p>",
    );
  });

  it("finds the marker's own closing tag past nested divs", () => {
    const home =
      '<div class="wrap"><div class="x" id="embed-a">' +
      "<div><div>old</div></div>" +
      "</div><div>after</div></div>";

    expect(fillEmbed(home, "a", "<div>new</div>")).toBe(
      '<div class="wrap"><div class="x" id="embed-a">' +
        "<div>new</div>" +
        "</div><div>after</div></div>",
    );
  });

  it("fills a marker inside a collapsed details", () => {
    const home =
      "<details><summary>Schedule</summary>" +
      '<div id="embed-a"></div></details>';

    expect(fillEmbed(home, "a", "<p>x</p>")).toBe(
      "<details><summary>Schedule</summary>" +
        '<div id="embed-a"><p>x</p></div></details>',
    );
  });

  it("leaves a page without its marker alone", () => {
    const home = '<div id="embed-course-schedule-old"></div>';

    expect(fillEmbed(home, "course-schedule", "<p>x</p>")).toBeUndefined();
  });
});

describe("renameEmbed", () => {
  it("points the marker at the page's new address and keeps its content", () => {
    const home =
      '<p>Hi</p><div class="x" id="embed-old-schedule"><p>kept</p></div>';

    expect(renameEmbed(home, "old-schedule", "new-schedule")).toBe(
      '<p>Hi</p><div class="x" id="embed-new-schedule"><p>kept</p></div>',
    );
  });

  it("leaves a marker for a longer address alone", () => {
    const home = '<div id="embed-old-schedule-2"></div>';

    expect(renameEmbed(home, "old-schedule", "new-schedule")).toBeUndefined();
  });
});

describe("absoluteCourseLinks", () => {
  it("points a course-relative link at the course, so it works where Canvas shows the front page (the course root)", () => {
    expect(absoluteCourseLinks('<a href="../pages/belt-tour#:~:text=%C2%A71.1">Tour</a>', 1245955)).toBe('<a href="/courses/1245955/pages/belt-tour#:~:text=%C2%A71.1">Tour</a>');
  });
  it("leaves every other link alone", () => {
    const html = '<a href="https://example.com/pages/x">x</a> <a href="#top">top</a>';
    expect(absoluteCourseLinks(html, 1245955)).toBe(html);
  });
});
