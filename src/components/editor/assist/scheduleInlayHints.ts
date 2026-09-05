import type { editor, languages } from "monaco-editor";
import type * as MonacoNs from "monaco-editor";
import { studentDisplayName } from "@/features/local/assignments/models/utils/scheduleUtils";
import { EditorAssistData } from "./editorAssistData";
import { scheduleStudentLines } from "./frontmatterContext";

/** Grey student names shown after the Canvas ids in a Schedule block. */
export function scheduleInlayHints(
  monaco: typeof MonacoNs,
  model: editor.ITextModel,
  data: EditorAssistData
): languages.InlayHint[] {
  if (!data.studentsLoaded) return [];
  return scheduleStudentLines(model.getLinesContent()).flatMap((line) => {
    const name = studentDisplayName(line.label, data.students);
    if (name === line.label) return [];
    return [
      {
        label: name,
        position: {
          lineNumber: line.lineIndex + 1,
          column: line.column + line.label.length,
        },
        kind: monaco.languages.InlayHintKind.Type,
        paddingLeft: true,
      },
    ];
  });
}
