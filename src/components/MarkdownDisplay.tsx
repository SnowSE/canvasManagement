"use client";
import { useEffect, useMemo, useRef } from "react";
import { useLocalCourseSettingsQuery } from "@/features/local/course/localCoursesHooks";
import { SuspenseAndErrorHandling } from "./SuspenseAndErrorHandling";
import { markdownToHTMLSafe } from "@/services/htmlMarkdownUtils";
import { courseFileFor, localFileUrl } from "@/services/courseFileLinks";
import { useCourseFilePathsQuery, usePreviewBase } from "@/features/local/files/fileHooks";
import { LocalCourseSettings } from "@/features/local/course/localCourseSettings";
import {
  resolveCanvasPageHrefsInHtml,
  resolveRelativeMdHrefsInHtml,
} from "@/services/urlUtils";
import { useCoursePagesQuery } from "@/features/local/modules/localCourseModuleHooks";
import { useExplainBrokenImages } from "./useExplainBrokenImages";
import { scrollToOpeningTextFragment } from "@/services/textFragment";

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
  const previewBase = usePreviewBase();
  const { data: courseFiles } = useCourseFilePathsQuery();
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
      // the file as it is on disk, not its uploaded copy
      fileHref: (link) => {
        const path = courseFileFor(link, courseFiles ?? []);
        return previewBase && path && localFileUrl(previewBase, settings.name, path);
      },
      preview: true,
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
  useEffect(() => {
    if (ref.current) scrollToOpeningTextFragment(ref.current);
  }, [html]);
  return (
    <div
      ref={ref}
      className={"markdownPreview " + className}
      dangerouslySetInnerHTML={innerHtml}
    ></div>
  );
}
