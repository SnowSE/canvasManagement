import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Hover state for a tooltip. `showTooltip`/`hideTooltip` go on the target;
 * `tooltipProps` goes on the tooltip itself so the pointer can travel into
 * it (to click a link, say) without it closing — hiding waits `hideDelayMs`
 * and is cancelled when the tooltip is entered.
 */
export const useTooltip = (delayMs: number = 150, hideDelayMs: number = 200) => {
  const [visible, setVisible] = useState(false);
  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const targetRef = useRef<HTMLAnchorElement>(null);

  const clearTimers = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const showTooltip = useCallback(() => {
    clearTimers();
    showTimeoutRef.current = setTimeout(() => {
      setVisible(true);
    }, delayMs);
  }, [clearTimers, delayMs]);

  const hideTooltip = useCallback(() => {
    clearTimers();
    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false);
    }, hideDelayMs);
  }, [clearTimers, hideDelayMs]);

  // pointer moved into the tooltip: keep it open
  const keepTooltip = useCallback(() => {
    clearTimers();
  }, [clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  return {
    visible,
    targetRef,
    showTooltip,
    hideTooltip,
    tooltipProps: { onMouseEnter: keepTooltip, onMouseLeave: hideTooltip },
  };
};
