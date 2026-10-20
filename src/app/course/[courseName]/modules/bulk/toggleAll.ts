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
