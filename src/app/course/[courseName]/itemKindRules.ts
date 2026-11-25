import type { IModuleItem } from "@/features/local/modules/IModuleItem";
import { byOrderingDate } from "@/features/local/modules/moduleItemOrder";
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
 * A module's items for its list: those of kinds with a day (`dated`), in
 * date order, which is what Canvas's module holds; and, apart, those of
 * each kind with no day (`listed`), under the kind's title.
 */
export const arrangeItems = <K extends string, I extends { type: K; item: IModuleItem }>(items: I[], kinds: Record<K, Pick<ItemKindDef, "undated">>) => ({
  dated: items.filter((i) => !kinds[i.type].undated).sort((a, b) => byOrderingDate(a.item, b.item)),
  listed: (Object.keys(kinds) as K[]).flatMap((type) => {
    const { undated } = kinds[type];
    const ofKind = items.filter((i) => i.type === type);
    return undated && ofKind.length > 0 ? [{ type, ...undated, items: ofKind }] : [];
  }),
});

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
