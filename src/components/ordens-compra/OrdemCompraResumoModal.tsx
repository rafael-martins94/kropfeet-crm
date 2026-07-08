import { useState } from "react";
import { Link } from "react-router-dom";
import { Modal } from "../Modal";
import { LoadingState } from "../LoadingState";
import { SecondaryButton } from "../PrimaryButton";
import { useAsync } from "../../hooks/useAsync";
import { ordensCompraService } from "../../services/ordens-compra";
import { formatarData, formatarMoeda } from "../../utils/format";
import { cn } from "../../utils/cn";

type OrdemCompraResumoModalProps = {
  open: boolean;
  onClose: () => void;
  idOrdemCompra: string;
  sku?: string;
};

export function OrdemCompraResumoModal({
  open,
  onClose,
  idOrdemCompra,
  sku,
}: OrdemCompraResumoModalProps) {
  const ordem = useAsync(
    () => (open ? ordensCompraService.obter(idOrdemCompra) : Promise.resolve(null)),
    [open, idOrdemCompra],
  );

  const item = ordem.data?.item;
  const tituloItem = item?.codigo_fornecedor ?? item?.sku ?? sku;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Ordem de compra"
      description={tituloItem ? `Custo de aquisição do item ${tituloItem}` : "Custo de aquisição do item"}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {ordem.data ? (
            <Link
              to={`/ordens-compra/${ordem.data.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-brand-700 hover:text-brand-800"
            >
              Abrir ordem completa
            </Link>
          ) : (
            <span />
          )}
          <SecondaryButton onClick={onClose}>Fechar</SecondaryButton>
        </div>
      }
    >
      {ordem.loading ? (
        <LoadingState label="Carregando ordem…" />
      ) : ordem.error ? (
        <p className="text-sm text-red-700">{ordem.error.message}</p>
      ) : !ordem.data ? (
        <p className="text-sm text-ink-soft">Ordem de compra não encontrada.</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-surface-muted px-4 py-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
              Valor custo
            </p>
            <p className="mt-1 font-numeric text-3xl font-semibold tabular-nums text-ink">
              {formatarMoeda(ordem.data.valor_custo, ordem.data.moeda_compra)}
            </p>
          </div>

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
                Data da compra
              </dt>
              <dd className="mt-1 text-sm font-medium text-ink">
                {formatarData(ordem.data.data_compra)}
              </dd>
            </div>
            <div>
              <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
                Fornecedor
              </dt>
              <dd className="mt-1 text-sm font-medium text-ink">
                {ordem.data.fornecedor?.nome ?? "—"}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </Modal>
  );
}

export function BotaoOrdemCompraItem({
  idOrdemCompra,
  className,
  sku,
  variant = "default",
}: {
  idOrdemCompra?: string | null;
  className?: string;
  sku?: string;
  variant?: "default" | "link";
}) {
  const [open, setOpen] = useState(false);

  if (!idOrdemCompra) return null;

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          variant === "link"
            ? "text-[11px] font-medium text-brand-700 underline-offset-2 transition hover:text-brand-800 hover:underline"
            : "inline-flex items-center rounded-md border border-line bg-white px-2 py-1 text-xs font-medium text-ink-muted transition hover:border-brand-400 hover:text-brand-700",
          className,
        )}
      >
        {variant === "link" ? "Ver custo" : "Ordem de compra"}
      </button>
      <OrdemCompraResumoModal
        open={open}
        onClose={() => setOpen(false)}
        idOrdemCompra={idOrdemCompra}
        sku={sku}
      />
    </>
  );
}
