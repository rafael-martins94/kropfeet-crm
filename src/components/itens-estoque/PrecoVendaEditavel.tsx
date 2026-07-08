import { useEffect, useRef, useState } from "react";
import { IconEdit } from "../Icons";
import { cn } from "../../utils/cn";
import { formatarPrecoVendaItem, resolverMoedaVendaItem } from "../../utils/moedaItemEstoque";
import { formatPrecoInput, parsePrecoInput } from "../../utils/precoInput";

type PrecoVendaEditavelProps = {
  idItemEstoque: string;
  preco_venda?: number | null;
  moeda_venda?: string | null;
  tipoRegiaoLocal?: string | null;
  className?: string;
  destaque?: boolean;
  disabled?: boolean;
  onSalvo: (preco: number, moeda: string | null) => Promise<void>;
};

export function PrecoVendaEditavel({
  idItemEstoque,
  preco_venda,
  moeda_venda,
  tipoRegiaoLocal,
  className,
  destaque,
  disabled,
  onSalvo,
}: PrecoVendaEditavelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  const moedaResolvida = resolverMoedaVendaItem(moeda_venda, tipoRegiaoLocal);
  const textoExibido = formatarPrecoVendaItem(preco_venda, moeda_venda, tipoRegiaoLocal);

  useEffect(() => {
    if (editando) inputRef.current?.focus();
  }, [editando]);

  const iniciarEdicao = () => {
    if (disabled || salvando) return;
    setValor(formatPrecoInput(preco_venda));
    setEditando(true);
  };

  const cancelar = () => {
    setEditando(false);
    setValor("");
  };

  const salvar = async () => {
    const preco = parsePrecoInput(valor);
    if (preco == null) {
      alert("Informe um preço válido.");
      return;
    }
    if (preco === preco_venda) {
      cancelar();
      return;
    }

    setSalvando(true);
    try {
      await onSalvo(preco, moeda_venda ?? moedaResolvida);
      cancelar();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível salvar o preço.");
    } finally {
      setSalvando(false);
    }
  };

  const textoClassName = cn(
    "font-numeric tabular-nums",
    destaque ? "text-lg font-bold text-brand-800" : "text-sm font-semibold text-ink",
    className,
  );

  if (editando) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <input
          ref={inputRef}
          className="input-base w-28 py-1 font-numeric text-sm"
          value={valor}
          disabled={salvando}
          placeholder="0,00"
          onChange={(event) => setValor(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void salvar();
            if (event.key === "Escape") cancelar();
          }}
          onBlur={() => void salvar()}
        />
        {moedaResolvida ? (
          <span className="text-xs font-semibold text-ink-muted">{moedaResolvida}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={textoClassName}>{textoExibido ?? "—"}</span>
      <button
        type="button"
        className="inline-flex shrink-0 rounded p-0.5 text-ink-muted transition hover:bg-surface-muted hover:text-brand-700 disabled:opacity-50"
        aria-label={`Editar preço do item ${idItemEstoque}`}
        disabled={disabled || salvando}
        onClick={iniciarEdicao}
      >
        <IconEdit width={destaque ? 16 : 14} height={destaque ? 16 : 14} />
      </button>
    </div>
  );
}
