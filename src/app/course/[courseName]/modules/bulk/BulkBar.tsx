"use client";
import { ReactNode, useState } from "react";
import Modal, { ModalControl, useModal } from "@/components/Modal";
import { showErrorToast } from "@/app/MyToaster";
import { useItemSyncStatus } from "../../calendar/day/useItemSyncStatus";
import { kinds, updateEach } from "./rules";
import { keyOf, ModuleItemRef, useModuleSelection } from "./moduleSelection";
import { useAddOrUpdateInCanvas, useRemoveUnpublishedFromCanvas } from "./canvasActions";
import { ReviewDialog } from "./ReviewDialog";

const BarButton = (props: { onClick: () => void; children: ReactNode }) => (
  <button className="unstyled btn-outline" {...props} />
);
const menuButton = "unstyled font-bold text-left py-1 px-2 rounded border";
const normal = `${menuButton} bg-blue-900/50 hover:bg-blue-900 text-blue-50 border-blue-800/70`;
const danger = `${menuButton} bg-rose-900/30 hover:bg-rose-950 text-rose-50 border-rose-900/40`;

/**
 * Above the module list: select everything shown, filter what is shown,
 * and the right-click menu for the checked items.
 */
export function BulkBar() {
  const selection = useModuleSelection();
  const addOrUpdate = useAddOrUpdateInCanvas();
  const removeUnpublished = useRemoveUnpublishedFromCanvas();
  const { statusOf } = useItemSyncStatus();
  const review = useModal();
  const [reviewing, setReviewing] = useState<ModuleItemRef[]>([]);
  const [progress, setProgress] = useState<string>();

  const { selected, visible } = selection;
  const unpublished = selected.filter((r) => statusOf(r.type, r.item, r.moduleName).unpublished);
  const names = (refs: ModuleItemRef[]) => refs.map((r) => r.item.name).join(", ");
  const visibleChecked = visible.filter(selection.isSelected).length;

  // one item at a time; the ones that fail stay checked, to try again
  const run = async (doing: string, refs: ModuleItemRef[], action: (r: ModuleItemRef) => Promise<unknown>) => {
    const show = (done: number) => setProgress(`${doing} ${done + 1} of ${refs.length}…`);
    show(0);
    const failed = await updateEach(refs, action, (done) => done < refs.length && show(done));
    setProgress(undefined);
    const done = new Set(refs.filter((r) => !failed.includes(r)).map(keyOf));
    selection.set(selected.filter((r) => !done.has(keyOf(r))));
    if (failed.length > 0) showErrorToast(`Couldn't finish ${doing.toLowerCase()} ${names(failed)}`);
  };

  // the right-click menu of a checked item, for every checked item; no
  // publishing, and only unpublished items can be removed
  const menu: ModalControl = {
    isOpen: !!selection.menuAt,
    position: selection.menuAt,
    openModal: (at) => selection.openMenu(at),
    closeModal: selection.closeMenu,
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
      <input
        type="checkbox"
        aria-label="Select all shown"
        title="Select all shown, or clear them when they're all selected"
        ref={(box) => {
          if (box) box.indeterminate = visibleChecked > 0 && visibleChecked < visible.length;
        }}
        checked={visible.length > 0 && visibleChecked === visible.length}
        onChange={selection.toggleVisible}
      />
      {/* show only the items matching any filter that's on */}
      {kinds.map(({ kind, label }) => (
        <button
          key={kind}
          aria-pressed={selection.filters.includes(kind)}
          className={selection.filters.includes(kind) ? "btn" : "unstyled btn-outline"}
          onClick={() => selection.toggleFilter(kind)}
        >
          {label}
        </button>
      ))}
      {progress ? (
        <span className="text-slate-300">{progress}</span>
      ) : (
        selected.length > 0 && (
          <>
            <span className="text-slate-300">{selected.length} selected (right-click one)</span>
            <BarButton onClick={() => selection.set([])}>Clear</BarButton>
          </>
        )
      )}
      <Modal modalControl={menu} backgroundCoverColor="bg-black/30">
        {({ closeModal }) => (
          <div className="p-2 flex flex-col gap-2">
            <div className="text-center p-1 text-slate-200">{selected.length} selected</div>
            <button
              className={normal}
              onClick={() => {
                closeModal();
                setReviewing(selected);
                review.openModal();
              }}
            >
              Review and add/update {selected.length} in Canvas…
            </button>
            {unpublished.length > 0 && (
              <button
                className={danger}
                onClick={() => {
                  closeModal();
                  if (
                    window.confirm(
                      `Remove ${unpublished.length} unpublished from Canvas? Students can't see them, and their files stay.\n\n${names(unpublished)}`,
                    )
                  )
                    run("Removing", unpublished, removeUnpublished);
                }}
              >
                Remove {unpublished.length} unpublished from Canvas
              </button>
            )}
          </div>
        )}
      </Modal>
      <ReviewDialog
        control={review}
        items={reviewing}
        selectedCount={selected.length}
        onSend={() => run("Adding/updating", selected, addOrUpdate)}
      />
    </div>
  );
}
