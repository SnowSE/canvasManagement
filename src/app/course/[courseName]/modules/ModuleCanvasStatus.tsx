"use client";
import CheckIcon from "@/components/icons/CheckIcon";
import { Spinner } from "@/components/Spinner";
import {
  useCanvasModulesQuery,
  useAddCanvasModuleMutation,
} from "@/features/canvas/hooks/canvasModuleHooks";

export function ModuleCanvasStatus({ moduleName }: { moduleName: string }) {
  const { data: canvasModules } = useCanvasModulesQuery();
  const addToCanvas = useAddCanvasModuleMutation();

  const canvasModule = canvasModules?.find((c) => c.name === moduleName);

  return (
    <div className="text-slate-400 text-xs font-normal flex items-center gap-2">
      {!canvasModule && <span className="text-rose-400">Not in Canvas</span>}
      {!canvasModule && (
        <button
          className="btn-thin"
          disabled={addToCanvas.isPending}
          onClick={(e) => {
            e.stopPropagation();
            addToCanvas.mutate(moduleName);
          }}
        >
          {addToCanvas.isPending ? <Spinner /> : "Add"}
        </button>
      )}
      {canvasModule && !canvasModule.published && <div>Not Published</div>}
      {canvasModule && canvasModule.published && (
        <div>
          <CheckIcon />
        </div>
      )}
    </div>
  );
}
