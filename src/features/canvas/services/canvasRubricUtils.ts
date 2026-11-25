import { RubricItem } from "@/features/local/assignments/models/rubricItem";

/** The ratings a rubric row has in Canvas: its own, or the two the app sends for a row without any. */
export const rubricRatings = (rubricItem: RubricItem): { description: string; points: number }[] =>
  rubricItem.ratings && rubricItem.ratings.length > 0
    ? rubricItem.ratings.map(({ description, points }) => ({ description, points }))
    : [
        { description: "Full Marks", points: rubricItem.points },
        { description: "No Marks", points: 0 },
      ];

export const getRubricCriterion = (rubric: RubricItem[]) => {
  const criterion = rubric
    .map((rubricItem) => {
      const ratings = rubricRatings(rubricItem).reduce(
        (acc, rating, i) => ({ ...acc, [i]: rating }),
        {} as { [key: number]: { description: string; points: number } }
      );

      return {
        description: rubricItem.label,
        points: rubricItem.points,
        ratings,
      };
    })
    .reduce(
      (acc, item, index) => ({ ...acc, [index]: item }),
      {} as {
        [key: number]: {
          description: string;
          points: number;
          ratings: { [key: number]: { description: string; points: number } };
        };
      }
    );

  return criterion;
};
