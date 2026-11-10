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
