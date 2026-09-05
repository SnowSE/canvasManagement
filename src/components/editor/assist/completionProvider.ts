import type { editor, languages, Position, IRange } from "monaco-editor";
import type * as MonacoNs from "monaco-editor";
import { AssignmentSubmissionType } from "@/features/local/assignments/models/assignmentSubmissionType";
import {
  resolveStudentLabel,
  studentFileToken,
  studentLabels,
} from "@/features/local/assignments/models/utils/scheduleUtils";
import { EditorAssistData } from "./editorAssistData";
import {
  getLineContext,
  itemTypeFromFrontmatter,
  LineContext,
  presentKeys,
  scheduleStudentLines,
} from "./frontmatterContext";

type Monaco = typeof MonacoNs;

const booleanKeys = new Set([
  "GradeIndividually",
  "ShuffleAnswers",
  "ShowCorrectAnswers",
  "OneQuestionAtATime",
]);

const commonUploadTypes = ["pdf", "jpg", "jpeg", "png", "zip", "docx", "txt", "md"];

// keys offered on a blank frontmatter line, per file type, with what to insert
const keySuggestions: Record<
  string,
  { key: string; insert: string; opensList: boolean; detail: string }[]
> = {
  assignment: [
    { key: "UnlockAt", insert: "UnlockAt: ", opensList: false, detail: "when students can see it" },
    { key: "LockAt", insert: "LockAt: ", opensList: false, detail: "when submissions close" },
    { key: "DueAt", insert: "DueAt: ", opensList: false, detail: "due date and time" },
    { key: "AssignmentGroupName", insert: "AssignmentGroupName: ", opensList: true, detail: "grading category" },
    { key: "GroupSet", insert: "GroupSet: ", opensList: true, detail: "student groups (group assignment)" },
    { key: "GradeIndividually", insert: "GradeIndividually: ", opensList: true, detail: "each group member graded separately" },
    { key: "Schedule", insert: "Schedule:\n  ", opensList: false, detail: "per-student due dates" },
    { key: "Classroom50Slug", insert: "Classroom50Slug: ", opensList: false, detail: "Classroom 50 assignment slug" },
    { key: "SubmissionTypes", insert: "SubmissionTypes:\n- ", opensList: true, detail: "" },
    { key: "AllowedFileUploadExtensions", insert: "AllowedFileUploadExtensions:\n- ", opensList: true, detail: "" },
  ],
  quiz: [
    { key: "UnlockAt", insert: "UnlockAt: ", opensList: false, detail: "" },
    { key: "LockAt", insert: "LockAt: ", opensList: false, detail: "" },
    { key: "DueAt", insert: "DueAt: ", opensList: false, detail: "" },
    { key: "Password", insert: "Password: ", opensList: false, detail: "" },
    { key: "ShuffleAnswers", insert: "ShuffleAnswers: ", opensList: true, detail: "" },
    { key: "ShowCorrectAnswers", insert: "ShowCorrectAnswers: ", opensList: true, detail: "" },
    { key: "OneQuestionAtATime", insert: "OneQuestionAtATime: ", opensList: true, detail: "" },
    { key: "AssignmentGroup", insert: "AssignmentGroup: ", opensList: true, detail: "grading category" },
    { key: "AllowedAttempts", insert: "AllowedAttempts: ", opensList: false, detail: "-1 for unlimited" },
    { key: "Description", insert: "Description: ", opensList: false, detail: "" },
  ],
  page: [
    { key: "DueDateForOrdering", insert: "DueDateForOrdering: ", opensList: false, detail: "" },
  ],
};

/** Contexts where the list should open as soon as the cursor lands there. */
export function shouldAutoSuggest(ctx: LineContext): boolean {
  if (!ctx) return false;
  if (ctx.kind === "value")
    return (
      ctx.value === "" &&
      (ctx.key === "AssignmentGroupName" ||
        ctx.key === "AssignmentGroup" ||
        ctx.key === "GroupSet" ||
        booleanKeys.has(ctx.key))
    );
  if (ctx.kind === "listItem")
    return (
      ctx.text === "" &&
      ["Schedule", "SubmissionTypes", "AllowedFileUploadExtensions"].includes(
        ctx.header
      )
    );
  return ctx.kind === "blankKey";
}

