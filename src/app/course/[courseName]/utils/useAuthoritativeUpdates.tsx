"use client";
import { useState, useMemo, useCallback } from "react";

/**
 * Which copy of an item's text the editor should trust: what the user has
 * typed here, or what the server last sent (`startingText`).
 *
 * The server's text has changed when it is one this editor has never loaded,
 * adopted or saved. A refetch that brings back a text this editor saved (the
 * echo of its own save, or a late read from before a newer save) is not a
 * change, however long after the last keystroke it lands, so it never replaces
 * what is being typed. A text from outside (another window, another program,
 * git) is, and then the server wins.
 */
export function useAuthoritativeUpdates({
  itemKey,
  startingText,
}: {
  /**
   * Identifies which item is currently open in the editor. Navigation (next,
   * previous, browser back, or picking another item) changes this without
   * remounting the editor, so the hook uses it to know when the text it is
   * holding no longer belongs to the item on screen.
   */
  itemKey: string;
  /** The item's text as the server has it, in the editor's own normalized form. */
  startingText: string;
}) {
  const [text, setText] = useState(startingText);
  // the server texts this editor has loaded, adopted or saved, newest first
  const [known, setKnown] = useState([startingText]);
  const [updateMonacoKey, setUpdateMonacoKey] = useState(1);
  const [openItemKey, setOpenItemKey] = useState(itemKey);
  const [clientHasEdited, setClientHasEdited] = useState(false);

  // Navigating to a different item reuses this component, so `text` still holds
  // whatever the user was editing on the item they just left. Drop it and start
  // from the newly loaded item, otherwise the editor's save effect sees a diff
  // and writes the previous item's contents over this one.
  if (itemKey !== openItemKey) {
    setOpenItemKey(itemKey);
    setText(startingText);
    setKnown([startingText]);
    setClientHasEdited(false);
    setUpdateMonacoKey((k) => k + 1);
  }

  // Only keystrokes make the client authoritative. Merely opening or
  // re-rendering an item must never be enough to trigger a save.
  const clientIsAuthoritative = clientHasEdited && known.includes(startingText);

  // a few, not one: late reads of earlier saves can still land
  const remember = (serverText: string) =>
    setKnown((k) => [serverText, ...k.filter((t) => t !== serverText)].slice(0, 8));

  /** Typing; or, with `fromServer`, taking the server's text in place of what was here. */
  const textUpdate = useCallback((t: string, fromServer: boolean = false) => {
    setText(t);
    setClientHasEdited(true);
    if (fromServer) {
      remember(t);
      setUpdateMonacoKey((k) => k + 1);
    }
  }, []);

  /** The text just sent to the server (normalized): its echo is not a change. */
  const textSaved = useCallback((normalized: string) => remember(normalized), []);

  return useMemo(
    () => ({
      clientIsAuthoritative,
      textUpdate,
      textSaved,
      text,
      monacoKey: updateMonacoKey,
    }),
    [clientIsAuthoritative, text, textSaved, textUpdate, updateMonacoKey]
  );
}
