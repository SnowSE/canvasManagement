import { describe, it, expect } from "vitest";
import { fillEmbed } from "./frontPageEmbed";

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
