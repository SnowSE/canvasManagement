import type { editor } from "monaco-editor";
import type * as MonacoNs from "monaco-editor";
import {
  classroomUrlToken,
  descriptionHasClassroom50AcceptLink,
} from "@/features/local/classroom50/classroom50UrlUtils";
import { frontmatterEndLine } from "./frontmatterContext";

const slugLine = /^(Classroom50Slug:\s*)(\S+)\s*$/;

/** The Classroom50Slug line, when the description below the "---" never links to the accept page. */
export function classroom50SlugWithoutAcceptLink(lines: string[]):
  | { lineIndex: number; column: number; slug: string }
  | undefined {
  const end = frontmatterEndLine(lines);
  if (end === -1) return undefined;
  for (let i = 0; i < end; i++) {
    const match = slugLine.exec(lines[i]);
    if (!match) continue;
    const slug = match[2];
    const body = lines.slice(end + 1).join("\n");
    if (descriptionHasClassroom50AcceptLink(body, slug)) return undefined;
    return { lineIndex: i, column: match[1].length + 1, slug };
  }
  return undefined;
}

/** A yellow squiggle on the slug when students would get no link to accept the assignment. */
export function classroom50Markers(
  monaco: typeof MonacoNs,
  model: editor.ITextModel
): editor.IMarkerData[] {
  const found = classroom50SlugWithoutAcceptLink(model.getLinesContent());
  if (!found) return [];
  return [
    {
      startLineNumber: found.lineIndex + 1,
      startColumn: found.column,
      endLineNumber: found.lineIndex + 1,
      endColumn: found.column + found.slug.length,
      severity: monaco.MarkerSeverity.Warning,
      message: `The description has no Classroom 50 accept link, so students have no way to accept this assignment. Add [Accept the assignment](${classroomUrlToken}) below the ---.`,
    },
  ];
}
