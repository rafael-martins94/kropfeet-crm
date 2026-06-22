import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export function readIntParam(
  params: URLSearchParams,
  key: string,
  fallback = 1,
  min = 1,
): number {
  const raw = params.get(key);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < min) return fallback;
  return n;
}

export function readCsvParam(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key);
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function readEnumParam<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = params.get(key);
  if (!raw) return fallback;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

export function readCsvEnumParam<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
): T[] {
  return readCsvParam(params, key).filter((v): v is T =>
    (allowed as readonly string[]).includes(v),
  );
}

export function writeParam(
  next: URLSearchParams,
  key: string,
  value: string | null | undefined,
) {
  if (value) next.set(key, value);
  else next.delete(key);
}

export function writeCsvParam(next: URLSearchParams, key: string, values: string[]) {
  if (values.length > 0) next.set(key, values.join(","));
  else next.delete(key);
}

export function writeIntParam(
  next: URLSearchParams,
  key: string,
  value: number,
  omitWhen = 1,
) {
  if (value <= omitWhen) next.delete(key);
  else next.set(key, String(value));
}

export function writeEnumParam<T extends string>(
  next: URLSearchParams,
  key: string,
  value: T,
  defaultValue: T,
) {
  if (value === defaultValue) next.delete(key);
  else next.set(key, value);
}

export function useReplaceSearchParams() {
  const [, setSearchParams] = useSearchParams();

  return useCallback((mutate: (params: URLSearchParams) => void) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        mutate(next);
        if (next.toString() === prev.toString()) return prev;
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);
}
