type Nivel = "debug" | "info" | "warn" | "error";

function formatar(nivel: Nivel, msg: string, meta?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${nivel.toUpperCase()}] ${msg}`;
  if (!meta) return base;
  try {
    return `${base} ${JSON.stringify(meta)}`;
  } catch {
    return base;
  }
}

export const logger = {
  debug(msg: string, meta?: Record<string, unknown>): void {
    if (process.env.LOG_LEVEL === "debug") {
      console.log(formatar("debug", msg, meta));
    }
  },
  info(msg: string, meta?: Record<string, unknown>): void {
    console.log(formatar("info", msg, meta));
  },
  warn(msg: string, meta?: Record<string, unknown>): void {
    console.warn(formatar("warn", msg, meta));
  },
  error(msg: string, meta?: Record<string, unknown>): void {
    console.error(formatar("error", msg, meta));
  },
};
