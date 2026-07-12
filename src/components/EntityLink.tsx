import { Link, type LinkProps } from "react-router-dom";
import type { ReactNode } from "react";
import { cn } from "../utils/cn";
import { IconArrowUpRight } from "./Icons";

type EntityLinkProps = {
  to: LinkProps["to"];
  children: ReactNode;
  className?: string;
  title?: string;
  truncate?: boolean;
  state?: LinkProps["state"];
  target?: LinkProps["target"];
  rel?: LinkProps["rel"];
  /**
   * `nav` — underline + seta (telas de detalhe / campos).
   * `plain` — só cor de link (tabelas e listagens).
   */
  appearance?: "nav" | "plain";
};

export function EntityLink({
  to,
  children,
  className,
  title,
  truncate,
  state,
  target,
  rel,
  appearance = "nav",
}: EntityLinkProps) {
  if (appearance === "plain") {
    return (
      <Link
        to={to}
        state={state}
        target={target}
        rel={rel}
        title={title}
        className={cn(
          "text-brand-700 transition-colors hover:text-brand-800",
          truncate && "block max-w-full truncate",
          className,
        )}
      >
        {children}
      </Link>
    );
  }

  return (
    <Link
      to={to}
      state={state}
      target={target}
      rel={rel}
      title={title}
      className={cn(
        "inline-flex max-w-full items-center gap-1 text-brand-700 underline decoration-brand-300 underline-offset-2 transition hover:text-brand-800 hover:decoration-brand-500",
        truncate && "min-w-0",
        className,
      )}
    >
      <span className={cn(truncate && "min-w-0 truncate")}>{children}</span>
      <IconArrowUpRight
        width={13}
        height={13}
        className="shrink-0 opacity-80"
        aria-hidden
      />
    </Link>
  );
}
