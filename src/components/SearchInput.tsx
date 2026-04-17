import type { InputHTMLAttributes } from "react";
import { cn } from "../utils/cn";
import { IconSearch } from "./Icons";

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  wrapperClassName?: string;
}

export function SearchInput({ className, wrapperClassName, ...rest }: SearchInputProps) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <IconSearch
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
        width={16}
        height={16}
      />
      <input
        type="search"
        {...rest}
        className={cn("input-base pl-9", className)}
      />
    </div>
  );
}
