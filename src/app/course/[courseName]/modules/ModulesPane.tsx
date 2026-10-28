"use client";
import { PaneHeader, SidePane } from "@/components/SidePane";
import { usePersistedScroll } from "@/components/usePersistedScroll";
import { usePersistedToggle } from "@/components/storage";
import { useCourseContext } from "../context/courseContext";
import ModuleList from "./ModuleList";
import { ModuleSelectionProvider, useModuleSelection } from "./bulk/moduleSelection";

const openKey = "modulesOpen";

/** Shown or hidden by the Modules toggle; a narrow window starts with it hidden. */
export function useModulesOpen() {
  return usePersistedToggle(openKey, () => window.innerWidth > 1400, true);
}

/** The module list beside the page, framed like the editor's help. */
export function ModulesPane({ hidden = false, onHide }: { hidden?: boolean; onHide?: () => void }) {
  const { courseName } = useCourseContext();
  // after the remembered modules have re-expanded (and their open animation)
  const scrollRef = usePersistedScroll(`moduleListScroll-${courseName}`, 500);
  return (
    <ModuleSelectionProvider>
      <SidePane
        storageKey="modulesWidth"
        label="modules"
        bodyRef={scrollRef}
        hidden={hidden}
        onHide={onHide}
      >
        <div className="text-sm leading-relaxed pe-2 pb-6">
          <ModulesHeader />
          <ModuleList />
        </div>
      </SidePane>
    </ModuleSelectionProvider>
  );
}

function ModulesHeader() {
  const { setAllOpen, search, setSearch } = useModuleSelection();
  return (
    <PaneHeader
      title="Modules"
      setAllOpen={setAllOpen}
      search={{ label: "Search modules", value: search, onChange: setSearch }}
    />
  );
}
