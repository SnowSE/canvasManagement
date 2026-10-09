"use client";
import {
  PublishableItemType,
  usePublishInCanvasMutation,
} from "@/features/canvas/hooks/canvasPublishHooks";

/**
 * "Publish in Canvas" for an item already in Canvas. Once Canvas has it
 * published, it stays on screen as a disabled green "Published" so the state
 * is obvious at a glance.
 */
export function PublishInCanvasButton({
  type,
  canvasItemId,
  published,
  name,
  moduleName,
  className = "",
  publishedClassName = "",
  onPublish,
}: {
  type: PublishableItemType;
  canvasItemId: number;
  published: boolean;
  name: string;
  moduleName: string;
  className?: string;
  publishedClassName?: string;
  onPublish?: () => void;
}) {
  const publish = usePublishInCanvasMutation();

  if (published)
    return (
      <button
        disabled
        title="Students can see this in Canvas"
        className={
          "unstyled btn cursor-default bg-green-950/60 text-green-300 border border-green-800 " +
          publishedClassName
        }
      >
        ✓ Published
      </button>
    );

  return (
    <button
      disabled={publish.isPending}
      title="Publishes this item in Canvas so students can see it"
      className={className}
      onClick={() => {
        publish.mutate({ type, canvasItemId, name, moduleName });
        onPublish?.();
      }}
    >
      {publish.isPending ? "Publishing…" : "Publish in Canvas"}
    </button>
  );
}
