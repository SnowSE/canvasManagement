"use client";
import {
  ReactNode,
  Dispatch,
  SetStateAction,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { subscribeToStorage } from "./storage";

export function Expandable({
  children,
  ExpandableElement,
  defaultExpanded = false,
  storageKey,
  openRequests,
}: {
  children: ReactNode;
  ExpandableElement: (props: {
    setIsExpanded: Dispatch<SetStateAction<boolean>>;
    isExpanded: boolean;
  }) => ReactNode;
  defaultExpanded?: boolean;
  // remember open/closed in localStorage under this key
  storageKey?: string;
  // opens it each time this changes (from 0), like "expand all"
  openRequests?: number;
}) {
  // the server and hydration render the default, then the stored value
  const stored = useSyncExternalStore(
    subscribeToStorage,
    () => readStored(storageKey),
    () => null,
  );
  // opened or closed here since mount
  const [choice, setChoice] = useState<boolean | null>(null);
  const [seenRequests, setSeenRequests] = useState(openRequests);
  if (openRequests !== seenRequests) {
    setSeenRequests(openRequests);
    if (openRequests) setChoice(true);
  }
  const isExpanded = choice ?? (stored === null ? defaultExpanded : stored === "true");

  useEffect(() => {
    if (!storageKey || choice === null) return;
    try {
      localStorage.setItem(storageKey, String(choice));
    } catch {
      // storage unavailable: nothing to remember it in
    }
  }, [choice, storageKey]);

  const setIsExpanded: Dispatch<SetStateAction<boolean>> = (next) =>
    setChoice((current) =>
      typeof next === "function" ? next(current ?? isExpanded) : next,
    );

  return (
    <>
      <ExpandableElement setIsExpanded={setIsExpanded} isExpanded={isExpanded} />
      {/* grid rows animate between 0 and the content's height, whatever it is */}
      <div
        className={"grid transition-all " + (isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
      >
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </>
  );
}

function readStored(key: string | undefined) {
  if (!key) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    // storage unavailable: keep the default
    return null;
  }
}
