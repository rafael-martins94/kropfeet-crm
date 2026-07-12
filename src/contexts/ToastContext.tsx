import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/cn";
import { IconCheck, IconX } from "../components/Icons";

export type ToastTone = "sucesso" | "erro" | "aviso" | "info";

export type ToastInput = {
  titulo?: string;
  mensagem: string;
  tone?: ToastTone;
  /** ms; padrão varia por tom. `0` = não fecha sozinho. */
  duracao?: number;
};

type ToastItem = {
  id: string;
  titulo?: string;
  mensagem: string;
  tone: ToastTone;
  duracao: number;
};

type ToastApi = {
  push: (input: ToastInput) => string;
  sucesso: (mensagem: string, titulo?: string) => string;
  erro: (mensagem: string, titulo?: string) => string;
  aviso: (mensagem: string, titulo?: string) => string;
  info: (mensagem: string, titulo?: string) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const DURACAO_PADRAO: Record<ToastTone, number> = {
  sucesso: 4000,
  info: 4500,
  aviso: 6000,
  erro: 8000,
};

const TOM_UI: Record<
  ToastTone,
  { wrap: string; iconWrap: string; titulo: string; label: string }
> = {
  sucesso: {
    wrap: "border-emerald-200 bg-emerald-50/95",
    iconWrap: "bg-emerald-100 text-emerald-800",
    titulo: "text-emerald-950",
    label: "Sucesso",
  },
  erro: {
    wrap: "border-red-200 bg-red-50/95",
    iconWrap: "bg-red-100 text-red-800",
    titulo: "text-red-950",
    label: "Erro",
  },
  aviso: {
    wrap: "border-amber-200 bg-amber-50/95",
    iconWrap: "bg-amber-100 text-amber-900",
    titulo: "text-amber-950",
    label: "Aviso",
  },
  info: {
    wrap: "border-sky-200 bg-sky-50/95",
    iconWrap: "bg-sky-100 text-sky-800",
    titulo: "text-sky-950",
    label: "Info",
  },
};

function IconToast({ tone }: { tone: ToastTone }) {
  if (tone === "sucesso") return <IconCheck width={16} height={16} />;
  if (tone === "erro") return <IconX width={16} height={16} />;
  if (tone === "aviso") {
    return (
      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
        <path d="M10.3 4.9 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.9a2 2 0 0 0-3.4 0Z" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const ui = TOM_UI[item.tone];
  return (
    <div
      role={item.tone === "erro" || item.tone === "aviso" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-[min(22rem,calc(100vw-1.5rem))] gap-3 rounded-xl border p-3 shadow-lg ring-1 ring-black/[0.04] backdrop-blur-sm",
        ui.wrap,
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          ui.iconWrap,
        )}
      >
        <IconToast tone={item.tone} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold", ui.titulo)}>
          {item.titulo ?? ui.label}
        </p>
        <p className="mt-0.5 text-sm leading-snug text-ink/90">{item.mensagem}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="shrink-0 rounded-md p-1 text-ink-soft transition hover:bg-white/70 hover:text-ink"
        aria-label="Fechar"
      >
        <IconX width={14} height={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) {
      window.clearTimeout(t);
      timers.current.delete(id);
    }
    setItens((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const clear = useCallback(() => {
    for (const t of timers.current.values()) window.clearTimeout(t);
    timers.current.clear();
    setItens([]);
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const tone = input.tone ?? "info";
      const id = `toast-${crypto.randomUUID()}`;
      const duracao =
        input.duracao === undefined ? DURACAO_PADRAO[tone] : input.duracao;
      const item: ToastItem = {
        id,
        titulo: input.titulo,
        mensagem: input.mensagem,
        tone,
        duracao,
      };

      setItens((prev) => [...prev, item].slice(-5));

      if (duracao > 0) {
        const timer = window.setTimeout(() => dismiss(id), duracao);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      sucesso: (mensagem, titulo) => push({ mensagem, titulo, tone: "sucesso" }),
      erro: (mensagem, titulo) => push({ mensagem, titulo, tone: "erro" }),
      aviso: (mensagem, titulo) => push({ mensagem, titulo, tone: "aviso" }),
      info: (mensagem, titulo) => push({ mensagem, titulo, tone: "info" }),
      dismiss,
      clear,
    }),
    [push, dismiss, clear],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed right-3 top-3 z-[100] flex flex-col gap-2 sm:right-4 sm:top-4"
          aria-live="polite"
          aria-relevant="additions"
        >
          {itens.map((item) => (
            <ToastCard key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast deve ser usado dentro de <ToastProvider>.");
  }
  return ctx;
}
