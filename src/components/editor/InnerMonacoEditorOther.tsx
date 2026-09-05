"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { editor } from "monaco-editor";
import type * as MonacoNs from "monaco-editor";
import Editor from "@monaco-editor/react";
import ClientOnly from "../ClientOnly";
import { useEditorAssistData } from "./assist/useEditorAssistData";
import { assistDataRef } from "./assist/editorAssistData";
import {
  buildCompletions,
  shouldAutoSuggest,
} from "./assist/completionProvider";
import { markerOwner, scheduleMarkers } from "./assist/scheduleMarkers";
import { scheduleInlayHints } from "./assist/scheduleInlayHints";
import {
  DATE_KEYS,
  getLineContext,
  LineContext,
} from "./assist/frontmatterContext";
import { DatePickerMode, EditorDatePicker } from "./EditorDatePicker";
import {
  dateToMarkdownString,
  getDateFromString,
  getDateOnlyMarkdownString,
} from "@/features/local/utils/timeUtils";

type Monaco = typeof MonacoNs;

let completionProviderRegistered = false;
// fired when roster data arrives so already-open editors redraw their hints
let inlayHintsChanged: MonacoNs.Emitter<void> | null = null;

interface PickerState {
  lineNumber: number;
  mode: DatePickerMode;
  value: Date | null;
  /** date-only mode: indentation of the Schedule date key line */
  indent: string;
  /** date-only mode: the line already had a date (edit) rather than being new */
  hadDate: boolean;
  top: number;
  left: number;
  placeAbove: boolean;
}

const pickerHeight = 340;
const pickerWidth = 304;

function pickerContextFor(ctx: LineContext): Omit<
  PickerState,
  "lineNumber" | "top" | "left" | "placeAbove"
> | null {
  if (!ctx) return null;
  if (ctx.kind === "value" && DATE_KEYS.includes(ctx.key)) {
    return {
      mode: "datetime",
      value: ctx.value ? (getDateFromString(ctx.value) ?? null) : null,
      indent: "",
      hadDate: false,
    };
  }
  if (ctx.kind === "scheduleDateKey") {
    return {
      mode: "date",
      value: ctx.date ? (getDateFromString(ctx.date) ?? null) : null,
      indent: ctx.indent,
      hadDate: !!ctx.date,
    };
  }
  return null;
}

