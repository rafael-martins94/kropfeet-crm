import { useEffect, useState } from "react";
import { Modal } from "../Modal";
import { PrimaryButton, SecondaryButton } from "../PrimaryButton";
import { SearchInput } from "../SearchInput";
import { FotoThumbnailHover } from "../FotoThumbnailHover";
import { useAuth } from "../../contexts/AuthContext";
import { vitrinesService } from "../../services/vitrines";
import { mensagemErro } from "../../utils/errors";
import { formatarNumeracoes } from "./VitrineShared";

type Candidato = Awaited<ReturnType<typeof vitrinesService.listarCandidatosSubstituicao>>[number];

type SubstituirCaixaModalProps = {
  open: boolean;
  idVitrineItem: string;
  numeroCaixa: number | null;
  onClose: () => void;
  onSubstituido: () => void;
};

export function SubstituirCaixaModal({
  open,
  idVitrineItem,
  numeroCaixa,
  onClose,
  onSubstituido,
}: SubstituirCaixaModalProps) {
  const { user } = useAuth();
  const [busca, setBusca] = useState("");
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBusca("");
    setSelecionado(null);
    setErro(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    const timer = window.setTimeout(async () => {
      setCarregando(true);
      setErro(null);
      try {
        const lista = await vitrinesService.listarCandidatosSubstituicao(busca);
        if (!cancelado) setCandidatos(lista);
      } catch (error) {
        if (!cancelado) setErro(mensagemErro(error));
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }, 200);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [open, busca]);

  const confirmar = async () => {
    if (!selecionado) return;
    setSalvando(true);
    setErro(null);
    try {
      await vitrinesService.substituirCaixa(idVitrineItem, selecionado, user?.id);
      onSubstituido();
      onClose();
    } catch (error) {
      setErro(mensagemErro(error));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={numeroCaixa ? `Substituir Caixa ${numeroCaixa}` : "Substituir caixa"}
      description="Escolha um par em estoque na Europa para preencher a caixa vazia."
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose} disabled={salvando}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton onClick={confirmar} loading={salvando} disabled={!selecionado}>
            Confirmar substituição
          </PrimaryButton>
        </div>
      }
    >
      <div className="space-y-3">
        <SearchInput
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Buscar por SKU ou nome"
        />
        {carregando ? <p className="text-sm text-ink-soft">Carregando…</p> : null}
        {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
        {!carregando && candidatos.length === 0 ? (
          <p className="text-sm text-ink-soft">Nenhum item disponível na Europa.</p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {candidatos.map((item) => {
              const ativo = selecionado === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelecionado(item.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                      ativo
                        ? "border-brand-400 bg-brand-50"
                        : "border-line hover:border-brand-300 hover:bg-surface-muted/50"
                    }`}
                  >
                    <FotoThumbnailHover url={item.foto_url} alt={item.nome_produto} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="font-numeric text-xs font-semibold text-ink-muted">
                        SKU {item.sku}
                      </span>
                      <span className="mt-0.5 block truncate text-sm font-medium text-ink">
                        {item.nome_produto}
                      </span>
                      <span className="block text-xs text-ink-soft">
                        {formatarNumeracoes(item)}
                        {item.local_nome ? ` · ${item.local_nome}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
