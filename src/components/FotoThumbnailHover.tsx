import { useRef, useState } from "react";
import { Link, type NavigateOptions, type To } from "react-router-dom";
import { cn } from "../utils/cn";

const PREVIEW_SIZE = 240;

function PlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

interface FotoThumbnailHoverProps {
  url: string | null | undefined;
  alt: string;
  to?: To;
  linkState?: NavigateOptions;
  size?: "sm" | "md";
}

export function FotoThumbnailHover({
  url,
  alt,
  to,
  linkState,
  size = "md",
}: FotoThumbnailHoverProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const thumbSize = size === "sm" ? "h-10 w-10" : "h-14 w-14";

  function showPreview() {
    if (!url || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    let left = rect.right + 8;
    let top = rect.top + rect.height / 2 - PREVIEW_SIZE / 2;
    left = Math.min(left, window.innerWidth - PREVIEW_SIZE - 8);
    top = Math.max(8, Math.min(top, window.innerHeight - PREVIEW_SIZE - 8));
    setPos({ x: left, y: top });
    setHover(true);
  }

  const thumbnail = (
    <span
      ref={anchorRef}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface-subtle",
        thumbSize,
        url && "cursor-zoom-in",
      )}
      onMouseEnter={url ? showPreview : undefined}
      onMouseLeave={() => setHover(false)}
      onFocus={url ? showPreview : undefined}
      onBlur={() => setHover(false)}
      tabIndex={url ? 0 : undefined}
      aria-label={url ? `Ampliar foto de ${alt}` : undefined}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-contain" loading="lazy" draggable={false} />
      ) : (
        <PlaceholderIcon className={size === "sm" ? "h-4 w-4 text-ink-faint" : "h-5 w-5 text-ink-faint"} />
      )}
    </span>
  );

  return (
    <>
      {to ? (
        <Link
          to={to}
          state={linkState?.state}
          className="inline-flex shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {thumbnail}
        </Link>
      ) : (
        thumbnail
      )}
      {hover && url ? (
        <div
          className="pointer-events-none fixed z-50 overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-lg"
          style={{ left: pos.x, top: pos.y, width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
          role="tooltip"
        >
          <img src={url} alt={alt} className="h-full w-full object-contain" draggable={false} />
        </div>
      ) : null}
    </>
  );
}
