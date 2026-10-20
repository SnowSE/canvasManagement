// The module list's bulk rules: which items its filters show, toggling a
// whole set of checkboxes, and running an action on each item in turn.

export type Kind = "notInCanvas" | "needsSync" | "unpublished";
/** The module list's filters, in the order the bar shows them. */
export const kinds: { kind: Kind; label: string }[] = [
  { kind: "notInCanvas", label: "Not In Canvas" },
  { kind: "needsSync", label: "Needs Sync" },
  { kind: "unpublished", label: "Unpublished" },
];

/** The filters an item matches, from how it stands against Canvas. */
export const kindsOf = (s: {
  status: "localOnly" | "incomplete" | "published";
  differences: unknown[];
  unpublished?: boolean;
}): Kind[] => [
  ...(s.status === "localOnly" ? ["notInCanvas" as const] : []),
  ...(s.differences.length > 0 ? ["needsSync" as const] : []),
  ...(s.unpublished ? ["unpublished" as const] : []),
];

/** With no filter on everything shows; otherwise what matches any that's on. */
export const shown = (itemKinds: Kind[], filters: Kind[]) =>
  filters.length === 0 || itemKinds.some((k) => filters.includes(k));

/**
 * "Select all …": checks the rest of `these`, or, when all of them are
 * already checked, unchecks exactly them. Both are keyed the same way.
 */
export function toggleAll<T>(selected: Record<string, T>, these: Record<string, T>) {
  const keys = Object.keys(these);
  if (keys.length > 0 && keys.every((k) => k in selected))
    return Object.fromEntries(Object.entries(selected).filter(([k]) => !(k in these)));
  return { ...selected, ...these };
}

/**
 * Updates the items one at a time (Canvas requests are queued anyway), going
 * on past any that fail. Returns the ones that failed.
 */
export async function updateEach<T>(
  items: T[],
  update: (item: T) => Promise<unknown>,
  onProgress: (done: number) => void,
) {
  const failed: T[] = [];
  for (const [i, item] of items.entries()) {
    await update(item).catch(() => failed.push(item));
    onProgress(i + 1);
  }
  return failed;
}
