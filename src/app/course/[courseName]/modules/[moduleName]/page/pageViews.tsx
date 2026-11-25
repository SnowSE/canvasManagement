"use client";
import MarkdownDisplay from "@/components/MarkdownDisplay";
import { PageDayItemContextMenu } from "../../../calendar/day/itemInDay/PageDayItemContextMenu";
import { ComparePageWithCanvas } from "../compare/CompareWithCanvas";
import EditPage from "./[pageName]/EditPage";
import { LocalCoursePage } from "@/features/local/pages/localCoursePageModels";
import type { ItemKindViews } from "../../../itemKind";

/** How a page is shown (see itemKindViews). */
export const pageViews: ItemKindViews = {
  Editor: ({ moduleName, name }) => <EditPage moduleName={moduleName} pageName={name} />,
  Menu: PageDayItemContextMenu,
  Preview: ({ item }) => <MarkdownDisplay markdown={(item as LocalCoursePage).text} />,
  Compare: ({ moduleName, name }) => <ComparePageWithCanvas moduleName={moduleName} pageName={name} />,
};
