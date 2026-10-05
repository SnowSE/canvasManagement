import { LocalQuizQuestion, QuestionType } from "../localQuizQuestion";
import { LocalQuizQuestionAnswer } from "../localQuizQuestionAnswer";
const _validFirstAnswerDelimiters = [
  "*a)",
  "a)",
  "*)",
  ")",
  "[ ]",
  "[]",
  "[*]",
  "^",
  "=",
];
const _multipleChoicePrefix = ["a)", "*a)", "*)", ")"];
const _multipleAnswerPrefix = ["[ ]", "[*]", "[]"];

const parseNumericalAnswer = (input: string): LocalQuizQuestionAnswer => {
  const trimmedInput = input.replace(/^=\s*/, "").trim();

  // Check if it's a range answer: = [min, max]
  const minMaxPattern = /^\[([^,]+),\s*([^\]]+)\]$/;
  const rangeNumbericAnswerMatch = trimmedInput.match(minMaxPattern);

  if (rangeNumbericAnswerMatch) {
    const minValue = parseFloat(rangeNumbericAnswerMatch[1].trim());
    const maxValue = parseFloat(rangeNumbericAnswerMatch[2].trim());
    const answer: LocalQuizQuestionAnswer = {
      correct: true,
      text: input.trim(),
      numericalAnswerType: "range_answer",
      numericAnswerRangeMin: minValue,
      numericAnswerRangeMax: maxValue,
    };
    return answer;
  }

  // Otherwise, it's an exact answer
  const numericValue = parseFloat(trimmedInput);
  const answer: LocalQuizQuestionAnswer = {
    correct: true,
    text: input.trim(),
    numericalAnswerType: "exact_answer",
    numericAnswer: numericValue,
  };
  return answer;
};

const parseMatchingAnswer = (input: string) => {
  const matchingPattern = /^\^?/;
  const textWithoutMatchDelimiter = input.replace(matchingPattern, "");
  const [text, ...matchedParts] = textWithoutMatchDelimiter.split(" - ");
  const answer: LocalQuizQuestionAnswer = {
    correct: true,
    text: text.trim(),
    matchedText: matchedParts.join("-").trim(),
  };
  return answer;
};

const getAnswerStringsWithMultilineSupport = (
  linesWithoutPoints: string[],
  questionIndex: number,
) => {
  const indexOfAnswerStart = (() => {
    let inFence = false;
    for (let i = 0; i < linesWithoutPoints.length; i++) {
      const l = linesWithoutPoints[i];
      const trimmedLine = l.trimStart();

      // Skip fence toggling inside code blocks
      if (trimmedLine.startsWith("```")) {
        inFence = !inFence;
        continue;
      }

      // Don't match answer delimiters inside code blocks
      if (
        !inFence &&
        _validFirstAnswerDelimiters.some((prefix) =>
          trimmedLine.startsWith(prefix),
        )
      ) {
        return i;
      }
    }
    return -1;
  })();
  if (indexOfAnswerStart === -1) {
    const debugLine = linesWithoutPoints.find((l) => l.trim().length > 0);
    throw Error(
      `question ${
        questionIndex + 1
      }: no answers when detecting question type on ${debugLine}`,
    );
  }

  const answerLinesRaw = linesWithoutPoints.slice(indexOfAnswerStart);

  const answerStartPattern = /^(\*?[a-z]?\)|\[\s*\]|\[\*\]|\^|=)/;
  const { answerLines } = answerLinesRaw.reduce(
    (acc, line: string) => {
      const trimmedLine = line.trimStart();
      const isFenceLine = trimmedLine.startsWith("```");
      const isNewAnswer = !acc.inFence && answerStartPattern.test(trimmedLine);

      const answerLines = [...acc.answerLines];
      if (isNewAnswer) {
        answerLines.push(line);
      } else if (answerLines.length !== 0) {
        answerLines[answerLines.length - 1] += "\n" + line;
      } else {
        answerLines.push(line);
      }

      return {
        answerLines,
        inFence: isFenceLine ? !acc.inFence : acc.inFence,
      };
    },
    { answerLines: [] as string[], inFence: false },
  );
  return answerLines;
};

