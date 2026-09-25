import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../utils/cn";
import { listarPaises, montarTelefone, separarTelefone } from "../../utils/paises";

type TelefoneComDdiProps = {
  valor: string;
  onChange: (valor: string) => void;
  idioma?: string;
  codigoSugerido?: string;
  onCodigoChange?: (codigo: string) => void;
  variante?: "crm" | "catalogo";
  required?: boolean;
  id?: string;
  placeholder?: string;
};

export function TelefoneComDdi({
  valor,
  onChange,
  idioma = "pt",
  codigoSugerido = "BR",
  onCodigoChange,
  variante = "crm",
  required,
  id,
  placeholder,
}: TelefoneComDdiProps) {
  const paises = useMemo(() => listarPaises(idioma), [idioma]);
  const inicial = separarTelefone(valor, codigoSugerido);
  const [codigo, setCodigo] = useState(inicial.codigo);
  const [numero, setNumero] = useState(inicial.numero);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);
  const sugestaoRef = useRef(codigoSugerido);

  useEffect(() => {
    if (valor === montarTelefone(codigo, numero)) return;
    const separado = separarTelefone(valor, codigo);
    setCodigo(separado.codigo);
    setNumero(separado.numero);
  }, [valor, codigo, numero]);

  useEffect(() => {
    if (sugestaoRef.current === codigoSugerido) return;
    sugestaoRef.current = codigoSugerido;
    if (numero.trim()) return;
    setCodigo(codigoSugerido);
  }, [codigoSugerido, numero]);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (event: PointerEvent) => {
      if (!raizRef.current?.contains(event.target as Node)) setAberto(false);
    };
    window.addEventListener("pointerdown", fechar);
    return () => window.removeEventListener("pointerdown", fechar);
  }, [aberto]);

  const atual = paises.find((pais) => pais.codigo === codigo) ?? paises.find((pais) => pais.codigo === "BR");
  const termo = busca.trim().toLowerCase();
  const opcoes = paises.filter((pais) => {
    if (!termo) return true;
    return (
      pais.rotulo.toLowerCase().includes(termo) ||
      pais.ddi.includes(termo.replace("+", "")) ||
      `+${pais.ddi}`.includes(termo)
    );
  });

  const escolher = (proximoCodigo: string) => {
    setCodigo(proximoCodigo);
    setAberto(false);
    setBusca("");
    onChange(montarTelefone(proximoCodigo, numero));
    onCodigoChange?.(proximoCodigo);
  };

  const catalogo = variante === "catalogo";

  return (
    <div ref={raizRef} className="relative">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAberto((abertoAtual) => !abertoAtual)}
          className={cn(
            "shrink-0 font-semibold",
            catalogo
              ? "h-11 min-w-[4.75rem] rounded-xl border border-white/15 bg-white/[0.06] px-2.5 text-sm text-white"
              : "input-base w-auto min-w-[5.5rem] px-3 font-semibold",
          )}
          aria-expanded={aberto}
          aria-haspopup="listbox"
          aria-label={atual ? `+${atual.ddi}` : "Código do país"}
        >
          +{atual?.ddi ?? "55"}
        </button>
        <input
          id={id}
          value={numero}
          required={required}
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={placeholder}
          onChange={(event) => {
            const proximo = event.target.value;
            setNumero(proximo);
            onChange(montarTelefone(codigo, proximo));
          }}
          className={cn(catalogo
            ? "h-11 w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#d7b56d] focus:ring-2 focus:ring-[#d7b56d]/25"
            : "input-base")}
        />
      </div>
      {aberto ? (
        <div className={cn(
          "absolute left-0 right-0 z-20 mt-1 rounded-xl border py-1 shadow-[0_12px_32px_rgba(0,0,0,0.35)]",
          catalogo ? "border-white/10 bg-stone-950" : "border-line bg-surface",
        )}>
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="País ou +351"
            autoFocus
            className={cn(
              "mx-2 mb-1 w-[calc(100%-1rem)]",
              catalogo
                ? "h-9 rounded-lg border border-white/10 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/35"
                : "input-base",
            )}
          />
          <ul className="max-h-44 overflow-y-auto" role="listbox">
            {opcoes.length === 0 ? (
              <li className={cn("px-3 py-2 text-sm", catalogo ? "text-white/55" : "text-ink-soft")}>
                Nenhum país encontrado
              </li>
            ) : null}
            {opcoes.map((pais) => (
              <li key={pais.codigo}>
                <button
                  type="button"
                  role="option"
                  aria-selected={pais.codigo === codigo}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => escolher(pais.codigo)}
                  className={cn(
                    "flex min-h-9 w-full items-center justify-between gap-3 px-3 text-left text-sm",
                    catalogo ? "text-white hover:bg-white/10" : "text-ink hover:bg-surface-subtle",
                    pais.codigo === codigo && (catalogo ? "bg-white/10 text-[#d7b56d]" : "text-brand-700"),
                  )}
                >
                  <span className="truncate">{pais.rotulo}</span>
                  <span className={cn("tabular-nums", catalogo ? "text-white/60" : "text-ink-soft")}>+{pais.ddi}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
