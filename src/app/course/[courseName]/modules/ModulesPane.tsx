"use client";
import { PaneHeader } from "@/components/panes/PaneHeader";
import { usePersistedScroll } from "@/components/usePersistedScroll";
import { useCourseContext } from "../context/courseContext";
import ModuleList from "./ModuleList";
import { ModuleSelectionProvider, useModuleSelection } from "./bulk/moduleSelection";
import { BulkBar } from "./bulk/BulkBar";

/** The module list, with its search and filters in a pinned header; the scroll is remembered per course. */
export function ModulesContent() {
  const { courseName } = useCourseContext();
  // after the remembered modules have re-expanded (and their open animation)
  const scrollRef = usePersistedScroll(`moduleListScroll-${courseName}`, 500);
  return (
    <ModuleSelectionProvider>
      <div ref={scrollRef} className="h-full overflow-y-auto text-sm leading-relaxed pe-2 pb-6">
        <ModulesHeader />
        <ModuleList />
      </div>
    </ModuleSelectionProvider>
  );
}

function ModulesHeader() {
  const { setAllOpen, search, setSearch } = useModuleSelection();
  return (
    <PaneHeader
      pin={{ key: "modules-header", label: "the module search and filters" }}
      setAllOpen={setAllOpen}
      search={{ label: "Search modules", value: search, onChange: setSearch }}
    >
      <BulkBar />
    </PaneHeader>
  );
}
