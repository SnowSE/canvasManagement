import { getDateFromString } from "../utils/timeUtils";

// A module's items are listed by date: an item's available date when it has
// one, else its due date (a page's due date is its DueDateForOrdering).
interface Dated {
  name: string;
  dueAt: string;
  unlockAt?: string;
}

const orderingTime = (item: Dated) =>
  getDateFromString(item.unlockAt || item.dueAt)?.getTime() ?? 0;

export const byOrderingDate = (a: Dated, b: Dated) => orderingTime(a) - orderingTime(b);

/**
 * Whether Canvas lists a module's items (`canvasTitles`, in Canvas's order)
 * out of date order. Items with the same date can be in either order, and
 * Canvas items the module's files don't have are ignored.
 */
export function canvasOrderDiffers(items: Dated[], canvasTitles: string[]) {
  const times = canvasTitles.flatMap((title) => {
    const item = items.find((i) => i.name === title);
    return item ? [orderingTime(item)] : [];
  });
  return times.some((time, i) => i > 0 && time < times[i - 1]);
}
