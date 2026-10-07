"use client";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import {
  defaultFeedbackDelimiters,
  FeedbackDelimiters,
} from "@/features/local/quizzes/models/utils/quizFeedbackMarkdownUtils";
import {
  C,
  Example,
  HelpLinks,
  HelpPanel,
  HelpSection,
  KeyList,
  P,
  ValueList,
} from "@/components/editor/help/HelpParts";
import {
  EncodedBlocksHelp,
  ImagesHelp,
  MarkdownBasicsHelp,
  MathHelp,
  MermaidHelp,
} from "@/components/editor/help/MarkdownHelpSections";

export function QuizHelp({
  settings,
  feedbackDelimiters,
}: {
  settings: LocalCourseSettings;
  feedbackDelimiters: FeedbackDelimiters;
}) {
  const groupNames = settings.assignmentGroups.map((g) => g.name);
  const exampleGroup = groupNames[0] ?? "Quizzes";
  const { correct, incorrect, neutral } = feedbackDelimiters;
  const delimitersAreDefault =
    correct === defaultFeedbackDelimiters.correct &&
    incorrect === defaultFeedbackDelimiters.incorrect &&
    neutral === defaultFeedbackDelimiters.neutral;

  return (
    <HelpPanel>
      <HelpSection title="File layout">
        <P>
          Settings come first, then questions. Every question starts after a{" "}
          <C>---</C> line.
        </P>
        <Example>{`
UnlockAt: 08/24/2026 00:00:00
LockAt: 08/28/2026 23:59:00
DueAt: 08/27/2026 23:59:00
Password:
ShuffleAnswers: true
ShowCorrectAnswers: false
OneQuestionAtATime: false
AssignmentGroup: ${exampleGroup}
AllowedAttempts: -1
Description: Read chapter 2 first.
---
Points: 2
What is 2+3?
*a) 5
b) 6
---
Explain your answer.
essay
`}</Example>
        <P>
          Because <C>---</C> separates questions, don&apos;t use it as a
          horizontal rule inside a question.
        </P>
        <P>
          Dates are <C>MM/DD/YYYY HH:MM:SS</C> (24-hour); with the cursor on a
          date line a calendar opens. On a blank settings line, press{" "}
          <C>Ctrl+Space</C> for the settings you haven&apos;t used yet.
        </P>
      </HelpSection>

      <HelpSection title="Settings">
        <KeyList
          items={[
            { name: "UnlockAt", children: "When it opens. Blank = right away." },
            { name: "DueAt", children: "Due date and time. Required." },
            { name: "LockAt", children: "When it closes. Blank = never." },
            {
              name: "Password",
              children: "Access code students must enter. Blank = none.",
            },
            {
              name: "ShuffleAnswers",
              children: (
                <>
                  <C>true</C> or <C>false</C>. Required.
                </>
              ),
            },
            {
              name: "ShowCorrectAnswers",
              children: (
                <>
                  Show correct answers after submitting. Defaults to{" "}
                  <C>true</C>.
                </>
              ),
            },
            {
              name: "OneQuestionAtATime",
              children: (
                <>
                  <C>true</C> or <C>false</C>. Required.
                </>
              ),
            },
            {
              name: "AssignmentGroup",
              children: (
                <>
                  Grading category (note: not <C>AssignmentGroupName</C> like
                  assignments). This course has:{" "}
                  <ValueList
                    values={groupNames}
                    empty="no assignment groups yet (add them in course settings)"
                  />
                </>
              ),
            },
            {
              name: "AllowedAttempts",
              children: (
                <>
                  A number; <C>-1</C> for unlimited.
                </>
              ),
            },
            {
              name: "Description",
              children:
                "Shown above the questions. Markdown, and it can run over several lines up to the first ---.",
            },
          ]}
        />
      </HelpSection>

      <HelpSection title="Points">
        <P>
          Put <C>Points:</C> on the first line of a question. Without it the
          question is worth 1 point. Decimals are fine.
        </P>
        <Example>{`
Points: 2.5
What is the capital of France?
*a) Paris
b) Lyon
`}</Example>
      </HelpSection>

      <HelpSection title="Multiple choice">
        <P>
          Lettered answers; <C>*</C> marks the correct one.
        </P>
        <Example>{`
Which is a prime number?
a) 4
*b) 7
c) 9
`}</Example>
      </HelpSection>

      <HelpSection title="Multiple answers (checkboxes)">
        <P>
          <C>[*]</C> is a correct choice; <C>[ ]</C> or <C>[]</C> is not.
        </P>
        <Example>{`
Which are prime numbers?
[*] 2
[*] 3
[ ] 4
[] 6
`}</Example>
      </HelpSection>

      <HelpSection title="Essay">
        <P>
          End the question with a line that says <C>essay</C>.
        </P>
        <Example>{`
Points: 5
Describe a time you fixed a hard bug.
essay
`}</Example>
      </HelpSection>

      <HelpSection title="Short answer (fill in the blank)">
        <P>
          End with <C>short_answer</C> (or <C>short answer</C>) for a manually
          graded answer box.
        </P>
        <Example>{`
What does HTTP stand for?
short_answer
`}</Example>
        <P>
          To auto-grade, list every accepted response as a correct answer and
          end with <C>short_answer=</C>.
        </P>
        <Example>{`
What keyword declares a constant in JavaScript?
*a) const
*b) const keyword
short_answer=
`}</Example>
      </HelpSection>

      <HelpSection title="Numerical">
        <P>
          Answer lines starting with <C>=</C> make a numeric answer box. Use a
          single value for an exact answer or <C>[min, max]</C> for a range.
          List several lines to accept any of them.
        </P>
        <Example>{`
What is 10 / 4?
= 2.5
= [2.4, 2.6]
`}</Example>
      </HelpSection>

      <HelpSection title="Matching">
        <P>
          Each <C>^</C> line is <C>left side - right side</C>. A line with
          nothing before the <C>-</C> adds a distractor to the dropdowns.
        </P>
        <Example>{`
Match each protocol to its port.
^ HTTP - 80
^ HTTPS - 443
^ SSH - 22
^ - 21
^ - 25
`}</Example>
      </HelpSection>

      <HelpSection title="Multiple dropdowns">
        <P>
          Like matching, but blank lines split the <C>^</C> lines into groups.
          Each prompt is shown on its own line after the question text with a
          dropdown offering every answer in its group.
        </P>
        <Example>{`
Pick the right word for each sentence.
^ The sky is - blue
^ - green

^ HTTP is a - protocol
^ Python is a - language
^ - database
`}</Example>
      </HelpSection>

      <HelpSection title="Answer feedback">
        <P>
          Between the question text and the answers, start a line with{" "}
          <C>{correct}</C> for feedback on a correct answer, <C>{incorrect}</C>{" "}
          for an incorrect one, and <C>{neutral}</C> for feedback shown either
          way.
        </P>
        <Example>{`
Points: 3
What is 2+3?
${correct} Correct! Good job
${incorrect} Incorrect, try again
${neutral} This is shown regardless
*a) 5
b) 6
`}</Example>
        <P>
          For feedback over several lines, put the marker on its own line:
        </P>
        <Example>{`
What is 2+3?
${correct}
Great work!
You understand the concept.
${incorrect}
Not quite right.
Review the material and try again.
*a) 5
b) 6
`}</Example>
        <P>
          {delimitersAreDefault
            ? "These markers can be changed with feedbackDelims in globalSettings.yml."
            : "These markers come from feedbackDelims in globalSettings.yml."}
        </P>
      </HelpSection>

      <HelpSection title="Markdown and code in questions">
        <P>
          Question text, answers, and the description are all markdown. An
          answer can span several lines (everything up to the next answer
          marker belongs to it), and answer markers inside a code block are
          ignored, so code works in both questions and answers.
        </P>
        <Example>{`
What does this print?
\`\`\`python
print("a)" + "b")
\`\`\`
*a)
\`\`\`
a)b
\`\`\`
b) An error
`}</Example>
      </HelpSection>

      <MarkdownBasicsHelp />
      <ImagesHelp />
      <MathHelp />
      <MermaidHelp />
      <EncodedBlocksHelp />

      <HelpLinks
        links={[
          {
            href: "https://www.markdownguide.org/cheat-sheet/",
            label: "Markdown Cheat Sheet",
          },
          { href: "https://mermaid.live/edit", label: "Mermaid Live Editor" },
        ]}
      />
    </HelpPanel>
  );
}
