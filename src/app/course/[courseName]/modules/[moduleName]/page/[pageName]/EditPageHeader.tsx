import { RightSingleChevron } from "@/components/icons/RightSingleChevron";
import { PageIcon } from "../../../../itemIcons";

export default function EditPageHeader({ pageName }: { pageName: string }) {
  return (
    <div className="flex flex-row items-center min-w-0">
      <span className="text-slate-500 cursor-default select-none my-auto">
        <RightSingleChevron />
      </span>
      <div className="w-5 ms-3 max-md:ms-1 shrink-0 my-auto">
        <PageIcon />
      </div>
      <div className="my-auto px-2 max-md:px-1 truncate min-w-10 flex-auto">{pageName}</div>
    </div>
  );
}
