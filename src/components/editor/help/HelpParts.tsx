"use client";
import { ReactNode, useEffect, useRef, useState } from "react";
import { copyTextToClipboard } from "@/components/CopyableCommand";

// The app's --font-mono is DM Sans, which is proportional. Examples need real
// monospace so indentation (rubric ratings, Schedule) lines up the way it does
// in the editor.
const monospace = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
};

// Text a reader can search for: everything in the element except button labels
// (every Example has a "Copy" button, which would make "copy" match everything).
function searchableTextNodes(root: Element): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest("button")
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}

const highlightName = "help-search";

// Marks every occurrence of the search terms with the CSS Custom Highlight API
// (styled by ::highlight(help-search) in globals.css). Browsers without it
// still filter, they just don't highlight.
function highlightTerms(sections: HTMLDetailsElement[], terms: string[]) {
  if (typeof CSS === "undefined" || !("highlights" in CSS)) return;
  CSS.highlights.delete(highlightName);
  if (terms.length === 0) return;
  const ranges = sections.flatMap((section) =>
    searchableTextNodes(section).flatMap((node) => {
      const text = (node.textContent ?? "").toLowerCase();
      return terms.flatMap((term) => {
        const found: Range[] = [];
        for (let i = text.indexOf(term); i !== -1; i = text.indexOf(term, i + term.length)) {
          const range = new Range();
          range.setStart(node, i);
          range.setEnd(node, i + term.length);
          found.push(range);
        }
        return found;
      });
    })
  );
  CSS.highlights.set(highlightName, new Highlight(...ranges));
}

/**
 * Help pane contents: explanations as regular text, syntax as Example blocks.
 * The search box and expand/collapse buttons work on the <details> of each
 * HelpSection directly, so sections stay plain uncontrolled elements.
 */
export function HelpPanel({ children }: { children: ReactNode }) {
  const sectionsRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [noMatches, setNoMatches] = useState(false);

  const sections = () => [
    ...(sectionsRef.current?.querySelectorAll<HTMLDetailsElement>(
      "details[data-help-section]"
    ) ?? []),
  ];

  const filter = (value: string) => {
    setQuery(value);
    const terms = value.toLowerCase().split(/\s+/).filter(Boolean);
    const matching = sections().filter((section) => {
      const text = searchableTextNodes(section)
        .map((n) => n.textContent)
        .join(" ")
        .toLowerCase();
      const isMatch = terms.every((term) => text.includes(term));
      section.hidden = !isMatch;
      // a search opens what it found; clearing it goes back to all collapsed
      section.open = terms.length > 0 && isMatch;
      return isMatch;
    });
    setNoMatches(matching.length === 0);
    highlightTerms(matching, terms);
  };

  const setAllOpen = (open: boolean) =>
    sections()
      .filter((section) => !section.hidden)
      .forEach((section) => (section.open = open));

  useEffect(() => () => {
    if (typeof CSS !== "undefined" && "highlights" in CSS)
      CSS.highlights.delete(highlightName);
  }, []);

  return (
    <div className="text-sm leading-relaxed pe-2 pb-6">
      <div className="md:sticky md:top-0 z-10 bg-gray-900 py-2 flex flex-row items-center gap-3 border-b border-slate-800">
        <input
          type="search"
          value={query}
          onChange={(e) => filter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") filter("");
          }}
          placeholder="Search help"
          aria-label="Search help"
          className="min-w-0 flex-1 rounded border border-slate-700 bg-gray-950 px-2 py-1 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
        />
        <button
          className="unstyled flex-none !px-1 !font-normal text-xs text-blue-400 hover:text-blue-300 underline"
          onClick={() => setAllOpen(true)}
        >
          Expand all
        </button>
        <button
          className="unstyled flex-none !px-1 !font-normal text-xs text-blue-400 hover:text-blue-300 underline"
          onClick={() => setAllOpen(false)}
        >
          Collapse all
        </button>
      </div>
      <div ref={sectionsRef}>{children}</div>
      {noMatches && (
        <div className="py-3 text-slate-400 italic">
          Nothing in this help matches &ldquo;{query.trim()}&rdquo;.
        </div>
      )}
    </div>
  );
}

/** One collapsible topic, so the panel reads like a table of contents. */
export function HelpSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details data-help-section className="group border-b border-slate-800">
      <summary className="cursor-pointer select-none py-2 font-semibold text-slate-200 hover:text-white list-none flex items-center gap-2">
        <svg
          viewBox="0 0 16 16"
          className="size-3 flex-none fill-slate-500 transition-transform group-open:rotate-90"
          aria-hidden
        >
          <path d="M5 3l6 5-6 5z" />
        </svg>
        {title}
      </summary>
      <div className="pb-3 ps-5 space-y-2 text-slate-300">{children}</div>
    </details>
  );
}

/** Markdown exactly as it is typed in the editor, with a copy button. */
export function Example({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const text = children.replace(/^\n/, "").replace(/\n\s*$/, "");
  return (
    <div className="relative group/example">
      <pre
        style={monospace}
        className="rounded border border-slate-700 bg-gray-950 px-3 py-2 text-xs leading-relaxed overflow-x-auto whitespace-pre text-slate-200"
      >
        {text}
      </pre>
      <button
        className="unstyled absolute top-1 right-1 rounded px-2 text-xs text-slate-400 bg-gray-900 border border-slate-700 opacity-0 group-hover/example:opacity-100 focus:opacity-100 hover:text-white"
        onClick={async () => {
          await copyTextToClipboard(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}

/** Inline syntax inside an explanation. */
export function C({ children }: { children: ReactNode }) {
  return (
    <code style={monospace} className="!px-1 !py-0 !text-xs text-slate-200">
      {children}
    </code>
  );
}

/** Explanatory paragraph (the global p style has too much margin for the pane). */
export function P({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

/** Settings-key reference: key on the left, what it does on the right. */
export function KeyList({
  items,
}: {
  items: { name: string; children: ReactNode }[];
}) {
  return (
    <dl className="space-y-1.5">
      {items.map(({ name, children }) => (
        <div key={name}>
          <dt>
            <C>{name}</C>
          </dt>
          <dd className="ps-3 text-slate-400">{children}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Values that come from this course (assignment groups, group sets). */
export function ValueList({
  values,
  empty,
}: {
  values: string[];
  empty: ReactNode;
}) {
  if (values.length === 0) return <span className="italic">{empty}</span>;
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {values.map((v) => (
        <C key={v}>{v}</C>
      ))}
    </span>
  );
}

export function HelpLinks({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  return (
    <div className="pt-3 flex flex-wrap gap-x-4 gap-y-1">
      {links.map(({ href, label }) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-blue-400 underline"
        >
          {label}
        </a>
      ))}
    </div>
  );
}
