"use client";
import { useModuleNamesQuery } from "@/features/local/modules/localCourseModuleHooks";
import ExpandableModule from "./ExpandableModule";
import CreateModule from "./CreateModule";
import { BulkBar } from "./bulk/BulkBar";

export default function ModuleList() {
  const { data: moduleNames } = useModuleNamesQuery();
  return (
    <>
      <BulkBar />
      {moduleNames.map((m) => (
        <ExpandableModule key={m} moduleName={m} />
      ))}
      <div className="flex flex-col justify-center">
        <CreateModule />
      </div>
      <br />
      <br />
      <br />
      <br />
    </>
  );
}
