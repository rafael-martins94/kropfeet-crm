import { useState } from "react";
import { FormInput } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { conferenciasEstoqueService } from "../../services/conferencias-estoque";
import { mensagemErro } from "../../utils/errors";

interface NovaConferenciaModalProps {
  open: boolean;
  onClose: () => void;
  onCriada: (id: string) => void;
}

export function NovaConferenciaModal({ open, onClose, onCriada }: NovaConferenciaModalProps) {
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fechar = () => {
    if (salvando) return;
    setNome("");
    setErro(null);
    onClose();
  };

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      setErro("Informe um nome para a conferência.");
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const id = await conferenciasEstoqueService.criar(nomeLimpo);
      setNome("");
      onCriada(id);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={fechar}
      title="Nova conferência"
      description="Dê um nome para identificar esta sessão de conferência de estoque."
      size="md"
      className="max-w-md"
    >
      <form onSubmit={(e) => void criar(e)} className="space-y-4">
        <FormInput
          id="nome-conferencia"
          label="Nome da conferência"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Conferência mensal — junho"
          autoFocus
          disabled={salvando}
          maxLength={120}
        />

        {erro ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
          <SecondaryButton type="button" onClick={fechar} disabled={salvando}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton type="submit" loading={salvando}>
            Criar conferência
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
