import { useEffect, useState, type FormEvent } from "react";
import { FormInput } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { categoriasService } from "../../services/categorias";
import type { Categoria } from "../../types/entities";

interface CategoriaFormModalProps {
  open: boolean;
  onClose: () => void;
  categoria?: Categoria | null;
  onSaved?: (c: Categoria) => void;
}

export function CategoriaFormModal({
  open,
  onClose,
  categoria,
  onSaved,
}: CategoriaFormModalProps) {
  const edicao = Boolean(categoria?.id);
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNome(categoria?.nome ?? "");
    setErro(null);
    setSalvando(false);
  }, [open, categoria]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      setErro("Informe o nome da categoria.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const salva = categoria?.id
        ? await categoriasService.atualizar(categoria.id, { nome: nomeLimpo })
        : await categoriasService.criar({ nome: nomeLimpo });
      onSaved?.(salva);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={salvando ? () => {} : onClose}
      title={edicao ? "Editar categoria" : "Nova categoria"}
      description={
        edicao
          ? "Atualize o nome da categoria."
          : "Informe o nome da nova categoria."
      }
      closeOnBackdropClick={!salvando}
    >
      <form onSubmit={handleSubmit} className="space-y-4" id="categoria-form">
        <FormInput
          label="Nome da categoria"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoFocus
          placeholder="Ex.: Tênis Esportivo"
        />
        {erro ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </div>
        ) : null}
        <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
          <SecondaryButton type="button" onClick={onClose} disabled={salvando}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton type="submit" loading={salvando}>
            {edicao ? "Salvar alterações" : "Criar categoria"}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
