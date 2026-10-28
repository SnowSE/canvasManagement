"use client";
import { FC, ReactNode, useRef, useState } from "react";
import { MobileActionsMenu } from "./MobileActionsMenu";
import { jumpToClickedText } from "./editor/previewJump";
import { clamp, ResizeHandle } from "./ResizeHandle";
import { CoursePageLayout } from "@/app/course/[courseName]/CoursePageLayout";

const previewSplitStorageKey = "editorPreviewSplit";

export const EditLayout: FC<{
  Header: ReactNode;
  HeaderActions?: ReactNode;
  Help?: ReactNode;
  Editor: ReactNode;
  Preview: ReactNode;
  Footer: ReactNode;
}> = ({
  Header,
  HeaderActions,
  Help,
  Editor,
  Preview,
  Footer,
}) => {
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const toggleButtonClass = (active: boolean) =>
    "unstyled btn-thin px-2 py-0.5 text-sm " +
    (active ? "bg-blue-900/80 text-blue-50" : "bg-transparent text-slate-400");

  const topBar = (
    <>
      <div className="min-w-0 flex-auto">{Header}</div>
      <div className="flex-none ms-auto flex flex-row items-center gap-2">
        <div className="md:hidden flex-none flex flex-row rounded border border-blue-900 overflow-hidden">
          <button
            className={toggleButtonClass(mobileView === "edit")}
            onClick={() => setMobileView("edit")}
          >
            Edit
          </button>
          <button
            className={toggleButtonClass(mobileView === "preview")}
            onClick={() => setMobileView("preview")}
          >
            Preview
          </button>
        </div>
        {HeaderActions && (
          <div className="max-md:hidden flex-none px-1">{HeaderActions}</div>
        )}
        <MobileActionsMenu>
          {HeaderActions && <div>{HeaderActions}</div>}
          {Footer}
        </MobileActionsMenu>
      </div>
    </>
  );

  return (
    <CoursePageLayout topBar={topBar} help={Help}>
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <div
          ref={bodyRef}
          className="min-h-0 flex flex-row max-md:flex-col w-full flex-grow"
        >
          <div
            ref={editorRef}
            className={
              "flex-1 md:flex-[var(--editor-fr,1)_1_0%] h-full min-w-0 " +
              (mobileView === "edit" ? "" : "max-md:hidden")
            }
          >
            {Editor}
          </div>
          <ResizeHandle
            axis="col"
            className="max-md:hidden"
            target={bodyRef}
            storageKey={previewSplitStorageKey}
            size={(e, rect) => {
              const left = editorRef.current?.getBoundingClientRect().left ?? rect.left;
              return clamp((e.clientX - left) / (rect.right - left || 1), 0.15, 0.85);
            }}
            apply={(body, fraction) => {
              body.style.setProperty("--editor-fr", String(fraction));
              body.style.setProperty("--preview-fr", String(1 - fraction));
            }}
            label="resize editor and preview"
          />
          <div
            className={
              "flex-1 md:flex-[var(--preview-fr,1)_1_0%] h-full min-w-0 max-md:overflow-y-auto " +
              (mobileView === "preview" ? "" : "max-md:hidden")
            }
            // clicking text in the preview moves the editor to it
            onClick={(e) => jumpToClickedText(e.currentTarget, e.nativeEvent)}
          >
            {Preview}
          </div>
        </div>
        <div className="max-md:hidden">{Footer}</div>
      </div>
    </CoursePageLayout>
  );
};
