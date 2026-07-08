import { useEffect, useRef, useState } from "react";
import { vitrinesService } from "../../services/vitrines";
import { cn } from "../../utils/cn";
import { mensagemErro } from "../../utils/errors";

type VitrineTituloEditavelProps = {
  idVitrine: string;
  titulo: string;
  className?: string;
  editavel?: boolean;
  onAtualizado?: (titulo: string) => void;
};

export function VitrineTituloEditavel({
  idVitrine,
  titulo,
  className,
  editavel = true,
  onAtualizado,
}: VitrineTituloEditavelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(titulo);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setValor(titulo);
  }, [titulo]);

  useEffect(() => {
    if (!editando) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editando]);

  const cancelar = () => {
    setValor(titulo);
    setEditando(false);
  };

  const salvar = async () => {
    const novoTitulo = valor.trim();
    if (!novoTitulo) {
      cancelar();
      return;
    }
    if (novoTitulo === titulo) {
      setEditando(false);
      return;
    }

    setSalvando(true);
    try {
      await vitrinesService.atualizarTitulo(idVitrine, novoTitulo);
      onAtualizado?.(novoTitulo);
      setEditando(false);
    } catch (error) {
      alert(mensagemErro(error));
      cancelar();
    } finally {
      setSalvando(false);
    }
  };

  if (!editavel) {
    return <span className={className}>{titulo}</span>;
  }

  if (editando) {
    return (
      <input
        ref={inputRef}
        value={valor}
        disabled={salvando}
        size={Math.max(valor.length, 16)}
        onChange={(event) => setValor(event.target.value)}
        onBlur={() => void salvar()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void salvar();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            cancelar();
          }
        }}
        className={cn(
          className,
          "min-w-[12rem] rounded-lg border border-brand-300 bg-white px-2 py-0.5 outline-none ring-2 ring-brand-200",
        )}
        aria-label="Nome da vitrine"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      className={cn(
        className,
        "whitespace-nowrap rounded-lg px-1 -mx-1 text-left transition hover:bg-brand-50/80 hover:text-brand-800",
      )}
      title="Clique para editar o nome"
    >
      {titulo}
    </button>
  );
}