// A blank (or whitespace-only) line between "^" lines starts a new dropdown
// group. getAnswerStringsWithMultilineSupport attaches blank lines to the
// answer before them, so a group ends at any answer carrying one.
const splitIntoDropdownGroups = (answerLines: string[]): string[][] =>
  answerLines
    .reduce(
      (groups, line) => {
        groups[groups.length - 1].push(line);
        const endsGroup = line
          .split("\n")
          .slice(1)
          .some((l) => l.trim() === "");
        if (endsGroup) groups.push([]);
        return groups;
      },
      [[]] as string[][],
    )
    .filter((group) => group.length > 0);

const parseDropdownAnswers = (
  answerLines: string[],
  questionIndex: number,
): LocalQuizQuestionAnswer[] =>
  splitIntoDropdownGroups(answerLines).flatMap((group, dropdownGroup) => {
    const parsed = group.map(parseMatchingAnswer);
    if (!parsed.some((a) => a.text))
      throw Error(
        `question ${questionIndex + 1}: dropdown group ${
          dropdownGroup + 1
        } has no prompt; every group needs a line like "^ prompt - correct answer"`,
      );
    return parsed.map((a) => {
      if (a.text && !a.matchedText)
        throw Error(
          `question ${questionIndex + 1}: dropdown prompt "${a.text.replace(
            /\s*-$/,
            "",
          )}" has no correct answer`,
        );
      return {
        correct: a.text !== "",
        text: a.text,
        matchedText: a.matchedText,
        dropdownGroup,
      };
    });
  });

