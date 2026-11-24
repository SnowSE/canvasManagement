import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import TextInput from "@/components/form/TextInput";
import Modal, { useModal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";
import { ItemKind } from "@/features/local/course/courseItemTypes";
import { validateFileName } from "@/services/fileNameValidation";
import { getModuleItemUrl } from "@/services/urlUtils";
import { useNavigate } from "@tanstack/react-router";
import { ReactNode, useState } from "react";

/**
 * An item's Rename button in its editor's top bar, and the dialog it
 * opens: the one rename there is, for every type of item. `rename` does
 * the renaming (the file, and the item in Canvas with it); the editor then
 * goes to the item under its new name.
 */
export function RenameItem({
  noun,
  type,
  moduleName,
  name: currentName,
  rename,
  nameProblem = validateFileName,
  note = "Also renames it in Canvas",
}: {
  /** The type as the button says it: Page, Quiz. */
  noun: string;
  type: ItemKind;
  moduleName: string;
  name: string;
  rename: (newName: string) => Promise<unknown>;
  /** What is wrong with a name, or "". */
  nameProblem?: (name: string) => string;
  note?: ReactNode;
}) {
  const modal = useModal();
  const { courseName } = useCourseContext();
  const navigate = useNavigate();
  const [name, setName] = useState(currentName);
  const [isLoading, setIsLoading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const nameError = nameProblem(name);

  return (
    <div>
      <Modal modalControl={modal} buttonText={`Rename ${noun}`} buttonClass="py-0" modalWidth="w-1/5">
        {({ closeModal }) => (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (name === currentName) {
                closeModal();
                return;
              }
              if (nameError) return;

              setSaveError("");
              setIsLoading(true);
              try {
                await rename(name);
                // update url (will trigger reload...)
                navigate({ to: getModuleItemUrl(courseName, moduleName, type, name), replace: true });
              } catch (error) {
                setSaveError(error instanceof Error ? error.message : String(error));
              } finally {
                setIsLoading(false);
              }
            }}
          >
            <div className="text-slate-400 text-sm mb-2">{note}</div>
            <TextInput value={name} setValue={setName} label={`Rename ${noun}`} />
            {(nameError || saveError) && (
              <div className="text-red-300 bg-red-950/50 border p-1 rounded border-red-900/50 text-sm mt-1">{nameError || saveError}</div>
            )}
            <button className="w-full my-3" disabled={!!nameError || isLoading}>
              Save New Name
            </button>
            {isLoading && <Spinner />}
          </form>
        )}
      </Modal>
    </div>
  );
}
