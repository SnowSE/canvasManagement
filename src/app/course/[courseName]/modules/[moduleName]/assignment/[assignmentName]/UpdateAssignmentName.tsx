import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import TextInput from "@/components/form/TextInput";
import Modal, { useModal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";
import {
  useAssignmentQuery,
  useUpdateAssignmentMutation,
} from "@/features/local/assignments/assignmentHooks";
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
                await updateAssignment.mutateAsync({
                  assignment: assignment,
                  moduleName,
                  assignmentName: name,
                  previousModuleName: moduleName,
                  previousAssignmentName: assignmentName,
                  courseName,
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
            <div
              className="
                text-yellow-300 
                bg-yellow-950/30 
                border-2 
                rounded-lg 
                border-yellow-800 
                p-1 text-sm mb-2"
            >
              Warning: does not rename in Canvas
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
