import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../utils/cn";

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  icon?: ReactNode;
}

export function PrimaryButton({
  loading,
  icon,
  children,
  className,
  disabled,
  ...rest
}: PrimaryButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn("btn-primary", className)}
    >
      {loading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : icon ? (
        <span className="inline-flex">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}

export function SecondaryButton({
  children,
  className,
  icon,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode }) {
  return (
    <button {...rest} className={cn("btn-secondary", className)}>
      {icon ? <span className="inline-flex">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

export function GhostButton({
  children,
  className,
  icon,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode }) {
  return (
    <button {...rest} className={cn("btn-ghost", className)}>
      {icon ? <span className="inline-flex">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

export function DangerButton({
  children,
  className,
  icon,
  loading,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  loading?: boolean;
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn("btn-danger", className)}
    >
      {loading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : icon ? (
        <span className="inline-flex">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}
