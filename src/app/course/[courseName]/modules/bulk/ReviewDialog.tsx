"use client";
import Modal, { ModalControl } from "@/components/Modal";
import { useItemSyncStatus } from "../../calendar/day/useItemSyncStatus";
import { SyncDifferencesTooltip } from "../../calendar/day/itemInDay/SyncDifferencesTooltip";
import { keyOf, ModuleItemRef, useModuleSelection } from "./moduleSelection";

/**
 * Before adding or updating the checked items: what each will change, as in
 * the items' hover cards, with links to their compare pages, and a checkbox
 * to leave any out. `items` is what was checked when it opened, so one
 * unchecked here stays in the list.
 */
export function ReviewDialog({
  control,
  items,
  selectedCount,
  onSend,
}: {
  control: ModalControl;
  items: ModuleItemRef[];
  selectedCount: number;
  onSend: () => void;
}) {
  const { statusOf } = useItemSyncStatus();
  return (
    <Modal modalControl={control} modalWidth="w-150">
      {({ closeModal }) => (
        <div className="flex flex-col gap-3 max-h-[70vh]">
          <div className="overflow-y-auto flex flex-col gap-3">
            {items.map((ref) => (
              <ReviewedItem key={keyOf(ref)} item={ref} status={statusOf(ref.type, ref.item, ref.moduleName)} />
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button className="unstyled btn-outline" onClick={closeModal}>
              Cancel
            </button>
            <button
              className="btn"
              disabled={selectedCount === 0}
              onClick={() => {
                closeModal();
                onSend();
              }}
            >
              Add/update {selectedCount} in Canvas
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// one item in the review: its checkbox and what differs
function ReviewedItem({
  item: ref,
  status,
}: {
  item: ModuleItemRef;
  status: ReturnType<ReturnType<typeof useItemSyncStatus>["statusOf"]>;
}) {
  const selection = useModuleSelection();
  return (
    <label className="flex items-start gap-2">
      <input
        type="checkbox"
        className="mt-1 flex-none"
        checked={selection.isSelected(ref)}
        onChange={() => selection.toggle(ref)}
      />
      {status.status === "localOnly" ? (
        <div>
          <span className="font-bold">{ref.item.name}</span>: not in Canvas yet, will be added
        </div>
      ) : status.differences.length > 0 ? (
        <SyncDifferencesTooltip
          type={ref.type}
          moduleName={ref.moduleName}
          itemName={ref.item.name}
          {...status}
          rightClickHint={false}
        />
      ) : (
        <div>
          <span className="font-bold">{ref.item.name}</span>: no differences
        </div>
      )}
    </label>
  );
}
