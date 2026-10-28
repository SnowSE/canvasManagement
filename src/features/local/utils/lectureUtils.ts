import { Lecture } from "../lectures/lectureModel";
import { getDateOnlyMarkdownString } from "./timeUtils";

export function getLectureForDay(
  weeks: { weekName: string; lectures: Lecture[] }[],
  dayAsDate: Date
) {
  const date = getDateOnlyMarkdownString(dayAsDate);
  return weeks.flatMap((w) => w.lectures).find((l) => l.date == date);
}
