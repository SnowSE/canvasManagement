import { describe, it, expect } from "vitest";
import { getQuestionTextForCanvas } from "./canvasQuizService";
import { markdownToHtmlNoImages } from "@/services/htmlMarkdownUtils";
import { quizMarkdownUtils } from "@/features/local/quizzes/models/utils/quizMarkdownUtils";

// Canvas finds each dropdown by the literal text [blank_id] in the question's
// HTML, so the markdown renderer must leave those markers untouched.
describe("multiple dropdowns question html", () => {
  it("keeps every [dropdownN] marker literal after markdown rendering", () => {
    const quiz = quizMarkdownUtils.parseMarkdown(
      `
ShuffleAnswers: true
OneQuestionAtATime: false
DueAt: 08/21/2023 23:59:00
LockAt: 08/21/2023 23:59:00
AssignmentGroup: Assignments
AllowedAttempts: -1
Description:
---
Points: 2
**Painting houses.** Plan the nested function.

^ Name - min_cost_from
^ - paint_next

^ Base case, and what it returns - i == n returns 0
^ - i == 0 returns 0

^ Options - each color c ≠ prev_color, worth paint_cost[i][c] + min_cost_from(i + 1, c)
^ - each color c, worth paint_cost[i][c] + min_cost_from(i + 1, c)
`,
      "Test Quiz"
    );

    const html = markdownToHtmlNoImages(getQuestionTextForCanvas(quiz.questions[0]));

    expect(html).toContain("<strong>Painting houses.</strong>");
    expect(html).toContain("Name: [dropdown1]");
    expect(html).toContain("Base case, and what it returns: [dropdown2]");
    expect(html).toContain("Options: [dropdown3]");
    expect(html).not.toContain("<a");
  });
});
