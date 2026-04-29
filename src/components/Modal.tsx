import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/cn";
import { IconX } from "./Icons";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  closeOnBackdropClick?: boolean;
  className?: string;
}

const sizeClass: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnBackdropClick = true,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-card-hover",
          sizeClass[size],
          className,
        )}
      >
        {(title || description) ? (
          <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              {title ? (
                <h3 className="text-sm font-semibold text-ink truncate">{title}</h3>
              ) : null}
              {description ? (
                <p className="mt-0.5 text-xs text-ink-soft">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost h-8 w-8 p-0"
              aria-label="Fechar"
            >
              <IconX width={16} height={16} />
            </button>
          </header>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost absolute right-3 top-3 h-8 w-8 p-0"
            aria-label="Fechar"
          >
            <IconX width={16} height={16} />
          </button>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-line bg-surface-muted px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
