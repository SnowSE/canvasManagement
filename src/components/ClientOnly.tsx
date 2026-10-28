"use client";
import React, { ReactNode, useSyncExternalStore } from "react";

const subscribeToNothing = () => () => {};

export default function ClientOnly({ children }: { children: ReactNode }) {
  // false on the server and while hydrating, true from then on
  const isClient = useSyncExternalStore(subscribeToNothing, () => true, () => false);

  if (!isClient) return <></>;
  return <>{children}</>;
}
