"use client";
import { CurrentItem } from "../currentItem";
import EditAssignment from "../modules/[moduleName]/assignment/[assignmentName]/EditAssignment";
import EditQuiz from "../modules/[moduleName]/quiz/[quizName]/EditQuiz";
import EditPage from "../modules/[moduleName]/page/[pageName]/EditPage";
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
  return (
    <UnparsableItemFallback moduleName={moduleName} type={type} name={name} loading={<LoadingItem />}>
      {type === "Assignment" && <EditAssignment moduleName={moduleName} assignmentName={name} />}
      {type === "Quiz" && <EditQuiz moduleName={moduleName} quizName={name} />}
      {type === "Page" && <EditPage moduleName={moduleName} pageName={name} />}
    </UnparsableItemFallback>
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
