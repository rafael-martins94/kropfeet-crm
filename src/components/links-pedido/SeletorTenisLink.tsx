import { useState, type ReactNode } from "react";
import { FotoThumbnailHover } from "../FotoThumbnailHover";
import { ItensEstoqueFiltrosToolbar } from "../itens-estoque/ItensEstoqueFiltrosToolbar";
import { Pagination } from "../Pagination";
import { ScrollableListShell } from "../ScrollableListShell";
import { LoadingState } from "../LoadingState";
import { EmptyState } from "../EmptyState";
import { StatusBadge } from "../StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { useItensEstoqueFiltros } from "../../hooks/useItensEstoqueFiltros";
import { itensEstoqueService } from "../../services/itens-estoque";
import { modelosProdutoService } from "../../services/modelos-produto";
import { formatarMoeda } from "../../utils/format";
import { itemTemPrecoNaMoeda, normalizarMoeda, numeracaoVisivel } from "../../utils/linkPedido";
import type { DisplaySizeSystem } from "../../utils/sizeConversion";
import { cn } from "../../utils/cn";

export type TenisDoLink = {
  id: string;
  idModelo: string;
  nome: string;
  sku: string;
  numeracao: string;
  origem: string;
  foto: string | null;
  precoOriginal: number | null;
  moedaOriginal: string | null;
  preco: string;
};

function origemDoItem(tipo: string | null | undefined, nomeLocal: string | null | undefined): string {
  if (tipo === "brasil") return "Brasil";
  if (tipo === "europa") return "Europa";
  return nomeLocal || "Estoque";
}

export function SeletorTenisLink({
  moedaDestino,
  selecionados,
  onChange,
  acaoVoltar,
  acaoAvancar,
}: {
  moedaDestino: "BRL" | "EUR";
  selecionados: TenisDoLink[];
  onChange: (itens: TenisDoLink[]) => void;
  acaoVoltar?: ReactNode;
  acaoAvancar?: ReactNode;
}) {
  const filtros = useItensEstoqueFiltros();
  const [padrao, setPadrao] = useState<DisplaySizeSystem | "">("");
  const thumbs = useAsync(() => modelosProdutoService.listarUrlsPrincipaisPorModelo(), []);

  const lista = useAsync(
    () =>
      itensEstoqueService.listarComRelacoes({
        page: filtros.page,
        pageSize: 24,
        ...filtros.paramsListagem,
        idLocalEstoque: undefined,
        displaySizeSystem: padrao || filtros.paramsListagem.displaySizeSystem,
        status: ["em_estoque"],
      }),
    [filtros.page, filtros.paramsListagem, padrao],
  );
  const ids = new Set(selecionados.map((item) => item.id));

  const alternar = (item: NonNullable<typeof lista.data>["data"][number]) => {
    if (item.status_item !== "em_estoque") return;
    if (ids.has(item.id)) {
      onChange(selecionados.filter((atual) => atual.id !== item.id));
      return;
    }
    const moedaOriginal = normalizarMoeda(item.moeda_venda);
    const compativel = itemTemPrecoNaMoeda(
      { moedaOriginal, precoOriginal: item.preco_venda },
      moedaDestino,
    );
    onChange([
      ...selecionados,
      {
        id: item.id,
        idModelo: item.id_modelo_produto,
        nome: item.nome_produto,
        sku: item.sku,
        numeracao: numeracaoVisivel(item, padrao || undefined),
        origem: origemDoItem(item.local?.tipo_regiao, item.local?.nome),
        foto: thumbs.data?.[item.id_modelo_produto] ?? null,
        precoOriginal: item.preco_venda,
        moedaOriginal,
        preco: compativel ? String(item.preco_venda) : "",
      },
    ]);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
        <ScrollableListShell
          toolbar={
            <>
        <ItensEstoqueFiltrosToolbar
          search={filtros.search}
          onSearchChange={filtros.setSearch}
          status={["em_estoque"]}
          onStatusChange={() => undefined}
          localEstoqueIds={[]}
          onLocalEstoqueIdsChange={() => undefined}
          regiaoEstoque={filtros.regiaoEstoque}
          onRegiaoEstoqueChange={filtros.setRegiaoEstoque}
          variant="link"
          categoriaIds={filtros.categoriaIds}
          onCategoriaIdsChange={filtros.setCategoriaIds}
          displaySizeSystem={padrao}
          onDisplaySizeSystemChange={(valor) => {
            setPadrao(valor);
            if (valor) filtros.setDisplaySizeSystem(valor);
          }}
          numeracaoFiltro={filtros.numeracaoFiltro}
          onNumeracaoFiltroChange={filtros.setNumeracaoFiltro}
          opcoesLocalFiltro={filtros.opcoesLocalFiltro}
          opcoesCategoriaFiltro={filtros.opcoesCategoriaFiltro}
          locaisLoading={filtros.locaisLista.loading}
          categoriasLoading={filtros.categoriasLista.loading}
        />
            </>
          }
          body={
            lista.loading ? (
          <LoadingState />
        ) : lista.error ? (
          <p className="p-5 text-sm text-red-700">Erro ao buscar o estoque: {lista.error.message}</p>
        ) : (lista.data?.data.length ?? 0) === 0 ? (
          <EmptyState title="Nenhum tênis em estoque" description="Ajuste a categoria, a numeração, a região ou o nome." />
        ) : (
          <ul className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 ">
            {lista.data?.data.map((item) => {
              const ativo = ids.has(item.id);
              const foto = thumbs.data?.[item.id_modelo_produto] ?? null;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => alternar(item)}
                    aria-pressed={ativo}
                    className={cn(
                      "flex h-full w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                      ativo
                        ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                        : "border-line bg-surface hover:border-brand-300 hover:shadow-sm",
                    )}
                  >
                    <span className="relative shrink-0">
                      <FotoThumbnailHover url={foto} alt={item.nome_produto} />
                      <span
                        className={cn(
                          "absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold",
                          ativo ? "border-brand-600 bg-brand-600 text-white" : "hidden",
                        )}
                        aria-hidden
                      >
                        ✓
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="truncate text-sm font-semibold leading-tight text-ink" title={item.nome_produto}>
                        {item.nome_produto}
                      </span>
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-xs text-ink-soft">{item.sku}</span>
                        <span className="shrink-0">
                          <StatusBadge
                            value={
                              item.local?.tipo_regiao === "europa"
                                ? "europa"
                                : item.local?.tipo_regiao === "brasil"
                                  ? "brasil"
                                  : "outros"
                            }
                            label={origemDoItem(item.local?.tipo_regiao, item.local?.nome)}
                          />
                        </span>
                      </span>
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-ink">
                          {numeracaoVisivel(item, padrao || undefined) || "Sem numeração"}
                        </span>
                        <span className="shrink-0 font-numeric text-sm font-semibold text-ink">
                          {item.preco_venda != null
                            ? formatarMoeda(item.preco_venda, item.moeda_venda ?? moedaDestino)
                            : "Sem preço"}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
            )
          }
          footer={
            <div className="flex flex-col gap-3 border-t border-line px-4 py-2.5 sm:flex-row sm:items-center">
              {acaoVoltar ? <div className="shrink-0">{acaoVoltar}</div> : null}
              <Pagination
                className="flex-1 border-t-0 px-0 py-0"
                page={filtros.page}
                pageSize={24}
                total={lista.data?.total ?? 0}
                onPageChange={filtros.setPage}
              />
              {acaoAvancar ? <div className="shrink-0">{acaoAvancar}</div> : null}
            </div>
          }
        />
      </div>
    </div>
  );
}
