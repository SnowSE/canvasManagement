/**
 * Edits to a cached Canvas list, for queryClient.setQueryData: after the app
 * changes something in Canvas, it reads back that one thing and puts it in
 * the list it already has, instead of downloading the whole list again.
 * A list that was never fetched (undefined) stays that way.
 */
export const upsert =
  <T>(idOf: (item: T) => unknown, item: T) =>
  (list: T[] | undefined) =>
    list &&
    (list.some((x) => idOf(x) === idOf(item))
      ? list.map((x) => (idOf(x) === idOf(item) ? item : x))
      : [...list, item]);

/** The item's fields Canvas sent back, over what the list had: for an answer that leaves fields out (an update's answer has no overrides). */
export const merge =
  <T>(idOf: (item: T) => unknown, item: T) =>
  (list: T[] | undefined) =>
    list?.map((x) => (idOf(x) === idOf(item) ? { ...x, ...item } : x));

export const remove =
  <T>(idOf: (item: T) => unknown, id: unknown) =>
  (list: T[] | undefined) =>
    list?.filter((x) => idOf(x) !== id);

export const byId = (item: { id: number }) => item.id;
export const byPageId = (item: { page_id: number }) => item.page_id;
