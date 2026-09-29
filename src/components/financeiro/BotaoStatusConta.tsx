import { cn } from "../../utils/cn";

export function BotaoStatusConta({
  tipo,
  ocupado,
  onClick,
}: {
  tipo: "receber" | "estornar";
  ocupado?: boolean;
  onClick: () => void;
}) {
  const receber = tipo === "receber";
  const rotulo = receber ? "Marcar recebido" : "Estornar";
  return (
    <button
      type="button"
      disabled={ocupado}
      onClick={onClick}
      title={receber ? "Marcar como recebida na data de vencimento" : "Estornar o recebimento"}
      aria-label={rotulo}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition disabled:cursor-wait disabled:opacity-60",
        receber
          ? "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
          : "border-line bg-white text-ink-soft hover:border-amber-300 hover:bg-amber-50 hover:text-amber-950",
      )}
    >
      {ocupado ? (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      ) : receber ? (
        <CheckIcon />
      ) : (
        <UndoIcon />
      )}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2.5 6.2 4.8 8.5 9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2.2 4.5h5.2a2.6 2.6 0 1 1 0 5.2H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 2.4 2 4.5l2 2.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
