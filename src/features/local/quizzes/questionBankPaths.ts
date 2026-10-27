// Question bank files live in a "banks" folder in a module, beside
// "quizzes", and a quiz names one by its path relative to the quiz file.

export const bankFolderName = "banks";

/**
 * The path a quiz in quizModule writes after Bank: for a bank file at
 * `<module>/banks/<file>` in the course folder.
 */
export function bankPathFromQuiz(quizModule: string, bankInCourse: string) {
  const [bankModule, ...rest] = bankInCourse.split("/");
  return bankModule === quizModule
    ? `../${rest.join("/")}`
    : `../../${bankInCourse}`;
}