export function buildCompletions(
  monaco: Monaco,
  model: editor.ITextModel,
  position: Position,
  data: EditorAssistData
): languages.CompletionList | undefined {
  const lines = model.getLinesContent();
  const lineIndex = position.lineNumber - 1;
  const ctx = getLineContext(lines, lineIndex);
  if (!ctx) return undefined;
  const line = lines[lineIndex];
  const Kind = monaco.languages.CompletionItemKind;
  const toEnd = (startColumn: number): IRange => ({
    startLineNumber: position.lineNumber,
    startColumn,
    endLineNumber: position.lineNumber,
    endColumn: line.length + 1,
  });
  const item = (
    label: string,
    insertText: string,
    range: IRange,
    kind: languages.CompletionItemKind,
    extra: Partial<languages.CompletionItem> = {}
  ): languages.CompletionItem => ({
    label,
    insertText,
    range,
    kind,
    filterText: label,
    sortText: label.toLowerCase(),
    ...extra,
  });

  if (ctx.kind === "value") {
    const range = toEnd(ctx.valueStart);
    const lead = ctx.needsSpace ? " " : "";
    if (ctx.key === "AssignmentGroupName" || ctx.key === "AssignmentGroup") {
      return {
        suggestions: data.assignmentGroupNames.map((name) =>
          item(name, lead + name, range, Kind.EnumMember, {
            detail: "assignment group",
          })
        ),
      };
    }
    if (ctx.key === "GroupSet") {
      // Monaco shows "No suggestions" for items that insert nothing, so there
      // is no placeholder while loading or when Canvas has no group sets; the
      // help panel and the Groups settings section cover those states.
      if (!data.groupSetsLoaded || data.groupSets.length === 0) return undefined;
      return {
        suggestions: data.groupSets.map((g) =>
          item(g.name, lead + g.name, range, Kind.Class, {
            detail: `${g.groupCount} group${g.groupCount === 1 ? "" : "s"} · ${g.studentCount} students`,
          })
        ),
      };
    }
    if (booleanKeys.has(ctx.key)) {
      return {
        suggestions: ["true", "false"].map((v, i) =>
          item(v, lead + v, range, Kind.Value, { sortText: String(i) })
        ),
      };
    }
    return undefined;
  }

  if (ctx.kind === "listItem") {
    const range = toEnd(ctx.itemStart);
    const lead = ctx.needsDash ? "- " : "";
    if (ctx.header === "SubmissionTypes") {
      return {
        suggestions: Object.values(AssignmentSubmissionType).map((t) =>
          item(t, lead + t, range, Kind.EnumMember)
        ),
      };
    }
    if (ctx.header === "AllowedFileUploadExtensions") {
      const types = [...new Set([...data.fileUploadTypes, ...commonUploadTypes])];
      return {
        suggestions: types.map((t, i) =>
          item(t, lead + t, range, Kind.EnumMember, {
            sortText: String(i).padStart(3, "0"),
            detail: data.fileUploadTypes.includes(t) ? "course default" : "",
          })
        ),
      };
    }
    if (ctx.header === "Schedule") {
      if (!data.studentsLoaded) return undefined;
      const listed = new Set(
        scheduleStudentLines(lines)
          .filter((s) => s.lineIndex !== lineIndex)
          .map((s) => resolveStudentLabel(s.label, data.students)?.id)
          .filter((id): id is number => id !== undefined)
      );
      const labels = studentLabels(data.students);
      const remaining = data.students.filter((s) => !listed.has(s.id));
      // the list shows names, the file gets the id
      return {
        suggestions: remaining.map((s) => {
          const name = labels.get(s.id) ?? s.sortableName;
          return item(name, lead + studentFileToken(s), range, Kind.User, {
            detail: studentFileToken(s),
            filterText: `${name} ${s.id}`,
          });
        }),
      };
    }
    return undefined;
  }

  if (ctx.kind === "blankKey") {
    const type = itemTypeFromFrontmatter(lines);
    const options = keySuggestions[type];
    if (!options) return undefined;
    const existing = presentKeys(lines);
    const range = toEnd(1);
    return {
      suggestions: options
        .filter((o) => !existing.has(o.key))
        .map((o, i) =>
          item(o.key, o.insert, range, Kind.Property, {
            detail: o.detail,
            sortText: String(i).padStart(3, "0"),
            command: o.opensList
              ? { id: "editor.action.triggerSuggest", title: "suggest" }
              : undefined,
          })
        ),
    };
  }

  return undefined;
}
