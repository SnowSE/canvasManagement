"use client";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { SuspenseAndErrorHandling } from "./SuspenseAndErrorHandling";
import { markdownToHTMLSafe } from "@/services/htmlMarkdownUtils";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import { resolveRelativeMdHrefsInHtml } from "@/services/urlUtils";

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
    <SuspenseAndErrorHandling>
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
  const html = markdownToHTMLSafe({
    markdownString: markdown,
    convertImages,
    settings,
    replaceText,
  });
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
