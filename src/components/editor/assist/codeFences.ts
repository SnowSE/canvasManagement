import type { editor, languages, Position } from "monaco-editor";
import type * as MonacoNs from "monaco-editor";
import {
  canonicalLanguage,
  closestLanguage,
  guessLanguages,
  languageChoices,
} from "@/services/codeHighlight";
import {
  CodeFence,
  findCodeFences,
  isAttribute,
  isKnownFenceLanguage,
} from "@/services/codeFenceScan";

export { findCodeFences };

type Monaco = typeof MonacoNs;

/** How many code blocks in the course name each language (see countFenceLanguages). */
export type CourseLanguages = Record<string, number>;

/** Fences naming a language the highlighter doesn't know, so the block would go to Canvas plain. */
export function unknownFenceLanguages(lines: string[]) {
  return findCodeFences(lines).filter(
    (f): f is CodeFence & { language: NonNullable<CodeFence["language"]> } =>
      !!f.language && !f.hide && !isKnownFenceLanguage(f.language.word),
  );
}

function languagesUsedIn(fences: CodeFence[], except?: CodeFence) {
  return fences
    .filter((f) => f !== except && f.language && isKnownFenceLanguage(f.language.word))
    .map((f) => f.language!.word);
}

/** What to offer for a fence's language: a likely typo fix first, then guesses from the code. */
export function fenceLanguageFixes(
  lines: string[],
  fence: CodeFence,
  course: CourseLanguages = {},
) {
  const fences = findCodeFences(lines);
  const typo = fence.language ? closestLanguage(fence.language.word) : undefined;
  const guesses = guessLanguages(fence.body.join("\n"), {
    file: languagesUsedIn(fences, fence),
    course,
  });
  return [...new Set([typo, ...guesses].filter((x): x is string => !!x))];
}

export const fenceMarkerCode = "fence-language";

/** A yellow squiggle under a fence language the highlighter doesn't know. */
export function codeFenceMarkers(
  monaco: Monaco,
  model: editor.ITextModel,
): editor.IMarkerData[] {
  const lines = model.getLinesContent();
  return unknownFenceLanguages(lines).map((fence) => {
    const { word, start } = fence.language;
    const typo = closestLanguage(word);
    return {
      startLineNumber: fence.lineIndex + 1,
      startColumn: start + 1,
      endLineNumber: fence.lineIndex + 1,
      endColumn: start + word.length + 1,
      severity: monaco.MarkerSeverity.Warning,
      code: fenceMarkerCode,
      message:
        `"${word}" isn't a language the highlighter knows, so this block won't be colored.` +
        (typo ? ` Did you mean ${typo}?` : "") +
        " Use text for a block that is meant to be plain.",
    };
  });
}

/** Quick fixes for the squiggle: the likely typo fix, guesses from the code, and text. */
export function codeFenceQuickFixes(
  model: editor.ITextModel,
  markers: editor.IMarkerData[],
  course: CourseLanguages = {},
): languages.CodeAction[] {
  const lines = model.getLinesContent();
  const fences = findCodeFences(lines);
  return markers
    .filter((m) => m.code === fenceMarkerCode)
    .flatMap((marker) => {
      const fence = fences.find((f) => f.lineIndex === marker.startLineNumber - 1);
      if (!fence?.language) return [];
      const range = {
        startLineNumber: marker.startLineNumber,
        startColumn: fence.language.start + 1,
        endLineNumber: marker.startLineNumber,
        endColumn: fence.language.start + fence.language.word.length + 1,
      };
      const options = [...new Set([...fenceLanguageFixes(lines, fence, course), "text"])];
      return options.map((name, i) => ({
        title: `Change to ${name}`,
        kind: "quickfix",
        diagnostics: [marker],
        isPreferred: i === 0,
        edit: {
          edits: [
            {
              resource: model.uri,
              versionId: model.getVersionId(),
              textEdit: { range, text: name },
            },
          ],
        },
      }));
    });
}