export const quizQuestionAnswerMarkdownUtils = {
  parseMarkdown(
    input: string,
    questionType: QuestionType,
  ): LocalQuizQuestionAnswer {
    if (questionType === QuestionType.NUMERICAL) {
      return parseNumericalAnswer(input);
    }

    // every listed answer on a short_answer= question is an accepted response
    if (
      questionType === QuestionType.SHORT_ANSWER_WITH_ANSWERS &&
      input.trimStart().startsWith("=")
    ) {
      return {
        correct: true,
        text: input.trimStart().replace(/^=\s*/, "").trim(),
      };
    }

    const isCorrect = input.startsWith("*") || input[1] === "*";
    if (
      questionType === QuestionType.MATCHING ||
      questionType === QuestionType.MULTIPLE_DROPDOWNS
    ) {
      return parseMatchingAnswer(input);
    }

    const startingQuestionPattern = /^(\*?[a-z]?\)|\[\s*\]|\[\*\]|\^ )/;

    let replaceCount = 0;
    const text = input
      .replace(startingQuestionPattern, (m) => (replaceCount++ === 0 ? "" : m))
      .trim();

    const answer: LocalQuizQuestionAnswer = {
      correct: isCorrect,
      text: text,
    };
    return answer;
  },
  isAnswerLine: (trimmedLine: string): boolean => {
    return _validFirstAnswerDelimiters.some((prefix) =>
      trimmedLine.trimStart().startsWith(prefix),
    );
  },
  getQuestionType: (
    linesWithoutPoints: string[],
    questionIndex: number, // needed for debug logging
  ): QuestionType => {
    const lastLine = linesWithoutPoints[linesWithoutPoints.length - 1]
      .toLowerCase()
      .trim();
    if (linesWithoutPoints.length === 0) return QuestionType.NONE;
    if (lastLine === "essay") return QuestionType.ESSAY;
    if (lastLine === "short answer") return QuestionType.SHORT_ANSWER;
    if (lastLine === "short_answer") return QuestionType.SHORT_ANSWER;
    if (lastLine === "short_answer=")
      return QuestionType.SHORT_ANSWER_WITH_ANSWERS;
    if (lastLine.startsWith("=")) return QuestionType.NUMERICAL;

    const answerLines = getAnswerStringsWithMultilineSupport(
      linesWithoutPoints,
      questionIndex,
    );
    const firstAnswerLine = answerLines[0];
    const isMultipleChoice = _multipleChoicePrefix.some((prefix) =>
      firstAnswerLine.startsWith(prefix),
    );

    if (isMultipleChoice) return QuestionType.MULTIPLE_CHOICE;

    const isMultipleAnswer = _multipleAnswerPrefix.some((prefix) =>
      firstAnswerLine.startsWith(prefix),
    );
    if (isMultipleAnswer) return QuestionType.MULTIPLE_ANSWERS;

    // "^" lines in one block are matching; blank-line-separated blocks of them
    // are multiple dropdowns, one dropdown per prompt
    const isMatching = firstAnswerLine.startsWith("^");
    if (isMatching)
      return splitIntoDropdownGroups(answerLines).length > 1
        ? QuestionType.MULTIPLE_DROPDOWNS
        : QuestionType.MATCHING;

    return QuestionType.NONE;
  },
  getAnswers: (
    linesWithoutPoints: string[],
    questionIndex: number,
    questionType: QuestionType,
  ): { answers: LocalQuizQuestionAnswer[]; distractors: string[] } => {
    const typesWithAnswers: QuestionType[] = [
      QuestionType.MULTIPLE_CHOICE,
      QuestionType.MULTIPLE_ANSWERS,
      QuestionType.MATCHING,
      QuestionType.MULTIPLE_DROPDOWNS,
      QuestionType.SHORT_ANSWER_WITH_ANSWERS,
      QuestionType.NUMERICAL,
    ];
    if (!typesWithAnswers.includes(questionType)) {
      return { answers: [], distractors: [] };
    }

    if (questionType == QuestionType.SHORT_ANSWER_WITH_ANSWERS)
      linesWithoutPoints = linesWithoutPoints.slice(
        0,
        linesWithoutPoints.length - 1,
      );

    const answerLines = getAnswerStringsWithMultilineSupport(
      linesWithoutPoints,
      questionIndex,
    );

    if (questionType === QuestionType.MULTIPLE_DROPDOWNS)
      return {
        answers: parseDropdownAnswers(answerLines, questionIndex),
        distractors: [],
      };

    const allAnswers = answerLines.map((a) =>
      quizQuestionAnswerMarkdownUtils.parseMarkdown(a, questionType),
    );

    // For matching questions, separate answers from distractors
    if (questionType === QuestionType.MATCHING) {
      const answers = allAnswers.filter((a) => a.text);
      const distractors = allAnswers
        .filter((a) => !a.text)
        .map((a) => a.matchedText ?? "");
      return { answers, distractors };
    }

    return { answers: allAnswers, distractors: [] };
  },

  getAnswerMarkdown: (
    question: LocalQuizQuestion,
    answer: LocalQuizQuestionAnswer,
    index: number,
  ): string => {
    const multilineMarkdownCompatibleText = answer.text.startsWith("```")
      ? "\n" + answer.text
      : answer.text;

    if (question.questionType === "multiple_answers") {
      const correctIndicator = answer.correct ? "*" : " ";
      const questionTypeIndicator = `[${correctIndicator}] `;

      return `${questionTypeIndicator}${multilineMarkdownCompatibleText}`;
    } else if (question.questionType === "matching") {
      return `^ ${answer.text} - ${answer.matchedText}`;
    } else if (question.questionType === "multiple_dropdowns") {
      return answer.text
        ? `^ ${answer.text} - ${answer.matchedText}`
        : `^ - ${answer.matchedText}`;
    } else if (question.questionType === "numerical") {
      if (answer.numericalAnswerType === "range_answer") {
        return `= [${answer.numericAnswerRangeMin}, ${answer.numericAnswerRangeMax}]`;
      }
      return `= ${answer.numericAnswer}`;
    } else {
      const questionLetter = String.fromCharCode(97 + index);
      const correctIndicator = answer.correct ? "*" : "";
      const questionTypeIndicator = `${correctIndicator}${questionLetter}) `;

      return `${questionTypeIndicator}${multilineMarkdownCompatibleText}`;
    }
  },
};
