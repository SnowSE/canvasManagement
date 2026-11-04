"use client";
import { ReactNode, useLayoutEffect, useSyncExternalStore } from "react";

/** What an item's page gives the frame: its bars' contents and what the Editor and Preview panes show. */
export type ItemParts = {
  /** Which item these are for; the Editor pane starts a fresh editor when it changes (Monaco takes its text at mount). */
  key: string;
  topBar: ReactNode;
  bottomBar: ReactNode;
  editor: ReactNode;
  preview: ReactNode;
};

// The page isn't an ancestor of the panes (its own suspense and fallbacks
// would blank them all), so it hands its parts over through this store;
// only the panes and bars that read it re-render when it changes.
let parts: ItemParts | undefined;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const publish = (next: ItemParts | undefined) => {
  parts = next;
  listeners.forEach((listener) => listener());
};

/** The parts of the item open, if any; none on the server. */
export const useItemParts = () => useSyncExternalStore(subscribe, () => parts, () => undefined);

/** Hands the page's parts to the frame after every render, so they're as fresh as the page. */
export function usePublishItemParts(next: ItemParts | undefined) {
  useLayoutEffect(() => publish(next));
}
