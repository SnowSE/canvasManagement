import { BreadCrumbs } from "@/components/BreadCrumbs";
import { RightSingleChevron } from "@/components/icons/RightSingleChevron";
import { ItemTypeIcon } from "../../../../ItemTypeIcon";

export default function EditPageHeader({ pageName }: { pageName: string }) {
  return (
    <div className="flex flex-row items-center min-w-0">
      <BreadCrumbs />
      <span className="text-slate-500 cursor-default select-none my-auto">
        <RightSingleChevron />
      </span>
      <div className="w-5 ms-3 shrink-0 my-auto">
        <ItemTypeIcon type="page" />
      </div>
      <div className="my-auto px-2 truncate min-w-10 flex-auto">{pageName}</div>
    </div>
  );
}
