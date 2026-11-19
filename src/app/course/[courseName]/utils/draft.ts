import { useDeferredValue, useMemo } from "react";

/**
 * The editor's text a render behind, so typing stays smooth, and only while
 * it is still the item `key`'s: on the way to another item the deferred text
 * is the previous item's for a render, and comparing it with the new item's
 * Canvas copy showed a flash of differences; now nothing, and the saved item
 * stands in.
 */
export function useSettledText(text: string, key: string): string | undefined {
  const current = useMemo(() => ({ text, key }), [text, key]);
  const settled = useDeferredValue(current);
  return settled.key === key ? settled.text : undefined;
}

/**
 * The item an editor's text describes, for comparing with Canvas as it is
 * typed, ahead of the save; nothing while the text doesn't parse (the editor
 * shows the parse error, and the saved item stands in).
 */
export const parsedOrNothing = <T>(parse: () => T): T | undefined => {
  try {
    return parse();
  } catch {
    return undefined;
  }
};
