"use client";
import { useMemo, useRef } from "react";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { SuspenseAndErrorHandling } from "./SuspenseAndErrorHandling";
import { markdownToHTMLSafe } from "@/services/htmlMarkdownUtils";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import {
  resolveCanvasPageHrefsInHtml,
  resolveRelativeMdHrefsInHtml,
} from "@/services/urlUtils";
import { useCoursePagesQuery } from "@/features/local/modules/localCourseModuleHooks";
import { useExplainBrokenImages } from "./useExplainBrokenImages";

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
  const finalHtml = resolveMdLinks
    ? resolveRelativeMdHrefsInHtml(html, settings.name)
    : html;
  // React compares this object, not the string inside it, so a new object on
  // every render would rewrite the preview (reloading its images) each time
  const innerHtml = useMemo(() => ({ __html: finalHtml }), [finalHtml]);
  const ref = useRef<HTMLDivElement>(null);
  useExplainBrokenImages(ref, finalHtml);
  return (
    <div
      ref={ref}
      className={"markdownPreview " + className}
      dangerouslySetInnerHTML={innerHtml}
    ></div>
  );
}
