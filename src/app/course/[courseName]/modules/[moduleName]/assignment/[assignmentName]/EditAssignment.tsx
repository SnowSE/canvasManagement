"use client";
import { useDelayedSave } from "@/app/course/[courseName]/utils/useDelayedSave";
import { MonacoEditor } from "@/components/editor/MonacoEditor";
import {
  LocalAssignment,
  localAssignmentMarkdown,
} from "@/features/local/assignments/models/localAssignment";
import { useMemo, useState } from "react";
import AssignmentPreview from "./AssignmentPreview";
import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import ClientOnly from "@/components/ClientOnly";
import { SuspenseAndErrorHandling } from "@/components/SuspenseAndErrorHandling";
import { AssignmentFooterButtons } from "./AssignmentFooterButtons";
import { parsedOrNothing, useSettledText } from "@/app/course/[courseName]/utils/draft";
import { useAuthoritativeUpdates } from "@/app/course/[courseName]/utils/useAuthoritativeUpdates";
import EditAssignmentHeader from "./EditAssignmentHeader";
import { UpdateAssignmentName } from "./UpdateAssignmentName";
import { EditLayout } from "@/components/EditLayout";
import {
  useAssignmentQuery,
  useUpdateAssignmentMutation,
} from "@/features/local/assignments/assignmentHooks";

export default function EditAssignment({
  moduleName,
  assignmentName,
}: {
  assignmentName: string;
  moduleName: string;
}) {
  const { courseName } = useCourseContext();
  const { data: assignment, isFetching: assignmentIsFetching } = useAssignmentQuery(
    moduleName,
    assignmentName,
  );
  const updateAssignment = useUpdateAssignmentMutation();

  const { clientIsAuthoritative, text, textUpdate, textSaved, monacoKey } =
    useAuthoritativeUpdates({
      itemKey: `assignment:${moduleName}/${assignmentName}`,
      startingText: localAssignmentMarkdown.toMarkdown(assignment),
    });

  const [error, setError] = useState("");
  // the footer compares what is typed, ahead of the save; deferred so typing stays smooth
  const settledText = useSettledText(text, `${moduleName}/${assignmentName}`);
  const draft = useMemo(
    () => (settledText === undefined ? undefined : parsedOrNothing(() => localAssignmentMarkdown.parseMarkdown(settledText, assignmentName))),
    [settledText, assignmentName],
  );

  // the item's text written to its file; on the way out of the item (`leaving`) only that, never the editor's own state, which is the next item's by then
  const save = (leaving: boolean) => {
    try {
      if (!leaving && (assignmentIsFetching || updateAssignment.isPending)) {
        console.log("network requests in progress, not updating assignments");
        return;
      }

      // make separate way to update name?
      const updatedAssignment: LocalAssignment =
        localAssignmentMarkdown.parseMarkdown(text, assignmentName);
      const updatedMarkdown = localAssignmentMarkdown.toMarkdown(updatedAssignment);
      if (localAssignmentMarkdown.toMarkdown(assignment) !== updatedMarkdown) {
        if (clientIsAuthoritative) {
          console.log("updating assignment, client is authoritative");
          if (!leaving) textSaved(updatedMarkdown);
          updateAssignment.mutateAsync({
            assignment: updatedAssignment,
            moduleName,
            assignmentName,
            previousModuleName: moduleName,
            previousAssignmentName: assignmentName,
            courseName,
          });
        } else if (!leaving) {
          console.log("client not authoritative, updating client with server assignment");
          textUpdate(localAssignmentMarkdown.toMarkdown(assignment), true);
        }
      }
      if (!leaving) setError("");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      if (!leaving) setError(e.toString());
    }
  };
  useDelayedSave(`assignment:${moduleName}/${assignmentName}`, 500, save, [
    assignment,
    assignmentName,
    clientIsAuthoritative,
    courseName,
    assignmentIsFetching,
    moduleName,
    text,
    textSaved,
    textUpdate,
    updateAssignment,
  ]);

  return (
    <EditLayout
      itemKey={`assignment:${moduleName}/${assignmentName}`}
      Header={<EditAssignmentHeader assignmentName={assignmentName} />}
      HeaderActions={
        <UpdateAssignmentName
          assignmentName={assignmentName}
          moduleName={moduleName}
        />
      }
      Editor={<MonacoEditor key={monacoKey} value={text} onChange={textUpdate} />}
      Preview={
        <>
          <div className="text-red-300">{error && error}</div>

          <div className="px-3 h-full ">
            <ClientOnly>
              <SuspenseAndErrorHandling showToast={false}>
                <AssignmentPreview assignment={assignment} />
              </SuspenseAndErrorHandling>
            </ClientOnly>
          </div>
        </>
      }
      Footer={
        <ClientOnly>
          <SuspenseAndErrorHandling>
            <AssignmentFooterButtons
              moduleName={moduleName}
              assignmentName={assignmentName}
              draft={draft}
            />
          </SuspenseAndErrorHandling>
        </ClientOnly>
      }
    />
  );
}
