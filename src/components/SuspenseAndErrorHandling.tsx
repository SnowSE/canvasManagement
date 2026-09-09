"use client";
import { getErrorMessage } from "@/services/utils/queryClient";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { FC, ReactNode, Suspense, useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Spinner } from "./Spinner";
import toast from "react-hot-toast";

// Rendered in place of the failed subtree. The toast lives in an effect rather
// than in the render body: an error boundary re-runs its fallback on every
// re-render of the boundary, so toasting during render fires one toast per
// keystroke while the content being edited is momentarily invalid. Keying the
// toast by message means a repeated error updates the existing toast in place
// instead of stacking a new one.
const ErrorFallback: FC<{
  error: unknown;
  showToast: boolean;
  onRetry: () => void;
}> = ({ error, showToast, onRetry }) => {
  const message = getErrorMessage(error);

  useEffect(() => {
    if (!showToast) return;
    const id = `boundary:${message}`;
    toast.error(message, { id });
    // error toasts do not time out (see MyToaster), so clear this one when the
    // error goes away rather than leaving it up after the fix
    return () => toast.dismiss(id);
  }, [message, showToast]);

  return (
    <div className="text-center">
      <div className="p-3">{message}</div>
      <button className="btn btn-outline-secondary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
};

export const SuspenseAndErrorHandling: FC<{
  children: ReactNode;
  showToast?: boolean;
  // Values that should clear the error and retry the subtree when they change.
  // Pass the text being edited so that fixing a typo restores the view, rather
  // than leaving the fallback up until "Try again" is clicked.
  resetKeys?: unknown[];
}> = ({ children, showToast = true, resetKeys }) => {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          resetKeys={resetKeys}
          fallbackRender={(props) => (
            <ErrorFallback
              error={props.error}
              showToast={showToast}
              onRetry={props.resetErrorBoundary}
            />
          )}
        >
          <Suspense fallback={<Spinner />}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
};
