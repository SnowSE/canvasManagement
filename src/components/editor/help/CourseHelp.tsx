"use client";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { useRosterGroupSetsQuery } from "@/features/canvas/roster/rosterHooks";
import { useGlobalSettingsQuery } from "@/features/local/globalSettings/globalSettingsHooks";
import { getFeedbackDelimitersFromSettings } from "@/features/local/globalSettings/globalSettingsUtils";
import { GlobalSettings } from "@/features/local/globalSettings/globalSettingsModels";
import { AssignmentHelp } from "@/app/course/[courseName]/modules/[moduleName]/assignment/[assignmentName]/AssignmentHelp";
import { QuizHelp } from "@/app/course/[courseName]/modules/[moduleName]/quiz/[quizName]/QuizHelp";
import { PageHelp } from "@/app/course/[courseName]/modules/[moduleName]/page/[pageName]/PageHelp";
import { CurrentItem } from "@/app/course/[courseName]/currentItem";
import { HelpLinks, HelpPanel, HelpType } from "./HelpParts";
import {
  EncodedBlocksHelp,
  ImagesHelp,
  ListTableHelp,
  MarkdownBasicsHelp,
  MathHelp,
  MermaidHelp,
} from "./MarkdownHelpSections";

const typeOf: Record<string, HelpType> = { Assignment: "assignment", Quiz: "quiz", Page: "page" };

/**
 * The Help pane: every topic for assignments, quizzes and pages plus the
 * markdown ones, searchable, filtered to the item open (all of them on the
 * course page or a lecture).
 */
export function CourseHelp({ item }: { item?: CurrentItem }) {
  const { data: settings } = useLocalCourseSettingsQuery();
  const { data: groupSetsData } = useRosterGroupSetsQuery();
  const { data: globalSettings } = useGlobalSettingsQuery();
  return (
    <HelpPanel defaultType={item?.kind === "item" ? typeOf[item.type] : "all"}>
      <AssignmentHelp settings={settings} groupSetNames={groupSetsData?.groupSets.map((g) => g.name) ?? []} />
      <QuizHelp
        settings={settings}
        feedbackDelimiters={getFeedbackDelimitersFromSettings((globalSettings ?? {}) as GlobalSettings)}
      />
      <PageHelp />
      <MarkdownBasicsHelp />
      <ImagesHelp />
      <MathHelp />
      <ListTableHelp />
      <MermaidHelp />
      <EncodedBlocksHelp />
      <HelpLinks
        links={[
          { href: "https://www.markdownguide.org/cheat-sheet/", label: "Markdown Cheat Sheet" },
          { href: "https://mermaid.live/edit", label: "Mermaid Live Editor" },
        ]}
      />
    </HelpPanel>
  );
}
