import { useLayoutEffect, useState, type RefObject } from "react";

/** Retângulo do anchor em coords da viewport para `position: fixed` (dropdown que foge de overflow:hidden). */
export function usePopoverAnchorRect(
  anchorRef: RefObject<HTMLElement | null>,
  open: boolean,
  gapPx = 6,
): { top: number; left: number; width: number } {
  const [rect, setRect] = useState({ top: 0, left: 0, width: 0 });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;

    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const w = Math.max(r.width, 180);
      let left = r.left;
      const pad = 8;
      left = Math.max(pad, Math.min(left, window.innerWidth - w - pad));
      setRect({
        top: r.bottom + gapPx,
        left,
        width: w,
      });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorRef, gapPx]);

  return rect;
}
