import {
  verifyDateOrThrow,
  verifyDateStringOrUndefined,
} from "@/features/local/utils/timeUtils";
import { LocalQuiz } from "../localQuiz";
import { LocalQuizQuestion, QuestionGroup } from "../localQuizQuestion";
import { quizQuestionMarkdownUtils } from "./quizQuestionMarkdownUtils";
import { FeedbackDelimiters } from "./quizFeedbackMarkdownUtils";
import { extractDateForOrdering } from "@/features/local/assignments/models/utils/markdownUtils";

const extractLabelValue = (input: string, label: string): string => {
  // anchored to line start so "LockAt" cannot match inside "UnlockAt"
  const pattern = new RegExp(`^${label}: (.*?)\n`, "m");
  const match = pattern.exec(input);
  return match ? match[1].trim() : "";
};

const extractDescription = (input: string): string => {
  const pattern = new RegExp("Description: (.*?)$", "s");
  const match = pattern.exec(input);
  return match ? match[1].trim() : "";
};

const parseBooleanOrThrow = (value: string, label: string): boolean => {
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  throw new Error(`Error with ${label}: ${value}`);
};

const parseBooleanOrDefault = (
  value: string,
  label: string,
  defaultValue: boolean
): boolean => {
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return defaultValue;
};

const parseNumberOrThrow = (value: string, label: string): number => {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Error with ${label}: ${value}`);
  }
  return parsed;
};
// minutes; a blank or missing TimeLimit line means no limit
const parseTimeLimit = (value: string): number | undefined => {
  if (value === "") return undefined;
  if (!/^\d+$/.test(value) || parseInt(value, 10) === 0)
    throw new Error(
      `Error with TimeLimit: ${value} (minutes, a whole number like 5; leave the line out for no limit)`
    );
  return parseInt(value, 10);
};

const getQuizWithOnlySettings = (settings: string, name: string): LocalQuiz => {
  const rawShuffleAnswers = extractLabelValue(settings, "ShuffleAnswers");
  const shuffleAnswers = parseBooleanOrThrow(
    rawShuffleAnswers,
    "ShuffleAnswers"
  );

  const password = extractLabelValue(settings, "Password") || undefined;

  const rawShowCorrectAnswers = extractLabelValue(
    settings,
    "ShowCorrectAnswers"
  );
  const showCorrectAnswers = parseBooleanOrDefault(
    rawShowCorrectAnswers,
    "ShowCorrectAnswers",
    true
  );

  const rawOneQuestionAtATime = extractLabelValue(
    settings,
    "OneQuestionAtATime"
  );
  const oneQuestionAtATime = parseBooleanOrThrow(
    rawOneQuestionAtATime,
    "OneQuestionAtATime"
  );

  const rawAllowedAttempts = extractLabelValue(settings, "AllowedAttempts");
  const allowedAttempts = parseNumberOrThrow(
    rawAllowedAttempts,
    "AllowedAttempts"
  );

  const timeLimit = parseTimeLimit(extractLabelValue(settings, "TimeLimit"));

  const rawDueAt = extractLabelValue(settings, "DueAt");
  const dueAt = verifyDateOrThrow(rawDueAt, "DueAt");

  const rawLockAt = extractLabelValue(settings, "LockAt");
  const lockAt = verifyDateStringOrUndefined(rawLockAt);

  const rawUnlockAt = extractLabelValue(settings, "UnlockAt");
  const unlockAt = verifyDateStringOrUndefined(rawUnlockAt);

  const dateForOrdering = verifyDateStringOrUndefined(
    extractDateForOrdering(settings)
  );

  const description = extractDescription(settings);
  const localAssignmentGroupName = extractLabelValue(
    settings,
    "AssignmentGroup"
  );

  const quiz: LocalQuiz = {
    name,
    description,
    password,
    unlockAt,
    lockAt,
    dueAt,
    ...(dateForOrdering && { dateForOrdering }),
    shuffleAnswers,
    showCorrectAnswers,
    oneQuestionAtATime,
    localAssignmentGroupName,
    allowedAttempts,
    ...(timeLimit !== undefined && { timeLimit }),
    questions: [],
  };
  return quiz;
};


// A question group is a "Group:" section (with its Pick and Points lines),
// the group's questions, then an "EndGroup" section.
const groupHeaderPattern = /^group:/i;
const endGroupPattern = /^end ?group$/i;

const parseGroupHeader = (section: string) => {
  const lines = section.trim().split("\n");
  const value = (label: string) =>
    lines
      .find((line) => line.toLowerCase().startsWith(label.toLowerCase() + ":"))
      ?.slice(label.length + 1)
      .trim();
  const name = value("Group") ?? "";
  if (!name) throw new Error("Error with Group: a group needs a name, like Group: Ports");
  const unknown = lines.find((line) => !/^(group|pick|points):/i.test(line.trim()));
  if (unknown)
    throw new Error(
      `Error with Group: ${name}: "${unknown.trim()}" isn't a group setting (Group, Pick, Points); start the group's first question in a new --- section`
    );
  const rawPick = value("Pick") ?? "";
  if (!/^\d+$/.test(rawPick) || parseInt(rawPick, 10) === 0)
    throw new Error(
      `Error with Group: ${name}: Pick: ${rawPick} (how many of its questions each student gets, a whole number like 2)`
    );
  const rawPoints = value("Points") ?? "1";
  const points = parseFloat(rawPoints);
  if (isNaN(points))
    throw new Error(`Error with Group: ${name}: Points: ${rawPoints} (points for each question)`);
  return {
    group: { name, pickCount: parseInt(rawPick, 10) } as QuestionGroup,
    points,
  };
};

const groupQuestions = (questions: LocalQuizQuestion[]) =>
  questions.reduce(
    (groups, question) => {
      const last = groups[groups.length - 1];
      if (question.group && last?.group?.name === question.group.name)
        last.questions.push(question);
      else groups.push({ group: question.group, questions: [question] });
      return groups;
    },
    [] as { group?: QuestionGroup; questions: LocalQuizQuestion[] }[]
  );

export const quizMarkdownUtils = {
  toMarkdown(quiz: LocalQuiz, delimiters?: FeedbackDelimiters): string {
    if (!quiz) {
      throw Error(`quiz was undefined, cannot parse markdown`);
    }
    if (
      typeof quiz.questions === "undefined" ||
      typeof quiz.oneQuestionAtATime === "undefined"
    ) {
      console.log("quiz is probably not a quiz", quiz);
      throw Error(`quiz ${quiz.name} is probably not a quiz`);
    }
    const questionMarkdownArray = groupQuestions(quiz.questions).flatMap(
      ({ group, questions }) => {
        const markdown = questions.map((q) =>
          quizQuestionMarkdownUtils.toMarkdown(q, delimiters)
        );
        if (!group) return markdown;
        // a grouped question's points are the group's
        const withoutPoints = markdown.map((m) => m.replace(/^Points: .*\n/, ""));
        return [
          `Group: ${group.name}\nPick: ${group.pickCount}\nPoints: ${questions[0].points}`,
          ...withoutPoints,
          "EndGroup",
        ];
      }
    );
    const questionDelimiter = "\n\n---\n\n";
    const questionMarkdown = questionMarkdownArray.join(questionDelimiter);

    return `UnlockAt: ${quiz.unlockAt ?? ""}
LockAt: ${quiz.lockAt ?? ""}
DueAt: ${quiz.dueAt}
${quiz.dateForOrdering ? `DateForOrdering: ${quiz.dateForOrdering}\n` : ""}Password: ${quiz.password ?? ""}
ShuffleAnswers: ${quiz.shuffleAnswers.toString().toLowerCase()}
ShowCorrectAnswers: ${quiz.showCorrectAnswers.toString().toLowerCase()}
OneQuestionAtATime: ${quiz.oneQuestionAtATime.toString().toLowerCase()}
AssignmentGroup: ${quiz.localAssignmentGroupName}
AllowedAttempts: ${quiz.allowedAttempts}
${quiz.timeLimit ? `TimeLimit: ${quiz.timeLimit}\n` : ""}Description: ${quiz.description}
---
${questionMarkdown}`;
  },

  assertCanRoundTrip(
    quiz: LocalQuiz,
    delimiters?: FeedbackDelimiters
  ): string {
    const markdown = quizMarkdownUtils.toMarkdown(quiz, delimiters);
    const reparsedQuiz = quizMarkdownUtils.parseMarkdown(
      markdown,
      quiz.name,
      delimiters
    );
    const reparsedMarkdown = quizMarkdownUtils.toMarkdown(
      reparsedQuiz,
      delimiters
    );

    if (markdown !== reparsedMarkdown) {
      throw new Error(
        "Quiz markdown could not be parsed safely. Fix the quiz formatting before saving."
      );
    }

    return markdown;
  },

  parseMarkdown(
    input: string,
    name: string,
    delimiters?: FeedbackDelimiters
  ): LocalQuiz {
    const splitInput = input.split("---\n");
    const settings = splitInput[0];
    const quizWithoutQuestions = getQuizWithOnlySettings(settings, name);

    const rawQuestions = splitInput
      .slice(1)
      .filter((str) => str.trim().length > 0);
    const questions: LocalQuizQuestion[] = [];
    const groupNames = new Set<string>();
    let current: { group: QuestionGroup; points: number; size: number } | undefined;
    const endGroup = () => {
      if (current && current.size < current.group.pickCount)
        throw new Error(
          `Error with Group: ${current.group.name}: Pick: ${current.group.pickCount}, but the group has ${current.size} question${current.size === 1 ? "" : "s"}`
        );
      current = undefined;
    };
    for (const section of rawQuestions) {
      const firstLine = section.trim().split("\n")[0].trim();
      if (endGroupPattern.test(section.trim())) {
        endGroup();
        continue;
      }
      if (groupHeaderPattern.test(firstLine)) {
        endGroup();
        const { group, points } = parseGroupHeader(section);
        if (groupNames.has(group.name))
          throw new Error(`Error with Group: ${group.name}: two groups have that name`);
        groupNames.add(group.name);
        current = { group, points, size: 0 };
        continue;
      }
      const question = quizQuestionMarkdownUtils.parseMarkdown(
        section,
        questions.length,
        delimiters
      );
      if (current) {
        if (/^points:/i.test(firstLine))
          throw new Error(
            `Error with question ${questions.length + 1}: it is in Group: ${current.group.name}, whose Points line sets every question's points`
          );
        current.size++;
        questions.push({ ...question, points: current.points, group: current.group });
      } else questions.push(question);
    }
    endGroup();

    return {
      ...quizWithoutQuestions,
      questions,
    };
  },
};
