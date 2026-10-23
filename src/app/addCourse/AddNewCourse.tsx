"use client";
import { SuspenseAndErrorHandling } from "@/components/SuspenseAndErrorHandling";
import AddNewCourseToGlobalSettingsForm from "./AddCourseToGlobalSettingsForm";
import ClientOnly from "@/components/ClientOnly";

export default function AddCourseToGlobalSettings({
  showForm,
}: {
  showForm: boolean;
}) {
  return (
    <div>
      <div className={" collapsible " + (showForm && "expand")}>
        <div className="border rounded-md p-3 m-3">
          <SuspenseAndErrorHandling>
            <ClientOnly>
              {showForm && <AddNewCourseToGlobalSettingsForm />}
            </ClientOnly>
          </SuspenseAndErrorHandling>
        </div>
      </div>
    </div>
  );
}
