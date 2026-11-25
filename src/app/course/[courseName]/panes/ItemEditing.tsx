"use client";
import { CurrentItem } from "../currentItem";
import { itemKinds } from "../itemKinds";
import { itemKindViews } from "../itemKindViews";
import EditLecture from "../lecture/[lectureDay]/EditLecture";
import { UnparsableItemFallback } from "../modules/[moduleName]/unparsable/UnparsableItemFallback";
import { SuspenseAndErrorHandling } from "@/components/SuspenseAndErrorHandling";
import { Spinner } from "@/components/Spinner";
import { usePublishItemParts } from "./itemParts";

/**
 * The editing of the item open, rendered by the frame beside its panes (not
 * above them: the editor's own loading and fallbacks must not blank the
 * panes). It renders nothing itself; the page hands its parts to the panes
 * and bars through itemParts. The same editor is kept from item to item of
 * a kind, as the routes kept it.
 */
export function ItemEditing({ item }: { item?: CurrentItem }) {
  if (!item) return <NoItem />;
  if (item.kind === "lecture")
    return (
      <SuspenseAndErrorHandling fallback={<LoadingItem />}>
        <EditLecture lectureDay={item.lectureDay} />
      </SuspenseAndErrorHandling>
    );
  const { moduleName, type, name } = item;
  const kind = itemKinds[type];
  if (!kind) return <NoItem />;
  const { Editor } = itemKindViews[type];
  const editor = <Editor moduleName={moduleName} name={name} />;
  // a markdown file that can't be parsed is fixed as its raw text
  return kind.markdown ? (
    <UnparsableItemFallback moduleName={moduleName} type={kind.markdown} name={name} loading={<LoadingItem />}>
      {editor}
    </UnparsableItemFallback>
  ) : (
    <SuspenseAndErrorHandling fallback={<LoadingItem />}>{editor}</SuspenseAndErrorHandling>
  );
}

function NoItem() {
  usePublishItemParts(undefined);
  return null;
}

// while the item loads (its first open; later ones start from the module's
// list), the Editor pane shows a spinner where the editor will be
function LoadingItem() {
  usePublishItemParts({ key: "loading", topBar: null, bottomBar: null, editor: <Spinner />, preview: null });
  return null;
}
