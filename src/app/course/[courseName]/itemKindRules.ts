import type { IModuleItem } from "@/features/local/modules/IModuleItem";
import type { ItemSyncStatus } from "./calendar/day/getAssignmentSyncStatus";
import type { ItemKindDef } from "./itemKind";

// What the pages that show any item do with the kinds, whatever the kinds
// are: each rule takes what the kinds say (see ItemKindDef) and names none.

/** Before Canvas has answered: nothing is claimed. */
export const CHECKING: ItemSyncStatus = {
  status: "localOnly",
  message: "Checking Canvas…",
  differences: [],
};

/**
 * How items stand against Canvas, from what each kind's own comparison is
 * (see ItemKindDef.useStatusOf): an item's standing is its kind's word, and
 * nothing is claimed of it until Canvas has answered for its kind. `ready`
 * once it has for every kind.
 */
export const statusesOf = <K extends string>(statusOfKind: Record<K, ReturnType<ItemKindDef["useStatusOf"]>>) => ({
  ready: Object.values(statusOfKind).every(Boolean),
  statusOf: (type: K, item: IModuleItem, moduleName: string) => statusOfKind[type]?.(item, moduleName) ?? CHECKING,
});
