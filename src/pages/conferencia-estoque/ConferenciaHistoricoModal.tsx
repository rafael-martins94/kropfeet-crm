import { useEffect, useState } from "react";
import { Modal } from "../../components/Modal";
import { SecondaryButton } from "../../components/PrimaryButton";
import {
  conferenciasEstoqueService,
  type ConferenciaHistoricoDia,
} from "../../services/conferencias-estoque";
import { formatarData } from "../../utils/format";
import { mensagemErro } from "../../utils/errors";

interface ConferenciaHistoricoModalProps {
  open: boolean;
  onClose: () => void;
}

function formatarDataConferencia(iso: string): string {
  return formatarData(`${iso}T12:00:00`, { dateStyle: "long" });
}

function rotuloItensConferidos(total: number): string {
  if (total === 1) return "1 item conferido";
  return `${total.toLocaleString("pt-BR")} itens conferidos`;
}

export function ConferenciaHistoricoModal({ open, onClose }: ConferenciaHistoricoModalProps) {
  const [historico, setHistorico] = useState<ConferenciaHistoricoDia[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelado = false;
    setLoading(true);
    setErro(null);
    setHistorico(null);

    conferenciasEstoqueService
      .historicoResumoPorData()
      .then((dados) => {
        if (!cancelado) setHistorico(dados);
      })
      .catch((e) => {
        if (!cancelado) setErro(mensagemErro(e));
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Histórico de conferências"
      description="Resumo das conferências de estoque agrupadas por dia."
      size="lg"
      className="max-w-xl"
    >
      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-ink-soft">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          <span className="ml-3">Carregando histórico…</span>
        </div>
      ) : erro ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {erro}
        </div>
      ) : historico && historico.length > 0 ? (
        <ul className="max-h-[min(60vh,28rem)] space-y-2 overflow-y-auto pr-1">
          {historico.map((dia) => (
            <li
              key={dia.data}
              className="rounded-xl border border-line bg-surface-muted/40 px-4 py-3 text-sm text-ink"
            >
              Conferência dia {formatarDataConferencia(dia.data)} —{" "}
              {rotuloItensConferidos(dia.totalItens)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-ink-soft">
          Nenhuma conferência registrada ainda.
        </p>
      )}

      <div className="mt-5 flex justify-end border-t border-line pt-4">
        <SecondaryButton type="button" onClick={onClose}>
          Fechar
        </SecondaryButton>
      </div>
    </Modal>
  );
}
