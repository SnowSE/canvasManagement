"use client";
import { ReactNode } from "react";
import { CourseItemType } from "@/features/local/course/courseItemTypes";
import { useRawItemQuery } from "@/features/local/modules/rawItemHooks";
import { SuspenseAndErrorHandling } from "@/components/SuspenseAndErrorHandling";
import ClientOnly from "@/components/ClientOnly";
import { RawItemEditor } from "./RawItemEditor";

/**
 * Wraps an item editor. When the file doesn't parse, the regular editor has
 * nothing to show, so this opens the file as plain text to be fixed instead.
 */
export function UnparsableItemFallback({
  moduleName,
  type,
  name,
  children,
}: {
  moduleName: string;
  type: CourseItemType;
  name: string;
  children: ReactNode;
}) {
  const { data: raw } = useRawItemQuery(moduleName, type, name);

  if (raw?.error !== undefined)
    return (
      <ClientOnly>
        <RawItemEditor
          moduleName={moduleName}
          type={type}
          name={name}
          initialText={raw.text}
          initialError={raw.error}
        />
      </ClientOnly>
    );

  // the raw check usually lands after the editor's own query has failed, so
  // contain that failure here rather than letting it replace the page
  return (
    <SuspenseAndErrorHandling showToast={false} resetKeys={[raw?.error]}>
      {children}
    </SuspenseAndErrorHandling>
  );
}
