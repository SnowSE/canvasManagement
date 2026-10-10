"use client";
import React from "react";
import toast, { Toaster, ToastBar } from "react-hot-toast";
import { reportBrowserError } from "@/features/local/errorLog/reportBrowserError";

// The one way to raise an error toast. Keyed by message, so a repeated error
// (a burst of failed requests, a boundary re-rendering) updates the existing
// toast instead of stacking another. Returns a dismiss for callers that know
// when their error is gone. Every error toast also lands in the error log.
export function showErrorToast(message: string) {
  reportBrowserError("Shown as an error message", message);
  toast.error(message, { id: message });
  return () => toast.dismiss(message);
}

// For something only the user can finish (e.g. in Canvas): stays up until
// clicked, with a link to where they need to go.
export function showActionNeededToast(message: string, href: string, linkText: string) {
  toast(
    <span>
      {message}{" "}
      <a href={href} target="_blank" rel="noreferrer" className="underline">
        {linkText}
      </a>
    </span>,
    { id: href, icon: "⚠️", duration: Infinity },
  );
}

export const MyToaster = () => {

  return (
    // <Toaster />
    <Toaster
      position="top-center"
      reverseOrder={false}
      // gutter={8}
      containerClassName=" flex flex-row w-full "
      containerStyle={{}}
      toastOptions={{
        className: "border-4 border-rose-900 drop-shadow-2xl grow",
        duration: 5_000,
        style: {
          background: "#030712",
          color: "#e5e7eb",
          paddingLeft: "2em",
          paddingRight: "2em",
          width: "100%"
        },

        success: {
          duration: 3000,
        },

        // Errors describe something still broken, so they stay put instead of
        // timing out. They are cleared either by whatever raised them (see
        // SuspenseAndErrorHandling, which dismisses its toast once the error
        // is gone) or by clicking the toast. Raise them via showErrorToast.
        error: {
          duration: Infinity,
        },
      }}
    >
      {(t) => (
        <div
          onClick={() => toast.dismiss(t.id)}
          title="click to dismiss"
          className="contents cursor-pointer"
        >
          <ToastBar toast={t} />
        </div>
      )}
    </Toaster>
  );
};
