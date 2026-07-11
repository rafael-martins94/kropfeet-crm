import { Link } from "react-router-dom";
import { Modal } from "../Modal";
import { FotoThumbnailHover } from "../FotoThumbnailHover";
import { SecondaryButton } from "../PrimaryButton";
import { useAsync } from "../../hooks/useAsync";
import { modelosProdutoService } from "../../services/modelos-produto";
import type { VendaDetalhada } from "../../services/vendas";
import { formatarMoeda } from "../../utils/format";

type ItemResumo = NonNullable<NonNullable<VendaDetalhada["itens"]>[number]>;

function skuDoItem(item: ItemResumo): string {
  return item.item_estoque?.sku?.trim() || item.codigo?.trim() || "—";
}

function nomeDoItem(item: ItemResumo): string {
  return item.item_estoque?.nome_produto?.trim() || item.descricao?.trim() || "Item sem nome";
}

type VendaItensModalProps = {
  open: boolean;
  onClose: () => void;
  venda: VendaDetalhada | null;
  moeda: string;
};

export function VendaItensModal({ open, onClose, venda, moeda }: VendaItensModalProps) {
  const itens = venda?.itens ?? [];
  const numero = venda?.numero ?? "—";
  const modeloIds = itens
    .map((item) => item.item_estoque?.id_modelo_produto)
    .filter((id): id is string => Boolean(id));
  const thumbs = useAsync(
    () =>
      open && modeloIds.length > 0
        ? modelosProdutoService.listarUrlsPorModelos(modeloIds)
        : Promise.resolve({} as Record<string, string>),
    [open, modeloIds.join(",")],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Itens do pedido ${numero}`}
      description={
        itens.length === 0
          ? "Esta ordem não possui itens vinculados."
          : `${itens.length} ${itens.length === 1 ? "item" : "itens"} nesta ordem.`
      }
      size="lg"
      footer={<SecondaryButton onClick={onClose}>Fechar</SecondaryButton>}
    >
      {itens.length === 0 ? (
        <p className="text-sm text-ink-soft">Nenhum SKU nesta ordem.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-[4.5rem]">
                  <span className="sr-only">Foto</span>
                </th>
                <th>SKU</th>
                <th>Item</th>
                <th className="text-right">Qtd</th>
                <th className="text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => {
                const idModelo = item.item_estoque?.id_modelo_produto;
                const fotoUrl = idModelo ? thumbs.data?.[idModelo] : null;

                return (
                  <tr key={item.id}>
                    <td className="w-[4.5rem] px-2 align-middle">
                      <FotoThumbnailHover
                        url={fotoUrl}
                        alt={nomeDoItem(item)}
                        to={
                          item.item_estoque
                            ? `/itens-estoque/${item.item_estoque.id}`
                            : undefined
                        }
                        size="sm"
                      />
                    </td>
                    <td className="font-numeric tabular-nums text-sm font-medium text-ink">
                      {skuDoItem(item)}
                    </td>
                    <td>
                      {item.item_estoque ? (
                        <Link
                          to={`/itens-estoque/${item.item_estoque.id}`}
                          className="font-medium text-ink hover:text-brand-700"
                          onClick={onClose}
                        >
                          {nomeDoItem(item)}
                        </Link>
                      ) : (
                        <span className="font-medium text-ink">{nomeDoItem(item)}</span>
                      )}
                    </td>
                    <td className="text-right font-numeric tabular-nums text-sm">
                      {item.quantidade}
                    </td>
                    <td className="text-right font-numeric tabular-nums text-sm">
                      {formatarMoeda(Number(item.valor_unitario), moeda)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

/** SKUs para exibir na coluna da listagem. */
export function skusDaVenda(venda: VendaDetalhada): string[] {
  const vistos = new Set<string>();
  const lista: string[] = [];
  for (const item of venda.itens ?? []) {
    const sku = item.item_estoque?.sku?.trim() || item.codigo?.trim();
    if (!sku || vistos.has(sku)) continue;
    vistos.add(sku);
    lista.push(sku);
  }
  return lista;
}
