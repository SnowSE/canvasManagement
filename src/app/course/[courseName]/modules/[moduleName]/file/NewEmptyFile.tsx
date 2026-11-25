"use client";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import Modal, { useModal } from "@/components/Modal";
import TextInput from "@/components/form/TextInput";
import { useCreateFileMutation } from "@/features/local/files/fileHooks";
import { fileNameProblem } from "@/features/local/files/localCourseFileModels";
import { getModuleItemUrl } from "@/services/urlUtils";
import { useCourseContext } from "../../../context/courseContext";

/** A new, empty file in the module's files folder: named, made, and opened in the editor. */
export function NewEmptyFile({ moduleName }: { moduleName: string }) {
  const { courseName } = useCourseContext();
  const navigate = useNavigate();
  const modal = useModal();
  const create = useCreateFileMutation();
  const [name, setName] = useState("");
  const nameError = name && fileNameProblem(name);
  return (
    <Modal modalControl={modal} buttonText="Empty File" modalWidth="w-135">
      {({ closeModal }) => (
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name || nameError) return;
            await create.mutateAsync({ courseName, moduleName, name });
            closeModal();
            setName("");
            navigate({ to: getModuleItemUrl(courseName, moduleName, "file", name) });
          }}
        >
          <TextInput label="File name, with its extension (notes.html, style.css)" value={name} setValue={setName} />
          {(nameError || create.isError) && <div className="text-red-300 text-sm">{nameError || create.error?.message}</div>}
          <button disabled={!name || !!nameError || create.isPending}>Create in {moduleName}</button>
        </form>
      )}
    </Modal>
  );
}
