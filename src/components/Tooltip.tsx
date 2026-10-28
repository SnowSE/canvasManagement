import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// gap kept between the tooltip and the edge of the window
const edgeMargin = 8;

export const Tooltip: React.FC<{
  message: ReactNode;
  targetRef: React.RefObject<Element | null>;
  visible: boolean;
  /** Pass `useTooltip().tooltipProps` so the tooltip stays open while hovered. */
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}> = ({ message, targetRef, visible, onMouseEnter, onMouseLeave }) => {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  // centered under the target, then nudged back on screen once its width is known
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    const rect = targetRef.current?.getBoundingClientRect();
    if (!visible || !tooltipRef.current || !rect) return;
    const width = tooltipRef.current.offsetWidth;
    const center = rect.left + rect.width / 2;
    const left = center - width / 2;
    const right = center + width / 2;
    const maxRight = window.innerWidth - edgeMargin;
    const shift =
      left < edgeMargin
        ? edgeMargin - left
        : right > maxRight
          ? maxRight - right
          : 0;
    setPosition({
      top: rect.bottom + window.scrollY + 10,
      left: center + window.scrollX + shift,
    });
  }, [visible, message, targetRef]);

  return createPortal(
    <div
      ref={tooltipRef}
      style={position}
      className={
        " absolute -translate-x-1/2 z-20 " +
        " bg-gray-900 text-slate-200 text-sm " +
        " rounded-md py-1 px-2 " +
        " transition-opacity duration-150 " +
        " border border-slate-700 shadow-[0px_0px_10px_5px] shadow-slate-500/20 " +
        " max-w-sm max-h-64 overflow-hidden " +
        (visible ? " opacity-100 " : " opacity-0 pointer-events-none hidden ")
      }
      role="tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {message}
    </div>,
    document.body
  );
};
