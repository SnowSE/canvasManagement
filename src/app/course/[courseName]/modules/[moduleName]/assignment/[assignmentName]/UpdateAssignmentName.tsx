import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import { useAssignmentQuery, useUpdateAssignmentMutation } from "@/features/local/assignments/assignmentHooks";
import { useRenameAssignmentMutation } from "@/features/canvas/hooks/canvasRenameHooks";
import { RenameItem } from "../../../RenameItem";

export function UpdateAssignmentName({ moduleName, assignmentName }: { assignmentName: string; moduleName: string }) {
  const { courseName } = useCourseContext();
  const { data: assignment } = useAssignmentQuery(moduleName, assignmentName);
  const updateAssignment = useUpdateAssignmentMutation();
  const renameAssignment = useRenameAssignmentMutation();
  return (
    <RenameItem
      noun="Assignment"
      type="assignment"
      moduleName={moduleName}
      name={assignmentName}
      rename={(name) =>
        renameAssignment.mutateAsync({
          oldName: assignmentName,
          newName: name,
          renameFile: () =>
            updateAssignment.mutateAsync({ assignment, moduleName, assignmentName: name, previousModuleName: moduleName, previousAssignmentName: assignmentName, courseName }),
        })
      }
    />
  );
}
