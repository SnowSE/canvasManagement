import { LocalCoursePage, localPageMarkdownUtils } from "@/features/local/pages/localCoursePageModels";
import { describe, it, expect } from "vitest";

describe("PageMarkdownTests", () => {
  it("can parse page", () => {
    const name = "test title"
    const page: LocalCoursePage = {
      name,
      text: "test text content",
      dueAt: "07/09/2024 23:59:00",
    };

    const pageMarkdownString = localPageMarkdownUtils.toMarkdown(page);

    const parsedPage = localPageMarkdownUtils.parseMarkdown(pageMarkdownString, name);

    expect(parsedPage).toEqual(page);
  });

  it("round-trips AddToHome, true or false, and leaves it out when unset", () => {
    const page: LocalCoursePage = {
      name: "Schedule",
      text: "the schedule",
      dueAt: "07/09/2024 23:59:00",
    };

    for (const addToHome of [true, false]) {
      const markdown = localPageMarkdownUtils.toMarkdown({ ...page, addToHome });
      expect(markdown).toContain(`AddToHome: ${addToHome}\n---\n`);
      expect(localPageMarkdownUtils.parseMarkdown(markdown, "Schedule")).toEqual({
        ...page,
        addToHome,
      });
    }
    expect(localPageMarkdownUtils.toMarkdown(page)).not.toContain("AddToHome");
  });

  it("keeps body content after a later '---' line (e.g. a v2-syntax quiz's question separators)", () => {
    const name = "test title";
    const page: LocalCoursePage = {
      name,
      text: `### Practice Quiz

\`\`\`quiztext encoded-name=dayquiz hide
Description: Review
---
Question one?

*a) right
b) wrong
---
Question two?

*a) right
b) wrong
\`\`\``,
      dueAt: "07/09/2024 23:59:00",
    };

    const pageMarkdownString = localPageMarkdownUtils.toMarkdown(page);
    const parsedPage = localPageMarkdownUtils.parseMarkdown(pageMarkdownString, name);

    expect(parsedPage).toEqual(page);
  });
});
