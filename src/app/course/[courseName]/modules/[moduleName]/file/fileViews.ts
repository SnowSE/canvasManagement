import type { ItemKindViews } from "../../../itemKind";
import EditFile from "./EditFile";
import { FileContextMenu } from "./FileContextMenu";

/** How a file is shown (see itemKindViews): edited as its own text, with no Compare pane and nothing to show on hover. */
export const fileViews: ItemKindViews = {
  Editor: EditFile,
  Menu: FileContextMenu,
};
