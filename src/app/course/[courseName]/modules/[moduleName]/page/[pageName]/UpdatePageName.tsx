import { useCourseContext } from "@/app/course/[courseName]/context/courseContext";
import { usePageQuery, useUpdatePageMutation } from "@/features/local/pages/pageHooks";
import { useRenamePageMutation } from "@/features/canvas/hooks/canvasRenameHooks";
import { RenameItem } from "../../../RenameItem";

export function UpdatePageName({ moduleName, pageName }: { pageName: string; moduleName: string }) {
  const { courseName } = useCourseContext();
  const { data: page } = usePageQuery(moduleName, pageName);
  const updatePage = useUpdatePageMutation();
  const renamePage = useRenamePageMutation();
  return (
    <RenameItem
      noun="Page"
      type="page"
      moduleName={moduleName}
      name={pageName}
      rename={(name) =>
        renamePage.mutateAsync({
          oldName: pageName,
          newName: name,
          renameFile: () => updatePage.mutateAsync({ page, moduleName, pageName: name, previousModuleName: moduleName, previousPageName: pageName, courseName }),
        })
      }
    />
  );
}
