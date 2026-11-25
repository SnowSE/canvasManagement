"use client";
import { Dispatch, SetStateAction, useCallback, DragEvent } from "react";
import { DraggableItem } from "./draggingContext";
import { useSaveMovedItem } from "./useSaveMovedItem";

export function useItemDropOnModule({
  setIsDragging,
}: {
  setIsDragging: Dispatch<SetStateAction<boolean>>;
}) {
  const saveMoved = useSaveMovedItem();

  return useCallback(
    (e: DragEvent, dropModuleName: string) => {
      const rawData = e.dataTransfer.getData("draggableItem");
      if (!rawData) return;
      const { type, item, sourceModuleName }: DraggableItem = JSON.parse(rawData);
      // a lecture has no module: it drops on days only
      if (type !== "lecture" && sourceModuleName) saveMoved(type, item, sourceModuleName, dropModuleName);
      setIsDragging(false);
    },
    [saveMoved, setIsDragging],
  );
}
