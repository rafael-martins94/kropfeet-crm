import { useEffect, useId, useRef, useState } from "react";
import { FieldWrapper } from "../FormField";
import { IconPlus, IconSearch, IconTrash } from "../Icons";
import { itensEstoqueService } from "../../services/itens-estoque";
import { useDebounce } from "../../hooks/useDebounce";
import { formatarMoeda } from "../../utils/format";
import type { TipoRegiao } from "../../types/entities";

export type ItemVendaFormLinha = {
  key: string;
  id_item_estoque: string | null;
  codigo: string;
  descricao: string;
  valor_unitario: string;
};

type ResultadoBusca = {
  id: string;
  sku: string;
  nome_produto: string;
  preco_venda: number | null;
  moeda_venda: string | null;
  numeracao_br: number | null;
};

interface ItensVendaEditorProps {
  value: ItemVendaFormLinha[];
  onChange: (itens: ItemVendaFormLinha[]) => void;
  regiao: TipoRegiao;
  moeda: string;
}

function novaKey() {
  return `item-${crypto.randomUUID()}`;
}

export function totalItensVenda(itens: ItemVendaFormLinha[]): number {
  return itens.reduce((acc, item) => {
    const unit = Number(String(item.valor_unitario).replace(",", "."));
    if (!Number.isFinite(unit)) return acc;
    return acc + unit;
  }, 0);
}

export function ItensVendaEditor({ value, onChange, regiao, moeda }: ItensVendaEditorProps) {
  const listId = useId();
  const painelRef = useRef<HTMLDivElement | null>(null);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const buscaDebounced = useDebounce(busca, 300);
  const idsNaLista = value
    .map((i) => i.id_item_estoque)
    .filter((id): id is string => Boolean(id));

  useEffect(() => {
    let cancelado = false;
    if (!aberto) return;

    setBuscando(true);
    itensEstoqueService
      .buscarParaVenda({
        search: buscaDebounced,
        regiao,
        idsExcluidos: idsNaLista,
        limit: 20,
      })
      .then((lista) => {
        if (!cancelado) setResultados(lista);
      })
      .catch(() => {
        if (!cancelado) setResultados([]);
      })
      .finally(() => {
        if (!cancelado) setBuscando(false);
      });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, buscaDebounced, regiao, idsNaLista.join(",")]);

  useEffect(() => {
    if (!aberto) return;
    const onDoc = (e: MouseEvent) => {
      if (!painelRef.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [aberto]);

  const adicionar = (item: ResultadoBusca) => {
    if (value.some((v) => v.id_item_estoque === item.id)) return;
    onChange([
      ...value,
      {
        key: novaKey(),
        id_item_estoque: item.id,
        codigo: item.sku,
        descricao: item.nome_produto,
        valor_unitario: item.preco_venda != null ? String(item.preco_venda) : "0",
      },
    ]);
    setBusca("");
    setAberto(false);
  };

  const remover = (key: string) => {
    onChange(value.filter((item) => item.key !== key));
  };

  const subtotal = totalItensVenda(value);

  return (
    <div className="space-y-4">
      <div ref={painelRef} className="relative">
        <FieldWrapper id={`${listId}-busca`} label="Adicionar item de estoque">
          <div className="relative">
            <IconSearch
              width={16}
              height={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              id={`${listId}-busca`}
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setAberto(true);
              }}
              onFocus={() => setAberto(true)}
              placeholder={
                regiao === "europa"
                  ? "Buscar estoque Europa (SKU ou nome)…"
                  : regiao === "brasil"
                    ? "Buscar estoque Brasil (SKU ou nome)…"
                    : "Buscar por SKU ou nome…"
              }
              className="input-base pl-9"
              autoComplete="off"
            />
          </div>
        </FieldWrapper>

        {aberto ? (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-line bg-surface shadow-elevated">
            {buscando ? (
              <p className="px-3 py-3 text-sm text-ink-soft">Buscando…</p>
            ) : resultados.length === 0 ? (
              <p className="px-3 py-3 text-sm text-ink-soft">
                {buscaDebounced
                  ? regiao === "europa"
                    ? "Nenhum item em estoque na Europa encontrado."
                    : regiao === "brasil"
                      ? "Nenhum item em estoque no Brasil encontrado."
                      : "Nenhum item em estoque encontrado."
                  : "Digite para buscar itens em estoque desta região."}
              </p>
            ) : (
              <ul className="py-1">
                {resultados.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => adicionar(item)}
                      className="flex w-full items-start gap-3 px-3 py-2 text-left transition hover:bg-surface-subtle"
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                        <IconPlus width={14} height={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {item.nome_produto}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-soft">
                          SKU {item.sku}
                          {item.numeracao_br != null ? ` · nº ${item.numeracao_br}` : ""}
                          {item.preco_venda != null
                            ? ` · ${formatarMoeda(item.preco_venda, item.moeda_venda || moeda)}`
                            : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      {value.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface-subtle/30 px-4 py-8 text-center">
          <p className="text-sm text-ink-soft">Nenhum item na ordem ainda.</p>
          <p className="mt-1 text-xs text-ink-faint">Busque acima para adicionar itens em estoque.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="table-base">
            <thead>
              <tr>
                <th>Item</th>
                <th className="w-40 text-right">Valor</th>
                <th className="w-12">
                  <span className="sr-only">Remover</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {value.map((item) => {
                const unit = Number(String(item.valor_unitario).replace(",", "."));
                return (
                  <tr key={item.key}>
                    <td>
                      <div className="min-w-0 font-medium text-ink">{item.descricao || "—"}</div>
                      {item.codigo ? (
                        <div className="font-numeric text-xs tabular-nums text-ink-soft">
                          SKU {item.codigo}
                        </div>
                      ) : null}
                    </td>
                    <td className="text-right font-numeric tabular-nums text-sm">
                      {Number.isFinite(unit) ? formatarMoeda(unit, moeda) : "—"}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="btn-ghost h-8 w-8 p-0 text-ink-soft hover:text-red-600"
                        onClick={() => remover(item.key)}
                        aria-label={`Remover ${item.descricao}`}
                      >
                        <IconTrash width={16} height={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-line bg-surface-subtle/40 px-4 py-3 text-sm">
            <span className="text-ink-soft">{value.length} item(ns)</span>
            <span className="font-numeric font-semibold tabular-nums text-ink">
              Subtotal {formatarMoeda(subtotal, moeda)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
