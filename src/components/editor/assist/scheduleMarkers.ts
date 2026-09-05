import type { editor } from "monaco-editor";
import type * as MonacoNs from "monaco-editor";
import { resolveStudentLabel } from "@/features/local/assignments/models/utils/scheduleUtils";
import { EditorAssistData } from "./editorAssistData";
import { scheduleStudentLines } from "./frontmatterContext";

export const markerOwner = "canvasAssist";

/** Red squiggles for schedule names Canvas does not know, yellow for repeats. */
export function scheduleMarkers(
  monaco: typeof MonacoNs,
  model: editor.ITextModel,
  data: EditorAssistData
): editor.IMarkerData[] {
  if (!data.studentsLoaded) return [];
  const seen = new Map<number, string>();
  const markers: editor.IMarkerData[] = [];
  for (const line of scheduleStudentLines(model.getLinesContent())) {
    const range = {
      startLineNumber: line.lineIndex + 1,
      startColumn: line.column,
      endLineNumber: line.lineIndex + 1,
      endColumn: line.column + line.label.length,
    };
    const student = resolveStudentLabel(line.label, data.students);
    if (!student) {
      markers.push({
        ...range,
        severity: monaco.MarkerSeverity.Error,
        message: /^\d+$/.test(line.label)
          ? `${line.label} is not a Canvas id of a student in this course (sync students in course settings if they just enrolled)`
          : `"${line.label}" is not in the Canvas roster. Pick a student from the list to insert their Canvas id.`,
      });
      continue;
    }
    const earlier = seen.get(student.id);
    if (earlier) {
      markers.push({
        ...range,
        severity: monaco.MarkerSeverity.Warning,
        message: `${student.sortableName} is already scheduled on ${earlier}`,
      });
      continue;
    }
    seen.set(student.id, line.date ?? "another date");
  }
  return markers;
}
