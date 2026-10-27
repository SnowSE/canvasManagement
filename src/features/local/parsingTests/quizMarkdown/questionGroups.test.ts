import { describe, expect, it } from "vitest";
import { quizMarkdownUtils } from "../../quizzes/models/utils/quizMarkdownUtils";
import { quizPointTotal } from "../../quizzes/models/quizPoints";

const settings = `UnlockAt: 
LockAt: 
DueAt: 08/21/2023 23:59:00
Password: 
ShuffleAnswers: true
ShowCorrectAnswers: true
OneQuestionAtATime: false
AssignmentGroup: Assignments
AllowedAttempts: -1
Description: quiz description
---
`;

const quizWithGroup = `${settings}Points: 2
Which layer does TCP live in?
*a) Transport
b) Network

---

Group: Ports
Pick: 2
Points: 1

---

What port does HTTP use?
*a) 80
b) 443

---

What port does SSH use?
*a) 22
b) 21

---

What port does DNS use?
*a) 53
b) 25

---

EndGroup

---

Points: 5
Explain the three-way handshake.
essay`;

describe("question groups", () => {
  const quiz = quizMarkdownUtils.parseMarkdown(quizWithGroup, "Networking");

  it("puts the questions between Group and EndGroup in the group", () => {
    expect(quiz.questions.map((q) => q.group?.name)).toEqual([
      undefined,
      "Ports",
      "Ports",
      "Ports",
      undefined,
    ]);
    expect(quiz.questions[1].group).toEqual({ name: "Ports", pickCount: 2 });
    expect(quiz.questions[1].text).toBe("What port does HTTP use?");
  });

  it("gives every question in the group the group's points", () => {
    expect(quiz.questions.map((q) => q.points)).toEqual([2, 1, 1, 1, 5]);
  });

  it("counts a group's points once per question a student gets", () => {
    expect(quizPointTotal(quiz.questions)).toBe(2 + 2 * 1 + 5);
  });

  it("writes the same markdown back out", () => {
    const markdown = quizMarkdownUtils.toMarkdown(quiz);
    expect(markdown).toBe(quizWithGroup);
    expect(quizMarkdownUtils.assertCanRoundTrip(quiz)).toBe(quizWithGroup);
  });

  it("ends a group at the end of the quiz or the next Group without EndGroup", () => {
    const quiz = quizMarkdownUtils.parseMarkdown(
      `${settings}Group: A
Pick: 1
---
One?
*a) yes
---
Group: B
Pick: 1
Points: 3
---
Two?
*a) yes`,
      "Two groups",
    );
    expect(quiz.questions.map((q) => [q.group?.name, q.points])).toEqual([
      ["A", 1],
      ["B", 3],
    ]);
  });

  it.each([
    [`Group: A\n---\nOne?\n*a) yes`, "Pick:"],
    [`Group: A\nPick: 3\n---\nOne?\n*a) yes\n---\nEndGroup`, "Pick: 3, but the group has 1 question"],
    [`Group: A\nPick: 1\n---\nPoints: 4\nOne?\n*a) yes`, "whose Points line sets every question's points"],
    [`Group: A\nPick: 1\nWhat?\n*a) yes`, "isn't a group setting"],
    [`Group: A\nPick: 1\n---\nOne?\n*a) yes\n---\nGroup: A\nPick: 1\n---\nTwo?\n*a) yes`, "two groups have that name"],
    [`Group:\nPick: 1\n---\nOne?\n*a) yes`, "needs a name"],
  ])("explains a mistake in a group: %s", (questions, message) => {
    expect(() =>
      quizMarkdownUtils.parseMarkdown(`${settings}${questions}`, "Broken"),
    ).toThrow(message);
  });
});