export default function InnerMonacoEditorOther({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void; // must be memoized
}) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const assist = useEditorAssistData();
  const [picker, setPicker] = useState<PickerState | null>(null);
  // Escape hides the picker for the line the cursor is on until it moves away
  const dismissedLineRef = useRef<number | null>(null);

  const refreshMarkers = useCallback(() => {
    const monaco = monacoRef.current;
    const model = editorRef.current?.getModel();
    if (!monaco || !model) return;
    monaco.editor.setModelMarkers(
      model,
      markerOwner,
      scheduleMarkers(monaco, model, assistDataRef.current)
    );
  }, []);

  useEffect(() => {
    assistDataRef.current = assist;
    refreshMarkers();
    inlayHintsChanged?.fire();
  }, [assist, refreshMarkers]);

  // Beside the line when the editor is wide enough (so the lines underneath
  // stay clickable), otherwise underneath it.
  const positionFor = (ed: editor.IStandaloneCodeEditor, lineNumber: number) => {
    const model = ed.getModel();
    const lineLength = model?.getLineLength(lineNumber) ?? 0;
    const lineEnd = ed.getScrolledVisiblePosition({
      lineNumber,
      column: lineLength + 1,
    });
    const layout = ed.getLayoutInfo();
    const lineTop = lineEnd?.top ?? 0;
    const lineHeight = lineEnd?.height ?? 20;
    const besideLeft = layout.contentLeft + (lineEnd?.left ?? 0) + 16;
    if (besideLeft + pickerWidth <= layout.width) {
      return {
        top: Math.max(0, Math.min(lineTop, layout.height - pickerHeight)),
        left: besideLeft,
        placeAbove: false,
      };
    }
    const below = lineTop + lineHeight + 2;
    const placeAbove = below + pickerHeight > layout.height && lineTop > pickerHeight;
    return {
      top: placeAbove ? lineTop - 2 : below,
      left: Math.min(layout.contentLeft + 8, Math.max(8, layout.width - pickerWidth - 16)),
      placeAbove,
    };
  };

  const updateFromCursor = useCallback((ed: editor.IStandaloneCodeEditor) => {
    const model = ed.getModel();
    const pos = ed.getPosition();
    if (!model || !pos) return;
    if (dismissedLineRef.current !== pos.lineNumber) dismissedLineRef.current = null;

    const ctx = getLineContext(model.getLinesContent(), pos.lineNumber - 1);
    if (shouldAutoSuggest(ctx)) {
      ed.trigger("canvasAssist", "editor.action.triggerSuggest", {});
    }
    const pickerCtx = pickerContextFor(ctx);
    if (pickerCtx && dismissedLineRef.current === null) {
      setPicker({
        ...pickerCtx,
        lineNumber: pos.lineNumber,
        ...positionFor(ed, pos.lineNumber),
      });
    } else {
      setPicker(null);
    }
  }, []);

  function handleEditorDidMount(
    ed: editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) {
    editorRef.current = ed;
    monacoRef.current = monaco;

    if (!completionProviderRegistered) {
      completionProviderRegistered = true;
      monaco.languages.registerCompletionItemProvider("markdown", {
        triggerCharacters: [" ", ":"],
        provideCompletionItems: (model, position) =>
          buildCompletions(monaco, model, position, assistDataRef.current) ?? {
            suggestions: [],
          },
      });
      inlayHintsChanged = new monaco.Emitter<void>();
      monaco.languages.registerInlayHintsProvider("markdown", {
        onDidChangeInlayHints: inlayHintsChanged.event,
        provideInlayHints: (model) => ({
          hints: scheduleInlayHints(monaco, model, assistDataRef.current),
          dispose: () => {},
        }),
      });
    }

    ed.onDidChangeModelContent(() => {
      onChange(ed.getModel()?.getValue() ?? "");
      refreshMarkers();
    });
    ed.onDidChangeCursorPosition(() => updateFromCursor(ed));
    ed.onDidScrollChange(() =>
      setPicker((p) => (p ? { ...p, ...positionFor(ed, p.lineNumber) } : p))
    );
    ed.onKeyDown((e) => {
      if (e.keyCode === monaco.KeyCode.Escape) {
        const pos = ed.getPosition();
        if (pos) dismissedLineRef.current = pos.lineNumber;
        setPicker(null);
      }
    });
    refreshMarkers();
  }

  // a click anywhere outside the editor area puts the picker away
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!picker) return;
      if (containerRef.current?.contains(e.target as Node)) return;
      dismissedLineRef.current = picker.lineNumber;
      setPicker(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [picker]);

  const applyDate = (date: Date | null) => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    const model = ed?.getModel();
    if (!ed || !monaco || !model || !picker) return;
    const { lineNumber } = picker;
    const line = model.getLineContent(lineNumber);
    const fullLine = new monaco.Range(lineNumber, 1, lineNumber, line.length + 1);

    if (picker.mode === "datetime") {
      const key = /^([A-Za-z][A-Za-z0-9]*):/.exec(line)?.[1];
      if (!key) return;
      const text = `${key}: ${date ? dateToMarkdownString(date) : ""}`;
      ed.executeEdits("canvasAssist", [{ range: fullLine, text }]);
      ed.pushUndoStop();
      ed.setPosition({ lineNumber, column: text.length + 1 });
      ed.focus();
      return;
    }

    if (!date) return;
    const indent = picker.indent || "  ";
    let text = `${indent}${getDateOnlyMarkdownString(date)}:`;
    if (picker.hadDate) {
      ed.executeEdits("canvasAssist", [{ range: fullLine, text }]);
      ed.pushUndoStop();
      ed.setPosition({ lineNumber, column: text.length + 1 });
      ed.focus();
      return;
    }
    // a brand new date: drop straight into its first student line
    const studentLine = `${indent}  - `;
    text += `\n${studentLine}`;
    ed.executeEdits("canvasAssist", [{ range: fullLine, text }]);
    ed.pushUndoStop();
    ed.setPosition({ lineNumber: lineNumber + 1, column: studentLine.length + 1 });
    ed.focus();
    ed.trigger("canvasAssist", "editor.action.triggerSuggest", {});
  };

  return (
    <ClientOnly>
      <div ref={containerRef} className="relative h-full">
        <Editor
          height="100%"
          options={{
            value: value,
            tabSize: 3,
            minimap: {
              enabled: false,
            },
            lineNumbers: "off",
            wordWrap: "on",
            automaticLayout: true,
            fontFamily: "Roboto-mono",
            fontSize: 16,
            padding: {
              top: 10,
            },
            // only our frontmatter suggestions, not every word in the document
            wordBasedSuggestions: "off",
            suggest: { showWords: false, preview: false },
            inlayHints: { enabled: "on" },
          }}
          defaultLanguage="markdown"
          theme="vs-dark"
          defaultValue={value}
          onMount={handleEditorDidMount}
        />
        {picker && (
          <EditorDatePicker
            key={`${picker.lineNumber}-${picker.mode}`}
            mode={picker.mode}
            value={picker.value}
            calendar={assist.calendar}
            onChange={applyDate}
            onClose={() => {
              dismissedLineRef.current = picker.lineNumber;
              setPicker(null);
            }}
            style={
              picker.placeAbove
                ? { left: picker.left, bottom: `calc(100% - ${picker.top}px)` }
                : { left: picker.left, top: picker.top }
            }
          />
        )}
      </div>
    </ClientOnly>
  );
}
