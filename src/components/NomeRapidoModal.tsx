import { useEffect, useState, type FormEvent } from "react";
import { FormInput } from "./FormField";
import { Modal } from "./Modal";
import { PrimaryButton, SecondaryButton } from "./PrimaryButton";

type NomeRapidoModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  label: string;
  placeholder?: string;
  onCriado: (item: { id: string; nome: string }) => void;
  criar: (nome: string) => Promise<{ id: string; nome: string }>;
};

export function NomeRapidoModal({
  open,
  onClose,
  title,
  label,
  placeholder,
  onCriado,
  criar,
}: NomeRapidoModalProps) {
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNome("");
    setErro(null);
  }, [open]);

  const handleClose = () => {
    setNome("");
    setErro(null);
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const valor = nome.trim();
    if (!valor) {
      setErro(`Informe o ${label.toLowerCase()}.`);
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const criado = await criar(valor);
      onCriado({ id: criado.id, nome: criado.nome });
      handleClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      size="sm"
      footer={
        <>
          <SecondaryButton type="button" onClick={handleClose}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton type="submit" form="nome-rapido-form" loading={salvando}>
            Criar e selecionar
          </PrimaryButton>
        </>
      }
    >
      <form id="nome-rapido-form" onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label={label}
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={placeholder}
          autoFocus
        />
        {erro ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
