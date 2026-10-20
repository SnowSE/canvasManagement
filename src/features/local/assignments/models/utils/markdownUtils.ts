/** DateForOrdering, or its older name DueDateForOrdering. */
export const extractDateForOrdering = (input: string) =>
  extractLabelValue(input, "DateForOrdering") ||
  extractLabelValue(input, "DueDateForOrdering");

export const extractLabelValue = (input: string, label: string) => {
  // anchored to line start so "LockAt" cannot match inside "UnlockAt"
  const pattern = new RegExp(`^${label}: (.*?)\n`, "m");
  const match = pattern.exec(input);

  if (match && match.length > 1 && match[1]) {
    return match[1].trim();
  }

  return "";
};
