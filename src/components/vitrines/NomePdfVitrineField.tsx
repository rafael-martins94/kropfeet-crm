import { useEffect, useState } from "react";
import { vitrinesService, type VitrineItemDetalhado } from "../../services/vitrines";
import { cn } from "../../utils/cn";
import { mensagemErro } from "../../utils/errors";
import { nomeNoPdf } from "./VitrineShared";

export function NomePdfVitrineField({
  item,
  onSalvo,
  className,
  ocultarRotulo = false,
}: {
  item: VitrineItemDetalhado;
  onSalvo: () => void;
  className?: string;
  ocultarRotulo?: boolean;
}) {
  const exibido = nomeNoPdf(item);
  const [valor, setValor] = useState(exibido === "—" ? "" : exibido);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setValor(exibido === "—" ? "" : exibido);
    setErro(null);
  }, [exibido, item.id]);

  const salvar = async () => {
    const proximo = valor.trim();
    const atual = exibido === "—" ? "" : exibido.trim();
    const personalizado = item.nome_exibicao?.trim() ?? "";
    if (proximo === atual) return;
    if (!proximo && !personalizado) return;

    setSalvando(true);
    setErro(null);
    try {
      await vitrinesService.atualizarNomePdf(item.id, proximo);
      onSalvo();
    } catch (error) {
      setErro(mensagemErro(error));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <label className={cn("mt-3 block", className)}>
      {ocultarRotulo ? null : (
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Nome no PDF</span>
      )}
      <input
        className="input-base mt-1"
        value={valor}
        disabled={salvando}
        aria-label="Nome que aparece no PDF"
        onChange={(event) => setValor(event.target.value)}
        onBlur={() => void salvar()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      {erro ? <span className="mt-1 block text-xs text-red-700">{erro}</span> : null}
    </label>
  );
}