/**
 * The fence whose language slot the cursor is in: after the backticks, before
 * any attribute. With the cursor in front of an attribute (```|hide), a
 * language is inserted there instead of replacing the attribute.
 */
function fenceAtLanguageSlot(lines: string[], position: Position) {
  const fence = findCodeFences(lines).find((f) => f.lineIndex === position.lineNumber - 1);
  if (!fence) return undefined;
  const line = lines[fence.lineIndex];
  const cursor = position.column - 1;
  if (cursor < fence.infoStart) return undefined;
  // only spaces and the start of one word between the fence and the cursor
  const beforeCursor = line.slice(fence.infoStart, cursor);
  if (!/^\s*\S*$/.test(beforeCursor)) return undefined;
  const start = fence.infoStart + (beforeCursor.length - beforeCursor.trimStart().length);
  const word = /^\S*/.exec(line.slice(start))?.[0] ?? "";
  if (isAttribute(word)) {
    // typing inside the attribute itself is not choosing a language
    if (cursor !== start) return undefined;
    return { fence, start, end: start, suffix: " " };
  }
  return { fence, start, end: start + word.length, suffix: "" };
}

/** Language names after an opening fence, the ones guessed from the block's code first. */
export function fenceLanguageCompletions(
  monaco: Monaco,
  model: editor.ITextModel,
  position: Position,
  course: CourseLanguages = {},
): languages.CompletionList | undefined {
  const lines = model.getLinesContent();
  const slot = fenceAtLanguageSlot(lines, position);
  if (!slot) return undefined;
  const fences = findCodeFences(lines);
  const nearby = languagesUsedIn(fences, slot.fence);
  const guesses = guessLanguages(slot.fence.body.join("\n"), { file: nearby, course });
  const nearbyNames = new Set(nearby.map((w) => canonicalLanguage(w) ?? w));
  const range = {
    startLineNumber: position.lineNumber,
    startColumn: slot.start + 1,
    endLineNumber: position.lineNumber,
    endColumn: slot.end + 1,
  };
  const choices = [
    ...languageChoices(),
    { name: "mermaid", title: "Mermaid diagram, drawn as an image", aliases: [] },
  ];
  return {
    suggestions: choices.map((choice) => {
      const guessRank = guesses.indexOf(choice.name);
      const used = nearbyNames.has(choice.name);
      return {
        label: choice.name,
        insertText: choice.name + slot.suffix,
        range,
        kind: monaco.languages.CompletionItemKind.EnumMember,
        // typing an alias finds the language: "cs" finds csharp, "js" javascript
        filterText: [choice.name, ...choice.aliases].join(" "),
        detail:
          guessRank >= 0
            ? `${choice.title} · guessed from the code`
            : used
              ? `${choice.title} · used in this file`
              : choice.title,
        sortText: guessRank >= 0 ? `0${guessRank}` : `${used ? 1 : 2}${choice.name}`,
        preselect: guessRank === 0,
      };
    }),
  };
}

/**
 * Grey ghost text after a bare opening fence with code under it: the language
 * the code looks like, taken with Tab. Ghost text rather than an open list so
 * Enter after ``` still just starts a plain block.
 */
export function fenceLanguageGhostText(
  model: editor.ITextModel,
  position: Position,
  course: CourseLanguages = {},
): languages.InlineCompletions {
  const lines = model.getLinesContent();
  const fence = findCodeFences(lines).find((f) => f.lineIndex === position.lineNumber - 1);
  const line = lines[position.lineNumber - 1] ?? "";
  if (
    !fence ||
    fence.language ||
    line.slice(fence.infoStart).trim() !== "" ||
    position.column - 1 < line.trimEnd().length
  )
    return { items: [] };
  const [guess] = guessLanguages(
    fence.body.join("\n"),
    { file: languagesUsedIn(findCodeFences(lines), fence), course },
    1,
  );
  if (!guess) return { items: [] };
  return {
    items: [
      {
        insertText: guess,
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        },
      },
    ],
  };
}
