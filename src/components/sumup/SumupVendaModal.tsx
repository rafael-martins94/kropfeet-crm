import { EntityLink } from "../EntityLink";
import { Modal } from "../Modal";
import { StatusBadge } from "../StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import {
  CONTAS_SUMUP,
  obterVendaSumupPorCodigo,
  type ContaSumup,
  type RecebivelSumup,
  type VendaSumup,
} from "../../services/sumup";
import { formatarDataHoraPortugal, formatarDataPortugal, formatarEuro } from "../../utils/fusoPortugal";
import {
  rotuloPagamentoSumup,
  rotuloParcelasSumup,
  rotuloStatusSumup,
  rotuloTipoSumup,
  tomStatusSumup,
} from "../../utils/sumupRotulos";

export function SumupVendaModal({
  venda,
  conta,
  ordem,
  onClose,
}: {
  venda: VendaSumup | null;
  conta: ContaSumup;
  ordem?: { id: string; numero: string | null } | null;
  onClose: () => void;
}) {
  const nomeConta = CONTAS_SUMUP.find((c) => c.valor === conta)?.rotulo ?? "SumUp";

  return (
    <Modal
      open={venda !== null}
      onClose={onClose}
      title={venda?.codigo ?? `Venda ${nomeConta}`}
      description={venda ? `${formatarDataHoraPortugal(venda.data)} · ${nomeConta}` : undefined}
      size="xl"
    >
      {venda ? (
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-numeric text-2xl font-medium tabular-nums text-ink">
                {formatarEuro(venda.valor, venda.moeda)}
              </div>
              <div className="mt-1 text-xs text-ink-soft">
                {rotuloPagamentoSumup(venda)}
                {" · "}
                {rotuloParcelasSumup(venda.parcelas)}
                {" · "}
                {rotuloTipoSumup(venda.tipo)}
              </div>
            </div>
            <StatusBadge
              value={venda.status}
              label={rotuloStatusSumup(venda.status)}
              tom={tomStatusSumup(venda.status)}
            />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <CampoDetalhe
              rotulo="Ordem"
              valor={
                ordem ? (
                  <EntityLink to={`/vendas/${ordem.id}`} className="font-numeric tabular-nums text-sm">
                    {ordem.numero ?? "Pedido"}
                  </EntityLink>
                ) : (
                  "Sem pedido vinculado"
                )
              }
            />
            <CampoDetalhe rotulo="Descrição" valor={venda.descricao ?? "—"} />
            <CampoDetalhe rotulo="Usuário" valor={venda.usuario ?? "—"} />
            {venda.valorEstornado ? (
              <CampoDetalhe rotulo="Estornado" valor={formatarEuro(venda.valorEstornado, venda.moeda)} />
            ) : null}
          </dl>

          <div className="mt-5 border-t border-line pt-4">
            <RepassesVenda codigo={venda.codigo} conta={conta} moeda={venda.moeda} />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function CampoDetalhe({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-ink-soft">{rotulo}</div>
      <div className="mt-0.5 break-words text-sm text-ink">{valor}</div>
    </div>
  );
}

const ROTULO_REPASSE: Record<string, string> = {
  PAID_OUT: "Pago",
  SCHEDULED: "Agendado",
  PENDING: "Pendente",
  RECONCILED: "Conciliado",
  FAILED: "Falhou",
};

function tomRepasse(status: string | null): "sucesso" | "aviso" | "erro" | "info" | "neutro" {
  if (status === "PAID_OUT") return "sucesso";
  if (status === "FAILED") return "erro";
  if (status === "RECONCILED") return "info";
  if (status === "SCHEDULED" || status === "PENDING") return "aviso";
  return "neutro";
}

function somarRecebiveis(itens: RecebivelSumup[], campo: "valorBruto" | "taxa" | "valorLiquido"): number {
  return itens.reduce((total, item) => total + (item[campo] ?? 0), 0);
}

function RepassesVenda({
  codigo,
  conta,
  moeda,
}: {
  codigo: string | null;
  conta: ContaSumup;
  moeda: string;
}) {
  const consulta = useAsync(
    async () => (codigo ? (await obterVendaSumupPorCodigo(codigo, conta)).recebiveis : []),
    [codigo, conta],
  );
  if (!codigo) return null;

  const repasses = (consulta.data ?? [])
    .filter((r) => r.tipo === "PAYOUT")
    .slice()
    .sort(
      (a, b) =>
        (a.parcela ?? 0) - (b.parcela ?? 0) || (a.dataPrevista ?? "").localeCompare(b.dataPrevista ?? ""),
    );
  const pagos = repasses.filter((r) => r.status === "PAID_OUT");
  const proximo = repasses.find((r) => r.status !== "PAID_OUT" && r.status !== "FAILED");
  const progresso = repasses.length === 0 ? 0 : Math.round((pagos.length / repasses.length) * 100);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">Recebíveis</div>
        {!consulta.loading && !consulta.error && repasses.length > 0 ? (
          <div className="text-xs text-ink-soft">
            {pagos.length} de {repasses.length} {repasses.length === 1 ? "pago" : "pagos"}
          </div>
        ) : null}
      </div>

      {consulta.loading ? (
        <div className="mt-3 space-y-2">
          <div className="skeleton h-8 w-full" />
          <div className="skeleton h-8 w-full" />
          <div className="skeleton h-8 w-3/4" />
        </div>
      ) : consulta.error ? (
        <div className="mt-2 text-sm text-red-700">{consulta.error.message}</div>
      ) : repasses.length === 0 ? (
        <div className="mt-2 text-sm text-ink-soft">A SumUp ainda não informou os repasses desta venda.</div>
      ) : (
        <>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${progresso}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            {proximo ? (
              <>
                Próximo repasse em{" "}
                <span className="font-numeric">
                  {proximo.dataPrevista ? formatarDataPortugal(proximo.dataPrevista) : "data não informada"}
                </span>
                {proximo.valorLiquido != null ? (
                  <>
                    {" · líquido "}
                    <span className="font-numeric">{formatarEuro(proximo.valorLiquido, moeda)}</span>
                  </>
                ) : null}
              </>
            ) : (
              "Todos os repasses desta venda já foram pagos."
            )}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {(
              [
                ["Bruto", somarRecebiveis(repasses, "valorBruto")],
                ["Taxa", somarRecebiveis(repasses, "taxa")],
                ["Líquido", somarRecebiveis(repasses, "valorLiquido")],
              ] as const
            ).map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded-lg border border-line px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-wider text-ink-soft">{rotulo}</div>
                <div className="mt-0.5 font-numeric text-sm font-medium tabular-nums">
                  {formatarEuro(valor, moeda)}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-line">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-16">Parcela</th>
                  <th>Previsto</th>
                  <th>Pago em</th>
                  <th>Situação</th>
                  <th className="text-right">Bruto</th>
                  <th className="text-right">Taxa</th>
                  <th className="text-right">Líquido</th>
                </tr>
              </thead>
              <tbody className="font-numeric tabular-nums text-xs">
                {repasses.map((r) => (
                  <tr key={r.id} className={r.id === proximo?.id ? "bg-amber-50/70" : undefined}>
                    <td>{r.parcela ?? "—"}</td>
                    <td>{r.dataPrevista ? formatarDataPortugal(r.dataPrevista) : "—"}</td>
                    <td>{r.dataPagamento ? formatarDataPortugal(r.dataPagamento) : "—"}</td>
                    <td>
                      <StatusBadge
                        value={r.status ?? "desconhecido"}
                        label={ROTULO_REPASSE[r.status ?? ""] ?? r.status ?? "—"}
                        tom={tomRepasse(r.status)}
                      />
                    </td>
                    <td className="text-right">
                      {r.valorBruto != null ? formatarEuro(r.valorBruto, moeda) : "—"}
                    </td>
                    <td className="text-right">{r.taxa != null ? formatarEuro(r.taxa, moeda) : "—"}</td>
                    <td className="text-right font-medium">
                      {r.valorLiquido != null ? formatarEuro(r.valorLiquido, moeda) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagos.length > 0 && pagos.length < repasses.length ? (
            <p className="mt-2 text-xs text-ink-faint">
              Já recebido:{" "}
              <span className="font-numeric">{formatarEuro(somarRecebiveis(pagos, "valorLiquido"), moeda)}</span>
              {" de "}
              <span className="font-numeric">{formatarEuro(somarRecebiveis(repasses, "valorLiquido"), moeda)}</span>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
