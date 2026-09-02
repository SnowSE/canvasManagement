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
