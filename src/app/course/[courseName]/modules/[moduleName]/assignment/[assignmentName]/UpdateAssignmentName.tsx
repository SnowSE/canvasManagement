import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import TextInput from "@/components/form/TextInput";
import Modal, { useModal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";
import {
  useAssignmentQuery,
  useUpdateAssignmentMutation,
} from "@/features/local/assignments/assignmentHooks";
import { useRenameAssignmentMutation } from "@/features/canvas/hooks/canvasRenameHooks";
import { validateFileName } from "@/services/fileNameValidation";
import { getModuleItemUrl } from "@/services/urlUtils";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export function UpdateAssignmentName({
  moduleName,
  assignmentName,
}: {
  assignmentName: string;
  moduleName: string;
}) {
  const modal = useModal();
  const { courseName } = useCourseContext();
  const navigate = useNavigate();
  const { data: assignment } = useAssignmentQuery(moduleName, assignmentName);
  const updateAssignment = useUpdateAssignmentMutation();
  const renameAssignment = useRenameAssignmentMutation();
  const [name, setName] = useState(assignment.name);
  const [isLoading, setIsLoading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const nameError = validateFileName(name);

  return (
    <div>
      <Modal
        modalControl={modal}
        buttonText="Rename Assignment"
        buttonClass="py-0"
        modalWidth="w-1/5"
      >
        {({ closeModal }) => (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (name === assignmentName) {
                closeModal();
                return;
              }
              if (nameError) return;

              setSaveError("");
              setIsLoading(true);
              try {
                await renameAssignment.mutateAsync({
                  oldName: assignmentName,
                  newName: name,
                  renameFile: () =>
                    updateAssignment.mutateAsync({
                      assignment: assignment,
                      moduleName,
                      assignmentName: name,
                      previousModuleName: moduleName,
                      previousAssignmentName: assignmentName,
                      courseName,
                    }),
                });

                // update url (will trigger reload...)
                navigate({
                  to: getModuleItemUrl(
                    courseName,
                    moduleName,
                    "assignment",
                    name,
                  ),
                  replace: true,
                });
              } catch (error) {
                setSaveError(
                  error instanceof Error ? error.message : String(error),
                );
              } finally {
                setIsLoading(false);
              }
            }}
          >
            <div className="text-slate-400 text-sm mb-2">
              Also renames it in Canvas
            </div>
            <TextInput
              value={name}
              setValue={setName}
              label={"Rename Assignment"}
            />
            {(nameError || saveError) && (
              <div className="text-red-300 bg-red-950/50 border p-1 rounded border-red-900/50 text-sm mt-1">
                {nameError || saveError}
              </div>
            )}
            <button
              className="w-full my-3"
              disabled={!!nameError || isLoading}
            >
              Save New Name
            </button>
            {isLoading && <Spinner />}
          </form>
        )}
      </Modal>
    </div>
  );
}
