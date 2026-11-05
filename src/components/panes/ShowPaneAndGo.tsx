"use client";
import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { showPane } from "./PaneStrip";

/**
 * What an old page url (…/compare, …/history, …/settings) does now: shows
 * the pane and goes to the url of what it was about.
 */
export function ShowPaneAndGo({ pane, to }: { pane: string; to: string }) {
  const router = useRouter();
  useEffect(() => {
    showPane(pane);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.navigate({ to: to as any, replace: true });
  }, [router, to, pane]);
  return null;
}
