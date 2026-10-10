"use client";
import {
  ReactNode,
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";

export function Expandable({
  children,
  ExpandableElement,
  defaultExpanded = false,
  storageKey,
}: {
  children: ReactNode;
  ExpandableElement: (props: {
    setIsExpanded: Dispatch<SetStateAction<boolean>>;
    isExpanded: boolean;
  }) => ReactNode;
  defaultExpanded?: boolean;
  // remember open/closed in localStorage under this key
  storageKey?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const expandRef = useRef<HTMLDivElement | null>(null);
  const restored = useRef(false);

  // read after mount: the server renders the default, and hydration keeps the
  // server's markup, so starting from the stored value would never show
  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) setIsExpanded(stored === "true");
    } catch {
      // storage unavailable: keep the default
    }
    restored.current = true;
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !restored.current) return;
    try {
      localStorage.setItem(storageKey, String(isExpanded));
    } catch {
      // storage unavailable: nothing to remember it in
    }
  }, [isExpanded, storageKey]);

  return (
    <>
      <ExpandableElement
        setIsExpanded={setIsExpanded}
        isExpanded={isExpanded}
      />
      <div
        ref={expandRef}
        className={` overflow-hidden transition-all `}
        style={{
          maxHeight: isExpanded ? expandRef?.current?.scrollHeight : "0",
        }}
      >
        {children}
      </div>
    </>
  );
}
