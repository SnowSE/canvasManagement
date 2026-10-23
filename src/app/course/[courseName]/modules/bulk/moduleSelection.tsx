"use client";
import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { IModuleItem } from "@/features/local/modules/IModuleItem";
import { ItemType } from "../../calendar/day/useItemSyncStatus";
import { Kind, toggleAll } from "./rules";

export interface ModuleItemRef {
  type: ItemType;
  item: IModuleItem;
  moduleName: string;
}
export const keyOf = ({ type, item, moduleName }: ModuleItemRef) =>
  `${type}/${moduleName}/${item.name}`;

// The items checked in the module list, the filters on what it shows, and
// what each module shows (so "select all visible" covers every module).
// Opening every module is a request each module answers itself;
// right-clicking a checked item opens the menu for all checked items.
function useSelectionState() {
  const [selected, setSelected] = useState<Record<string, ModuleItemRef>>({});
  const [filters, setFilters] = useState<Kind[]>([]);
  const [visibleBy, setVisibleBy] = useState<Record<string, ModuleItemRef[]>>({});
  // every kind each module's items match: a filter with nothing to show is
  // replaced by "All Synced" and the like, and counts as off if it was on
  const [kindsBy, setKindsBy] = useState<Record<string, Kind[]>>({});
  const present = Object.values(kindsBy).flat();
  // using a filter or "select all shown" opens every module, to show them
  const [expandRequests, setExpandRequests] = useState(0);
  const expandAll = () => setExpandRequests((n) => n + 1);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number }>();
  const visible = Object.values(visibleBy).flat();
  const isSelected = (ref: ModuleItemRef) => keyOf(ref) in selected;
  return {
    selected: Object.values(selected),
    isSelected,
    toggle: (ref: ModuleItemRef) =>
      setSelected(({ [keyOf(ref)]: was, ...rest }) =>
        was ? rest : { ...rest, [keyOf(ref)]: ref },
      ),
    set: (refs: ModuleItemRef[]) =>
      setSelected(Object.fromEntries(refs.map((r) => [keyOf(r), r]))),
    filters: filters.filter((k) => present.includes(k)),
    present,
    toggleFilter: (kind: Kind) => {
      expandAll();
      setFilters((f) => (f.includes(kind) ? f.filter((k) => k !== kind) : [...f, kind]));
    },
    report: useCallback((moduleName: string, refs: ModuleItemRef[], itemKinds: Kind[]) => {
      setVisibleBy((v) => ({ ...v, [moduleName]: refs }));
      setKindsBy((k) => ({ ...k, [moduleName]: itemKinds }));
    }, []),
    visible,
    toggleVisible: () => {
      expandAll();
      setSelected((s) => toggleAll(s, Object.fromEntries(visible.map((r) => [keyOf(r), r]))));
    },
    expandRequests,
    menuAt,
    openMenu: setMenuAt,
    closeMenu: () => setMenuAt(undefined),
  };
}

const ModuleSelectionContext = createContext<ReturnType<typeof useSelectionState> | undefined>(
  undefined,
);

export function ModuleSelectionProvider({ children }: { children: ReactNode }) {
  return (
    <ModuleSelectionContext.Provider value={useSelectionState()}>
      {children}
    </ModuleSelectionContext.Provider>
  );
}

export function useModuleSelection() {
  const selection = useContext(ModuleSelectionContext);
  if (!selection) throw new Error("useModuleSelection needs a ModuleSelectionProvider");
  return selection;
}
