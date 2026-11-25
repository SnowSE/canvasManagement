"use client";
import { ItemKind } from "@/features/local/course/courseItemTypes";
import { IModuleItem } from "@/features/local/modules/IModuleItem";
import { useEachKind } from "../../itemKinds";

/**
 * Saves a module's item as a drop left it: `item` (with the dates it has
 * now) in module `to`, having been in `from`, as its kind saves it (see
 * itemKinds); the drop handlers don't know how.
 */
export function useSaveMovedItem() {
  const save = useEachKind((kind) => kind.useSaveMoved());
  return (type: ItemKind, item: IModuleItem, from: string, to: string) => save[type](item, from, to);
}
