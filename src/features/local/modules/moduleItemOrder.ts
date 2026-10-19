import { getDateFromString } from "../utils/timeUtils";

// A module's items are listed by date: an item's DateForOrdering when it has
// one, else when it becomes available, else when it's due, else when it
// closes. (A page's DateForOrdering is read into its dueAt.)
interface Dated {
  name: string;
  dueAt: string;
  unlockAt?: string;
  lockAt?: string;
  dateForOrdering?: string;
}

const orderingTime = (item: Dated) =>
  getDateFromString(
    item.dateForOrdering || item.unlockAt || item.dueAt || item.lockAt || ""
  )?.getTime() ?? 0;

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
