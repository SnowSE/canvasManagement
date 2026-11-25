"use client";
import type { FC } from "react";
import type { ItemKind } from "@/features/local/course/courseItemTypes";
import type { ItemKindDef } from "./itemKind";
import { assignmentKind } from "./modules/[moduleName]/assignment/assignmentKind";
import { quizKind } from "./modules/[moduleName]/quiz/quizKind";
import { pageKind } from "./modules/[moduleName]/page/pageKind";

/** Every kind of item, by its name (which is also its word in the app's urls). */
export const itemKinds: Record<ItemKind, ItemKindDef> = {
  assignment: assignmentKind,
  quiz: quizKind,
  page: pageKind,
};

/**
 * What one of the kinds' hooks gives, by kind: `use` is called for every
 * kind, in the table's order, which never changes, so each render calls the
 * same hooks in the same order.
 */
export const useEachKind = <T,>(use: (kind: ItemKindDef) => T) =>
  Object.fromEntries(Object.entries(itemKinds).map(([name, kind]) => [name, use(kind)])) as Record<ItemKind, T>;

/** A module's items of every kind. */
export const useModuleItems = (moduleName: string) =>
  Object.entries(useEachKind((kind) => kind.useModuleItems(moduleName))).flatMap(([type, items]) => items.map((item) => ({ type: type as ItemKind, item })));

/** A kind's icon by the kind's name; nothing for a name that is no kind's. */
export const ItemTypeIcon: FC<{ type: string }> = ({ type }) => {
  const Icon = itemKinds[type as ItemKind]?.Icon;
  return Icon ? <Icon /> : null;
};
