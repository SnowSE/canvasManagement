"use client";
import { MonacoEditor } from "@/components/editor/MonacoEditor";
import { EditLayout } from "@/components/EditLayout";
import ClientOnly from "@/components/ClientOnly";
import { RightSingleChevron } from "@/components/icons/RightSingleChevron";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import { useAuthoritativeUpdates } from "@/app/course/[courseName]/utils/useAuthoritativeUpdates";
import { useDelayedSave } from "@/app/course/[courseName]/utils/useDelayedSave";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { fileNameProblem } from "@/features/local/files/localCourseFileModels";
import { useRenameFileMutation } from "@/features/canvas/hooks/canvasCourseFileHooks";
import { RenameItem } from "../../RenameItem";
import { useFileQuery, usePreviewBase, useSaveFileMutation } from "@/features/local/files/fileHooks";
import { courseFilePath, localFileUrl } from "@/services/courseFileLinks";
import { FileIcon } from "./fileKind";
import { FileFooter } from "./FileFooter";

/**
 * A module's file in the editor: its own text and nothing else, saved as
 * typed like any item's. A file that isn't text (an image, a PDF) has no
 * text here and is never written.
 */
export default function EditFile({ moduleName, name }: { moduleName: string; name: string }) {
  const { courseName } = useCourseContext();
  const { data: file, isFetching } = useFileQuery(moduleName, name);
  const save = useSaveFileMutation();
  const renameFile = useRenameFileMutation();
  const itemKey = `file:${moduleName}/${name}`;
  const path = courseFilePath(moduleName, name);
  const saved = file.text;
  const busy = isFetching || save.isPending;
  const { data: settings } = useLocalCourseSettingsQuery();
  const { clientIsAuthoritative, text, textUpdate, textSaved, monacoKey } = useAuthoritativeUpdates({ itemKey, startingText: saved });
  const previewBase = usePreviewBase();

  // the file's text written; on the way out of the file (`leaving`) only that, never the editor's own state, which is the next item's by then
  const saveNow = (leaving: boolean) => {
    if ((!leaving && busy) || !file.isText || text === saved) return;
    if (clientIsAuthoritative) {
      if (!leaving) textSaved(text);
      save.mutate({ courseName, moduleName, name, text });
    } else if (!leaving) textUpdate(saved, true);
  };
  useDelayedSave(itemKey, 500, saveNow, [busy, clientIsAuthoritative, saved, text, textSaved, textUpdate]);

  return (
    <EditLayout
      itemKey={itemKey}
      Header={
        <div className="flex flex-row items-center min-w-0">
          <span className="text-slate-500 cursor-default select-none my-auto">
            <RightSingleChevron />
          </span>
          <div className="w-5 ms-3 max-md:ms-1 shrink-0 my-auto">
            <FileIcon />
          </div>
          <div className="my-auto px-2 max-md:px-1 truncate min-w-10 flex-auto">{name}</div>
        </div>
      }
      HeaderActions={
        <RenameItem
          noun="File"
          type="file"
          moduleName={moduleName}
          name={name}
          rename={(newName) => renameFile(moduleName, name, newName)}
          nameProblem={fileNameProblem}
        />
      }
      Editor={<MonacoEditor key={monacoKey} value={text} onChange={textUpdate} language={languageOf(name)} />}
      Preview={
        <div className="h-full flex flex-col overflow-hidden">
          {!file.isText && <div className="text-slate-400 text-sm p-1">{name} isn&apos;t a text file, so the editor has none of it: change the file itself with the program that made it.</div>}
          {/* the file as saved, loaded again after each save (never per keystroke); sandboxed, as the route serves it */}
          {previewBase && (
            <iframe
              key={saved}
              title={`Preview of ${name}`}
              src={localFileUrl(previewBase, courseName, path)}
              sandbox="allow-scripts allow-forms allow-popups allow-modals"
              className="flex-1 w-full bg-white"
            />
          )}
        </div>
      }
      Footer={settings.canvasId ? <ClientOnly><FileFooter name={name} moduleName={moduleName} /></ClientOnly> : null}
    />
  );
}

// what the editor colours a file as, by the end of its name; any other is plain text
const languages: Record<string, string> = {
  html: "html",
  htm: "html",
  svg: "xml",
  xml: "xml",
  css: "css",
  js: "javascript",
  mjs: "javascript",
  ts: "typescript",
  json: "json",
  md: "markdown",
  py: "python",
  yaml: "yaml",
};
const languageOf = (name: string) => languages[name.split(".").pop()!.toLowerCase()] ?? "plaintext";
