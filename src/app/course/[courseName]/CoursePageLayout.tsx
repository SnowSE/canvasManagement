"use client";
import { createContext, ReactNode, useContext, useState } from "react";
import { createPortal } from "react-dom";
import { useMatches } from "@tanstack/react-router";
import { PaneHideProvider, PaneToggle, SidePane } from "@/components/SidePane";
import { usePersistedToggle } from "@/components/storage";
import { HelpIcon, ModulesIcon } from "@/components/icons/ActionIcons";
import { ModulesPane, useModulesOpen } from "./modules/ModulesPane";
import { BreadCrumbs } from "@/components/BreadCrumbs";
import { useCourseContext } from "./context/courseContext";

// The frame is mounted once, above every page, so a page can't render into
// the frame's top bar or help pane directly: it portals into these slots,
// which the frame fills in once its elements exist.
const SlotsContext = createContext<{
  topBar: HTMLElement | null;
  help: HTMLElement | null;
  hideHelp?: () => void;
}>({ topBar: null, help: null });

/**
 * Mounted once per course, around every page: a top bar that starts with the
 * Modules and Help toggles, then the open panes beside the page. Living here
 * and not in the pages, the modules keep their scroll and open modules from
 * page to page, and showing them again is instant. A route whose page has
 * help says so with `staticData: { help: true }`.
 */
export function CourseFrame({ children }: { children: ReactNode }) {
  const { courseName } = useCourseContext();
  const [modulesOpen, toggleModules] = useModulesOpen();
  const [helpOpen, toggleHelp] = usePersistedToggle("editorHelpOpen", () => false);
  // cast rather than augmenting the router's StaticDataRouteOption type: one
  // flag doesn't earn a global declaration
  const hasHelp = useMatches().some((m) => (m.staticData as { help?: boolean }).help);
  const [topBar, setTopBar] = useState<HTMLElement | null>(null);
  const [help, setHelp] = useState<HTMLElement | null>(null);
  // the modules are built the first time they're shown, then kept
  const [modulesMounted, setModulesMounted] = useState(modulesOpen);
  if (modulesOpen && !modulesMounted) setModulesMounted(true);

  return (
    <SlotsContext.Provider value={{ topBar, help, hideHelp: toggleHelp }}>
      <div className="h-full flex flex-col px-1 max-w-[2400px] w-full mx-auto bg-gray-900 rounded">
        <div className="py-1 flex flex-row flex-wrap md:flex-nowrap items-center gap-x-2 gap-y-1">
          {hasHelp && (
            <PaneToggle icon={<HelpIcon />} label="Help" open={helpOpen} onToggle={toggleHelp} />
          )}
          {/* Help, home, Modules, the course, then the page's own crumbs */}
          <BreadCrumbs
            afterHome={
              <PaneToggle
                icon={<ModulesIcon />}
                label="Modules"
                open={modulesOpen}
                onToggle={toggleModules}
              />
            }
          />
          {/* display: contents, so the page's crumbs lay out as items of this bar */}
          <div ref={setTopBar} className="contents" />
        </div>
        <div className="min-h-0 flex-1 flex md:flex-row max-md:flex-col">
          {/* panes in the order of their buttons: help, then modules */}
          {hasHelp && helpOpen && (
            <SidePane storageKey="editorHelpWidth" label="help">
              <div ref={setHelp} />
            </SidePane>
          )}
          {/* keyed so a course picked from the menu starts its own selection and search */}
          {modulesMounted && (
            <ModulesPane key={courseName} hidden={!modulesOpen} onHide={toggleModules} />
          )}
          {/* the page fills the rest; it needn't know it's beside the panes */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col">{children}</div>
        </div>
      </div>
    </SlotsContext.Provider>
  );
}

/**
 * A course page: its top bar and help go to the frame's slots (see
 * SlotsContext), the rest renders here, beside the panes.
 */
export function CoursePageLayout({
  topBar,
  help,
  children,
}: {
  topBar: ReactNode;
  help?: ReactNode;
  children: ReactNode;
}) {
  const slots = useContext(SlotsContext);
  return (
    <>
      {slots.topBar && createPortal(topBar, slots.topBar)}
      {help &&
        slots.help &&
        createPortal(<PaneHideProvider hide={slots.hideHelp}>{help}</PaneHideProvider>, slots.help)}
      {children}
    </>
  );
}
