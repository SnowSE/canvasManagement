"use client";
import { useState, useMemo, useCallback } from "react";

export function useAuthoritativeUpdates({
  itemKey,
  serverUpdatedAt,
  startingText,
}: {
  /**
   * Identifies which item is currently open in the editor. Navigation (next,
   * previous, browser back, or picking another item) changes this without
   * remounting the editor, so the hook uses it to know when the text it is
   * holding no longer belongs to the item on screen.
   */
  itemKey: string;
  serverUpdatedAt: number;
  startingText: string;
}) {
  const [text, setText] = useState(startingText);
  const [clientDataUpdatedAt, setClientDataUpdatedAt] =
    useState(serverUpdatedAt);
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
    setClientDataUpdatedAt(serverUpdatedAt);
    setClientHasEdited(false);
    setUpdateMonacoKey((k) => k + 1);
  }

  const clientIsAuthoritative = useMemo(() => {
    // Only keystrokes make the client authoritative. Merely opening or
    // re-rendering an item must never be enough to trigger a save.
    if (!clientHasEdited) return false;
    const estimatedNetworkRoundTrip = 500; // network latency means client is still authoritative for a slight delay
    return serverUpdatedAt <= clientDataUpdatedAt + estimatedNetworkRoundTrip;
  }, [clientDataUpdatedAt, clientHasEdited, serverUpdatedAt]);

  const textUpdate = useCallback((t: string, updateMonaco: boolean = false) => {
    setText(t);
    setClientDataUpdatedAt(Date.now());
    setClientHasEdited(true);
    if (updateMonaco) setUpdateMonacoKey((k) => k + 1);
  }, []);

  return useMemo(
    () => ({
      clientIsAuthoritative,
      serverUpdatedAt,
      clientDataUpdatedAt,
      textUpdate,
      text,
      monacoKey: updateMonacoKey,
    }),
    [
      clientDataUpdatedAt,
      clientIsAuthoritative,
      serverUpdatedAt,
      text,
      textUpdate,
      updateMonacoKey,
    ]
  );
}
