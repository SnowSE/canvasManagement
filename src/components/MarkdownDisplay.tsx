"use client";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { SuspenseAndErrorHandling } from "./SuspenseAndErrorHandling";
import { markdownToHTMLSafe } from "@/services/htmlMarkdownUtils";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import {
  resolveCanvasPageHrefsInHtml,
  resolveRelativeMdHrefsInHtml,
} from "@/services/urlUtils";
import { useCoursePagesQuery } from "@/features/local/modules/localCourseModuleHooks";

export default function MarkdownDisplay({
  markdown,
  className = "",
  replaceText = [],
  convertImages,
  resolveMdLinks = false,
}: {
  markdown: string;
  className?: string;
  replaceText?: {
    source: string;
    destination: string;
  }[];
  convertImages?: boolean;
  resolveMdLinks?: boolean;
}) {
  const { data: settings } = useLocalCourseSettingsQuery();
  return (
    <SuspenseAndErrorHandling resetKeys={[markdown]}>
      <DangerousInnerMarkdown
        markdown={markdown}
        settings={settings}
        className={className}
        replaceText={replaceText}
        convertImages={convertImages}
        resolveMdLinks={resolveMdLinks}
      />
    </SuspenseAndErrorHandling>
  );
}

function DangerousInnerMarkdown({
  markdown,
  settings,
  className,
  replaceText,
  convertImages,
  resolveMdLinks,
}: {
  markdown: string;
  settings: LocalCourseSettings;
  className: string;
  replaceText: {
    source: string;
    destination: string;
  }[];
  convertImages?: boolean;
  resolveMdLinks?: boolean;
}) {
  const pages = useCoursePagesQuery().map(({ moduleName, page }) => ({
    moduleName,
    name: page.name,
  }));
  const html = resolveCanvasPageHrefsInHtml(
    markdownToHTMLSafe({
      markdownString: markdown,
      convertImages,
      settings,
      replaceText,
    }),
    settings.name,
    pages
  );
  return (
    <div
      className={"markdownPreview " + className}
      dangerouslySetInnerHTML={{
        __html: resolveMdLinks
          ? resolveRelativeMdHrefsInHtml(html, settings.name)
          : html,
      }}
    ></div>
  );
}
