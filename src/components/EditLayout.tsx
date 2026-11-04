"use client";
import { FC, ReactNode } from "react";
import { MobileActionsMenu } from "./MobileActionsMenu";
import { usePublishItemParts } from "@/app/course/[courseName]/panes/itemParts";

/** An item's page: its crumbs and actions for the top bar, its footer for the bottom bar, and what its Editor and Preview panes show; handed to the frame (see itemParts), nothing rendered here. */
export const EditLayout: FC<{
  /** Which item this is: the editor starts afresh when it changes. */
  itemKey: string;
  Header: ReactNode;
  HeaderActions?: ReactNode;
  Editor: ReactNode;
  Preview: ReactNode;
  Footer: ReactNode;
}> = ({ itemKey, Header, HeaderActions, Editor, Preview, Footer }) => {
  usePublishItemParts({
    key: itemKey,
    topBar: (
      <>
        <div className="min-w-0 flex-auto">{Header}</div>
        <div className="flex-none ms-auto flex flex-row items-center gap-2">
          {HeaderActions && <div className="max-md:hidden flex-none px-1">{HeaderActions}</div>}
          <MobileActionsMenu>
            {HeaderActions && <div>{HeaderActions}</div>}
            {Footer}
          </MobileActionsMenu>
        </div>
      </>
    ),
    bottomBar: <div className="max-md:hidden">{Footer}</div>,
    editor: Editor,
    preview: Preview,
  });
  return null;
};
