import { RightSingleChevron } from "@/components/icons/RightSingleChevron";
import { AssignmentIcon } from "../../../../itemIcons";

export default function EditAssignmentHeader({
  assignmentName,
}: {
  assignmentName: string;
}) {
  return (
    <div className="flex flex-row items-center min-w-0">
      <span className="text-slate-500 cursor-default select-none my-auto">
        <RightSingleChevron />
      </span>
      <div className="w-5 ms-3 max-md:ms-1 shrink-0 my-auto">
        <AssignmentIcon />
      </div>
      <div className="my-auto px-2 max-md:px-1 truncate min-w-10 flex-auto">{assignmentName}</div>
    </div>
  );
}
