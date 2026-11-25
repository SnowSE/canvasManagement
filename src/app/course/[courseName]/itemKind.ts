import type { FC } from "react";
import type { ModalControl } from "@/components/Modal";
import type { CourseItemType } from "@/features/local/course/courseItemTypes";
import type { IModuleItem } from "@/features/local/modules/IModuleItem";
import type { ItemSyncStatus } from "./calendar/day/getAssignmentSyncStatus";

export type ItemRef = { item: IModuleItem; moduleName: string };

/**
 * What a kind of item is and does, for the pages that show any item (the
 * calendar, the module list, the panes): each kind says it in one place,
 * its own file, and those pages ask the table (itemKinds) instead of
 * knowing the kinds by name. A part that is optional is one a kind may not
 * have, and then isn't offered. How a kind is shown is said apart from this
 * (ItemKindViews), so the parts of a view can ask what its kind is.
 */
export interface ItemKindDef {
  Icon: FC;
  /** The type of the markdown file it is parsed from, which is what has a raw text to fix and a history. */
  markdown?: CourseItemType;
  /** For a kind whose items have no day and are in no Canvas module: the module list shows them after its dated items, under this title. */
  undated?: { title: string; hint: string };
  /** A module's items of the kind. */
  useModuleItems(moduleName: string): IModuleItem[];
  /** How one stands against Canvas; nothing until Canvas has answered. */
  useStatusOf(): ((item: IModuleItem, moduleName: string) => ItemSyncStatus) | undefined;
  /** Add to Canvas, or update there. */
  useSendToCanvas(): (ref: ItemRef) => Promise<unknown>;
  /** Publishes the one Canvas has under this id. */
  usePublish(): (canvasItemId: number) => Promise<unknown>;
  /** Reads that one from Canvas again, for the app to know what changed there. */
  useRefresh(): (canvasItemId: number) => Promise<unknown>;
  /** Delete from Canvas one that is there unpublished; anything else is refused. */
  useRemoveUnpublished(): (ref: ItemRef) => Promise<unknown>;
  /** Saves one as a drop left it: `item` in module `to`, having been in `from`. */
  useSaveMoved(): (item: IModuleItem, from: string, to: string) => void;
}

/** How a kind of item is shown (see itemKindViews). */
export interface ItemKindViews {
  Editor: FC<{ moduleName: string; name: string }>;
  /** Its right-click menu, built when it opens. */
  Menu: FC<{ modalControl: ModalControl; item: IModuleItem; moduleName: string; differenceCount: number }>;
  /** What hovering one that is in sync shows. */
  Preview?: FC<{ item: IModuleItem }>;
  /** Its Compare with Canvas pane. */
  Compare?: FC<{ moduleName: string; name: string }>;
}

/** For a kind's own refusal: only an item that is in Canvas unpublished may be deleted from there. */
export const unpublishedOnly = <T extends { published?: boolean }>(inCanvas: T | undefined, name: string) => {
  if (!inCanvas || inCanvas.published) throw new Error(`${name} isn't unpublished in Canvas, so it stays`);
  return inCanvas;
};
