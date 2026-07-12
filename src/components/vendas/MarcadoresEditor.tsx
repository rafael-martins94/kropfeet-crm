import { useState, type KeyboardEvent } from "react";
import { cn } from "../../utils/cn";
import { IconPlus, IconTag, IconX } from "../Icons";

export interface Marcador {
  id?: string;
  descricao?: string;
  cor?: string;
}

const CORES_PADRAO = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
];

interface MarcadoresEditorProps {
  value: Marcador[];
  onChange: (value: Marcador[]) => void;
}

export function MarcadoresEditor({ value, onChange }: MarcadoresEditorProps) {
  const [texto, setTexto] = useState("");
  const [cor, setCor] = useState(CORES_PADRAO[5]);

  const adicionar = () => {
    const descricao = texto.trim();
    if (!descricao) return;
    const jaExiste = value.some(
      (m) => (m.descricao ?? "").toLowerCase() === descricao.toLowerCase(),
    );
    if (jaExiste) {
      setTexto("");
      return;
    }
    onChange([...value, { descricao, cor }]);
    setTexto("");
  };

  const remover = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      adicionar();
    }
  };

  return (
    <div className="min-w-0 space-y-3">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((m, i) => (
            <span
              key={m.id ?? `${m.descricao}-${i}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface-subtle py-1 pl-2.5 pr-1 text-xs text-ink"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: m.cor || "#808080" }}
              />
              <span className="min-w-0 truncate">{m.descricao ?? "—"}</span>
              <button
                type="button"
                onClick={() => remover(i)}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-red-100 hover:text-red-600"
                aria-label={`Remover ${m.descricao ?? "marcador"}`}
              >
                <IconX width={11} height={11} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="flex items-start gap-1.5 text-xs text-ink-faint">
          <IconTag width={14} height={14} className="mt-0.5 shrink-0" />
          <span>Nenhuma tag ainda.</span>
        </p>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {CORES_PADRAO.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCor(c)}
              className={cn(
                "h-5 w-5 shrink-0 rounded-full ring-2 ring-offset-1 ring-offset-surface transition-transform hover:scale-110",
                cor === c ? "ring-ink/40" : "ring-transparent",
              )}
              style={{ backgroundColor: c }}
              aria-label={`Cor ${c}`}
            />
          ))}
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Nova tag…"
            className="input-base min-w-0 flex-1 px-2.5 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={adicionar}
            disabled={!texto.trim()}
            className="btn-secondary shrink-0 px-2.5 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Adicionar tag"
            title="Adicionar"
          >
            <IconPlus width={16} height={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
