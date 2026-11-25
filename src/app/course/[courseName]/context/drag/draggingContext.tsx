"use client";
import { ItemKind } from "@/features/local/course/courseItemTypes";
import { IModuleItem } from "@/features/local/modules/IModuleItem";
import { createContext, useContext, DragEvent } from "react";

export interface DraggableItem {
  item: IModuleItem;
  sourceModuleName: string | undefined; // undefined for lectures
  type: ItemKind | "lecture";
  // when dragging one batch of an assignment's Schedule: that batch's date
  scheduleDate?: string;
}

export interface DraggingContextInterface {
  itemDropOnDay: (e: DragEvent, droppedOnDay: string) => void;
  itemDropOnModule: (e: DragEvent, moduleName: string) => void;
}
export const DraggingContext =
  createContext<DraggingContextInterface>({
  itemDropOnDay: () => {},
  itemDropOnModule: () => {},
});

export function useDraggingContext() {
  return useContext(DraggingContext);
}
