"use client";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { snippetAt, sourceOffsetOf, fractionThrough } from "@/components/editor/previewJump";
import {
  copyToClipboard,
  findMarkdownTable,
  htmlTableToMarkdown,
  tableHeaders,
} from "./previewTables";

// A small menu button on the table under the pointer (or the one tapped, on a
// touch screen): copy the table as HTML or Markdown, or edit it. A button
// rather than a right-click menu, so the browser's own menu still works.

const hideDelay = 300;

/** The element whose scrolling moves `el`: where a table can scroll out of sight. */
function scrollParentOf(el: Element) {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if (overflowY === "auto" || overflowY === "scroll") return p;
  }
  return undefined;
}

/**
 * Where the button goes for `table`: its top-right corner, held inside the
 * visible part of a long table; null once the table is out of sight.
 */
function placeFor(table: HTMLTableElement) {
  if (!table.isConnected) return null;
  const rect = table.getBoundingClientRect();
  const scroller = scrollParentOf(table)?.getBoundingClientRect();
  const visibleTop = Math.max(rect.top, scroller?.top ?? 0, 0);
  const visibleBottom = Math.min(rect.bottom, scroller?.bottom ?? innerHeight, innerHeight);
  if (visibleBottom - visibleTop < 28) return null;
  return { top: visibleTop + 4, right: innerWidth - rect.right + 4 };
}

/**
 * Wraps a rendered preview. `source` is the file's text, for finding a
 * table's own lines and for Edit Here; `onEditHere` gets an offset in it.
 */
export function PreviewTableMenu({
  source,
  onEditHere,
  className,
  children,
}: {
  source: () => string | undefined;
  onEditHere: (offset: number) => void;
  /** for the wrapper: "h-full" where the preview fills its pane and scrolls itself */
  className?: string;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [table, setTable] = useState<HTMLTableElement | null>(null);
  const [place, setPlace] = useState<{ top: number; right: number } | null>(null);
  const [open, setOpen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cancelHide = () => clearTimeout(hideTimer.current);
  const hideSoon = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setOpen(false);
      setTable(null);
    }, hideDelay);
  }, []);
  useEffect(() => () => clearTimeout(hideTimer.current), []);

  // the button follows its table while the preview scrolls
  useEffect(() => {
    if (!table) return;
    const reposition = () => setPlace(placeFor(table));
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [table]);

  // an open menu closes on Escape or a press anywhere else
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.("[data-table-menu]")) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const tableUnder = (target: EventTarget) => {
    const found = (target as Element).closest?.("table");
    return found && rootRef.current?.contains(found) ? (found as HTMLTableElement) : null;
  };
  const showFor = (target: EventTarget) => {
    // the button and menu sit inside the preview, off the table
    if ((target as Element).closest?.("[data-table-menu]")) return cancelHide();
    const found = tableUnder(target);
    if (found) {
      cancelHide();
      if (!open && found !== table) {
        setTable(found);
        setPlace(placeFor(found));
      }
    } else if (!open) hideSoon();
  };

  /** The table's own lines in the file, when it was written as a pipe table. */
  const markdownSource = (t: HTMLTableElement) => {
    const text = source();
    const root = rootRef.current;
    if (text === undefined || !root) return undefined;
    return findMarkdownTable(text, tableHeaders(t), fractionThrough(root, t));
  };

  const finish = (message: string, ok: boolean) => {
    setOpen(false);
    if (ok) toast.success(message, { id: "table-copy" });
    else toast.error("The browser didn't allow copying", { id: "table-copy" });
  };

  const copyHtml = () => {
    if (!table) return;
    const html = table.outerHTML;
    finish("Copied the table as HTML", copyToClipboard({ text: html, html }));
  };

  const copyMarkdown = () => {
    if (!table) return;
    const text = markdownSource(table)?.text ?? htmlTableToMarkdown(table);
    finish("Copied the table as Markdown", copyToClipboard({ text }));
  };

  /** Where Edit Here goes: the table's first line, else its first cell's text. */
  const editOffset = (t: HTMLTableElement) => {
    const found = markdownSource(t);
    if (found) return found.start;
    const text = source();
    const root = rootRef.current;
    const cell = [...t.querySelectorAll("th, td")].find((c) => c.textContent?.trim());
    if (text === undefined || !root || !cell?.textContent) return undefined;
    const snippet = snippetAt(cell.textContent.trim(), 0);
    return sourceOffsetOf(text, snippet.text, fractionThrough(root, cell));
  };

  const editHere = () => {
    if (!table) return;
    const offset = editOffset(table);
    setOpen(false);
    setTable(null);
    if (offset === undefined) toast.error("Couldn't find this table in the file", { id: "table-copy" });
    else onEditHere(offset);
  };

  const itemClass =
    "unstyled block w-full text-start px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 focus:bg-slate-700 focus:outline-none";

  return (
    <div
      ref={rootRef}
      className={className}
      onPointerOver={(e) => showFor(e.target)}
      onPointerLeave={() => !open && hideSoon()}
      // a touch screen has no hover: a tap on a table shows its button
      onClick={(e) => tableUnder(e.target) && showFor(e.target)}
    >
      {children}
      {table && place && (
        <div
          data-table-menu
          className="fixed z-30 flex flex-col items-end"
          style={{ top: place.top, right: place.right }}
          onPointerEnter={cancelHide}
          onPointerLeave={() => !open && hideSoon()}
          // the preview moves the editor on a click; not on one in here
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="unstyled rounded border border-slate-600 bg-slate-800/90 px-2 py-0.5 text-xs font-bold text-slate-200 shadow hover:bg-slate-700"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            Table ▾
          </button>
          {open && (
            <div
              role="menu"
              className="mt-1 min-w-48 overflow-hidden rounded border border-slate-600 bg-slate-800 py-1 shadow-lg"
            >
              <button role="menuitem" type="button" className={itemClass} onClick={copyHtml} autoFocus>
                Copy Table (HTML)
              </button>
              <button role="menuitem" type="button" className={itemClass} onClick={copyMarkdown}>
                Copy Table (Markdown)
              </button>
              <button role="menuitem" type="button" className={itemClass} onClick={editHere}>
                Edit Here
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
