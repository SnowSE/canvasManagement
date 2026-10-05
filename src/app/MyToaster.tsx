"use client";
import React from "react";
import toast, { Toaster, ToastBar } from "react-hot-toast";

// The one way to raise an error toast. Keyed by message, so a repeated error
// (a burst of failed requests, a boundary re-rendering) updates the existing
// toast instead of stacking another. Returns a dismiss for callers that know
// when their error is gone.
export function showErrorToast(message: string) {
  toast.error(message, { id: message });
  return () => toast.dismiss(message);
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
