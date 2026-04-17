import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "../utils/cn";

interface FieldWrapperProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FieldWrapper({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
}: FieldWrapperProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="label-base flex items-center gap-1">
        {label}
        {required ? <span className="text-red-500">*</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-ink-soft">{hint}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export function FormInput({
  label,
  hint,
  error,
  required,
  wrapperClassName,
  id,
  className,
  ...rest
}: FormInputProps) {
  const fieldId = id ?? `in-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <FieldWrapper
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
    >
      <input
        {...rest}
        id={fieldId}
        required={required}
        className={cn(
          "input-base",
          error && "border-red-400 focus:border-red-500 focus:ring-red-500/20",
          className,
        )}
      />
    </FieldWrapper>
  );
}

interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  wrapperClassName?: string;
}

export function FormSelect({
  label,
  hint,
  error,
  required,
  options,
  placeholder,
  wrapperClassName,
  id,
  className,
  ...rest
}: FormSelectProps) {
  const fieldId = id ?? `sel-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <FieldWrapper
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
    >
      <select
        {...rest}
        id={fieldId}
        required={required}
        className={cn(
          "input-base appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236B7280%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-no-repeat bg-[right_0.75rem_center] pr-9",
          error && "border-red-400 focus:border-red-500 focus:ring-red-500/20",
          className,
        )}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export function FormTextarea({
  label,
  hint,
  error,
  required,
  wrapperClassName,
  id,
  className,
  rows = 4,
  ...rest
}: FormTextareaProps) {
  const fieldId = id ?? `tx-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <FieldWrapper
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
    >
      <textarea
        {...rest}
        id={fieldId}
        rows={rows}
        required={required}
        className={cn(
          "input-base resize-y",
          error && "border-red-400 focus:border-red-500 focus:ring-red-500/20",
          className,
        )}
      />
    </FieldWrapper>
  );
}

interface FormCheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
}

export function FormCheckbox({ label, description, id, className, ...rest }: FormCheckboxProps) {
  const fieldId = id ?? `cb-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <label htmlFor={fieldId} className="flex items-start gap-3 cursor-pointer select-none">
      <input
        {...rest}
        id={fieldId}
        type="checkbox"
        className={cn(
          "mt-0.5 h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500/30",
          className,
        )}
      />
      <span className="text-sm text-ink">
        <span className="font-medium">{label}</span>
        {description ? (
          <span className="block text-xs text-ink-soft mt-0.5">{description}</span>
        ) : null}
      </span>
    </label>
  );
}
