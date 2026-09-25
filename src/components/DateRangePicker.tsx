import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePopoverAnchorRect } from "../hooks/usePopoverAnchorRect";
import { cn } from "../utils/cn";
import { IconCalendar, IconChevronLeft, IconChevronRight } from "./Icons";

export type DateRangeValue = {
  de: string | null;
  ate: string | null;
};

type DateRangePickerProps = {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  /** Placeholder do trigger quando vazio. */
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** ISO `YYYY-MM-DD` a partir de ano/mês (0-11)/dia. */
export function paraIsoData(ano: number, mes0: number, dia: number): string {
  return `${ano}-${pad2(mes0 + 1)}-${pad2(dia)}`;
}

export function formatarIsoCurto(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function hojeIso(): string {
  const d = new Date();
  return paraIsoData(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseIsoParts(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return { y, m, d };
}

function addMonths(ano: number, mes0: number, delta: number): { y: number; m: number } {
  const idx = ano * 12 + mes0 + delta;
  return { y: Math.floor(idx / 12), m: ((idx % 12) + 12) % 12 };
}

function diasNoMes(ano: number, mes0: number): number {
  return new Date(ano, mes0 + 1, 0).getDate();
}

/** 0 = segunda … 6 = domingo */
function primeiroDiaSemanaSegunda(ano: number, mes0: number): number {
  const js = new Date(ano, mes0, 1).getDay(); // 0=dom
  return (js + 6) % 7;
}

function compararIso(a: string, b: string): number {
  return a.localeCompare(b);
}

const MESES_CURTOS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

function limitesDoMes(ano: number, mes0: number): { de: string; ate: string } {
  return {
    de: paraIsoData(ano, mes0, 1),
    ate: paraIsoData(ano, mes0, diasNoMes(ano, mes0)),
  };
}

/** Intervalo que cobre exatamente um mês civil. */
function ehMesInteiro(
  de: string | null,
  ate: string | null,
): { y: number; m: number } | null {
  if (!de || !ate) return null;
  const inicio = parseIsoParts(de);
  const fim = parseIsoParts(ate);
  if (!inicio || !fim) return null;
  if (inicio.y !== fim.y || inicio.m !== fim.m) return null;
  if (inicio.d !== 1 || fim.d !== diasNoMes(inicio.y, inicio.m)) return null;
  return { y: inicio.y, m: inicio.m };
}

function mascararData(bruto: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bruto.trim());
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const digitos = bruto.replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

function inputParaIso(texto: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!match) return null;
  const dia = Number(match[1]);
  const mes = Number(match[2]);
  const ano = Number(match[3]);
  if (mes < 1 || mes > 12) return null;
  if (dia < 1 || dia > diasNoMes(ano, mes - 1)) return null;
  return paraIsoData(ano, mes - 1, dia);
}

function noIntervalo(dia: string, de: string | null, ate: string | null): boolean {
  if (!de || !ate) return false;
  return compararIso(dia, de) >= 0 && compararIso(dia, ate) <= 0;
}

function rotuloTrigger(value: DateRangeValue, placeholder: string): string {
  const mes = ehMesInteiro(value.de, value.ate);
  if (mes) return `${MESES[mes.m]} ${mes.y}`;
  if (value.de && value.ate) {
    if (value.de === value.ate) return formatarIsoCurto(value.de);
    return `${formatarIsoCurto(value.de)} – ${formatarIsoCurto(value.ate)}`;
  }
  if (value.de) return `${formatarIsoCurto(value.de)} – …`;
  return placeholder;
}

type Celula =
  | { tipo: "vazia"; key: string }
  | { tipo: "dia"; iso: string; dia: number };

function celulasDoMes(ano: number, mes0: number): Celula[] {
  const total = diasNoMes(ano, mes0);
  const offset = primeiroDiaSemanaSegunda(ano, mes0);
  const cells: Celula[] = [];

  for (let i = 0; i < offset; i++) {
    cells.push({ tipo: "vazia", key: `pad-ini-${ano}-${mes0}-${i}` });
  }

  for (let dia = 1; dia <= total; dia++) {
    cells.push({
      tipo: "dia",
      iso: paraIsoData(ano, mes0, dia),
      dia,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({
      tipo: "vazia",
      key: `pad-fim-${ano}-${mes0}-${cells.length}`,
    });
  }

  return cells;
}

function MesCalendario({
  ano,
  mes0,
  de,
  ate,
  hover,
  selecionandoFim,
  onPick,
  onHover,
}: {
  ano: number;
  mes0: number;
  de: string | null;
  ate: string | null;
  hover: string | null;
  selecionandoFim: boolean;
  onPick: (iso: string) => void;
  onHover: (iso: string | null) => void;
}) {
  const cells = useMemo(() => celulasDoMes(ano, mes0), [ano, mes0]);
  const hoje = hojeIso();

  const previewAte =
    selecionandoFim && de && hover && compararIso(hover, de) >= 0 ? hover : ate;

  return (
    <div className="w-[252px] shrink-0">
      <p className="mb-3 text-center text-sm font-semibold text-ink">
        {MESES[mes0]} {ano}
      </p>
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {DIAS_SEMANA.map((d) => (
          <div
            key={d}
            className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-faint"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5" onMouseLeave={() => onHover(null)}>
        {cells.map((c) => {
          if (c.tipo === "vazia") {
            return <div key={c.key} className="h-9" aria-hidden />;
          }

          const isStart = de === c.iso;
          const isEnd = Boolean(de) && (previewAte ?? ate) === c.iso;
          const inRange = noIntervalo(c.iso, de, previewAte);
          const isToday = c.iso === hoje;
          const extremo = isStart || isEnd;
          const rangeContinua =
            Boolean(de && previewAte && de !== previewAte) && inRange;

          return (
            <button
              key={c.iso}
              type="button"
              onClick={() => onPick(c.iso)}
              onMouseEnter={() => onHover(c.iso)}
              className={cn(
                "relative flex h-9 items-center justify-center text-sm transition",
                !extremo && "text-ink hover:bg-brand-50 hover:rounded-full",
                rangeContinua && !extremo && "bg-brand-50 text-brand-900",
                isStart && rangeContinua && "rounded-l-full bg-brand-50",
                isEnd && rangeContinua && "rounded-r-full bg-brand-50",
                extremo &&
                  "z-[1] rounded-full bg-brand-600 font-semibold text-white hover:bg-brand-700",
                !extremo && isToday && "ring-1 ring-inset ring-brand-300 rounded-full",
              )}
            >
              {c.dia}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Seletor de intervalo de datas (estilo passagem): no calendário você clica
 * a data inicial e depois a final.
 */
export function DateRangePicker({
  value,
  onChange,
  placeholder = "Período",
  className,
  disabled,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [modo, setModo] = useState<"intervalo" | "mes">("intervalo");
  const [draftDe, setDraftDe] = useState<string | null>(value.de);
  const [draftAte, setDraftAte] = useState<string | null>(value.ate);
  const [textoDe, setTextoDe] = useState(() => formatarIsoCurto(value.de));
  const [textoAte, setTextoAte] = useState(() => formatarIsoCurto(value.ate));
  const [hover, setHover] = useState<string | null>(null);
  const [mesBase, setMesBase] = useState(() => {
    const parts = parseIsoParts(value.de ?? hojeIso());
    return parts ? { y: parts.y, m: parts.m } : { y: new Date().getFullYear(), m: new Date().getMonth() };
  });

  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pos = usePopoverAnchorRect(anchorRef, open, 6);

  const selecionandoFim = Boolean(draftDe && !draftAte);

  useEffect(() => {
    if (!open) return;
    setDraftDe(value.de);
    setDraftAte(value.ate);
    setTextoDe(formatarIsoCurto(value.de));
    setTextoAte(formatarIsoCurto(value.ate));
    setModo(ehMesInteiro(value.de, value.ate) ? "mes" : "intervalo");
    const parts = parseIsoParts(value.de ?? hojeIso());
    if (parts) setMesBase({ y: parts.y, m: parts.m });
    setHover(null);
  }, [open, value.de, value.ate]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const mesSeguinte = addMonths(mesBase.y, mesBase.m, 1);

  const panelWidth = Math.min(
    modo === "mes" ? 360 : 560,
    typeof window !== "undefined" ? window.innerWidth - 16 : 560,
  );
  const panelLeft = Math.max(
    8,
    Math.min(pos.left, (typeof window !== "undefined" ? window.innerWidth : 800) - panelWidth - 8),
  );

  const definirInicio = (iso: string | null) => {
    setDraftDe(iso);
    setTextoDe(formatarIsoCurto(iso));
    if (iso) {
      const parts = parseIsoParts(iso);
      if (parts) setMesBase({ y: parts.y, m: parts.m });
    }
  };

  const definirFim = (iso: string | null) => {
    setDraftAte(iso);
    setTextoAte(formatarIsoCurto(iso));
  };

  const aoEditarInicio = (bruto: string) => {
    const texto = mascararData(bruto);
    setTextoDe(texto);
    const iso = inputParaIso(texto);
    if (iso) definirInicio(iso);
    else if (texto.trim() === "") definirInicio(null);
  };

  const aoEditarFim = (bruto: string) => {
    const texto = mascararData(bruto);
    setTextoAte(texto);
    const iso = inputParaIso(texto);
    if (iso) definirFim(iso);
    else if (texto.trim() === "") definirFim(null);
  };

  const pick = (iso: string) => {
    if (!draftDe || draftAte) {
      definirInicio(iso);
      definirFim(null);
      return;
    }
    if (compararIso(iso, draftDe) < 0) {
      definirInicio(iso);
      definirFim(null);
      return;
    }
    definirFim(iso);
    onChange({ de: draftDe, ate: iso });
    setOpen(false);
  };

  const aplicarIntervalo = () => {
    let de = textoDe.trim() ? inputParaIso(textoDe) : null;
    let ate = textoAte.trim() ? inputParaIso(textoAte) : null;
    if (textoDe.trim() && !de) return;
    if (textoAte.trim() && !ate) return;
    if (!de && !ate) return;
    if (de && !ate) ate = de;
    if (ate && !de) de = ate;
    if (!de || !ate) return;
    if (compararIso(de, ate) > 0) {
      const troca = de;
      de = ate;
      ate = troca;
    }
    onChange({ de, ate });
    setOpen(false);
  };

  const escolherMes = (mes0: number) => {
    onChange(limitesDoMes(mesBase.y, mes0));
    setOpen(false);
  };

  const limpar = () => {
    setDraftDe(null);
    setDraftAte(null);
    setTextoDe("");
    setTextoAte("");
    onChange({ de: null, ate: null });
    setOpen(false);
  };

  const inicioInvalido = textoDe.trim() !== "" && !inputParaIso(textoDe);
  const fimInvalido = textoAte.trim() !== "" && !inputParaIso(textoAte);
  const podeAplicar =
    !inicioInvalido && !fimInvalido && Boolean(textoDe.trim() || textoAte.trim());
  const mesAplicado = ehMesInteiro(value.de, value.ate);

  const temValor = Boolean(value.de || value.ate);

  return (
    <div className={cn("relative min-w-0", className)}>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "input-base flex w-full items-center gap-2 text-left",
          !temValor && "text-ink-faint",
          open && "border-brand-500 ring-2 ring-brand-500/20",
        )}
      >
        <IconCalendar width={16} height={16} className="shrink-0 text-ink-soft" />
        <span className="min-w-0 flex-1 truncate text-sm">
          {rotuloTrigger(value, placeholder)}
        </span>
        {temValor ? (
          <span
            role="button"
            tabIndex={-1}
            className="shrink-0 rounded px-1 text-xs font-medium text-ink-soft hover:bg-surface-subtle hover:text-ink"
            onClick={(e) => {
              e.stopPropagation();
              limpar();
            }}
            aria-label="Limpar período"
          >
            ×
          </span>
        ) : null}
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Selecionar período"
              style={{
                position: "fixed",
                top: pos.top,
                left: panelLeft,
                width: panelWidth,
                zIndex: 10000,
              }}
              className="max-h-[min(80vh,640px)] overflow-y-auto rounded-xl border border-line bg-surface p-4 shadow-lg"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div
                  className="inline-flex rounded-lg border border-line bg-surface-subtle p-0.5"
                  role="tablist"
                  aria-label="Tipo de período"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={modo === "intervalo"}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition",
                      modo === "intervalo"
                        ? "bg-surface text-ink shadow-sm"
                        : "text-ink-soft hover:text-ink",
                    )}
                    onClick={() => setModo("intervalo")}
                  >
                    Intervalo
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={modo === "mes"}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition",
                      modo === "mes"
                        ? "bg-surface text-ink shadow-sm"
                        : "text-ink-soft hover:text-ink",
                    )}
                    onClick={() => setModo("mes")}
                  >
                    Mês inteiro
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="btn-ghost h-8 w-8 p-0"
                    onClick={() =>
                      setMesBase((s) =>
                        modo === "mes" ? { y: s.y - 1, m: s.m } : addMonths(s.y, s.m, -1),
                      )
                    }
                    aria-label={modo === "mes" ? "Ano anterior" : "Mês anterior"}
                  >
                    <IconChevronLeft width={16} height={16} />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost h-8 w-8 p-0"
                    onClick={() =>
                      setMesBase((s) =>
                        modo === "mes" ? { y: s.y + 1, m: s.m } : addMonths(s.y, s.m, 1),
                      )
                    }
                    aria-label={modo === "mes" ? "Próximo ano" : "Próximo mês"}
                  >
                    <IconChevronRight width={16} height={16} />
                  </button>
                </div>
              </div>

              {modo === "intervalo" ? (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-3">
                    <label className="block min-w-0">
                      <span className="label-base">Início</span>
                      <input
                        value={textoDe}
                        onChange={(e) => aoEditarInicio(e.target.value)}
                        placeholder="dd/mm/aaaa"
                        inputMode="numeric"
                        autoComplete="off"
                        aria-invalid={inicioInvalido}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && podeAplicar) aplicarIntervalo();
                        }}
                        className={cn(
                          "input-base font-numeric tabular-nums",
                          inicioInvalido && "border-red-400 focus:border-red-500 focus:ring-red-500/20",
                        )}
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="label-base">Término</span>
                      <input
                        value={textoAte}
                        onChange={(e) => aoEditarFim(e.target.value)}
                        placeholder="dd/mm/aaaa"
                        inputMode="numeric"
                        autoComplete="off"
                        aria-invalid={fimInvalido}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && podeAplicar) aplicarIntervalo();
                        }}
                        className={cn(
                          "input-base font-numeric tabular-nums",
                          fimInvalido && "border-red-400 focus:border-red-500 focus:ring-red-500/20",
                        )}
                      />
                    </label>
                  </div>

                  <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-center sm:gap-8">
                    <MesCalendario
                      ano={mesBase.y}
                      mes0={mesBase.m}
                      de={draftDe}
                      ate={draftAte}
                      hover={hover}
                      selecionandoFim={selecionandoFim}
                      onPick={pick}
                      onHover={setHover}
                    />
                    <div className="hidden sm:block">
                      <MesCalendario
                        ano={mesSeguinte.y}
                        mes0={mesSeguinte.m}
                        de={draftDe}
                        ate={draftAte}
                        hover={hover}
                        selecionandoFim={selecionandoFim}
                        onPick={pick}
                        onHover={setHover}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <p className="mb-3 text-center text-sm font-semibold text-ink">{mesBase.y}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {MESES_CURTOS.map((nome, mes0) => {
                      const ativo =
                        mesAplicado?.y === mesBase.y && mesAplicado.m === mes0;
                      return (
                        <button
                          key={nome}
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => escolherMes(mes0)}
                          className={cn(
                            "rounded-lg border px-2 py-2.5 text-sm font-medium transition",
                            ativo
                              ? "border-brand-600 bg-brand-600 text-white"
                              : "border-line bg-surface text-ink hover:border-brand-500 hover:bg-brand-50",
                          )}
                        >
                          {nome}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
                <button
                  type="button"
                  className="text-sm font-medium text-ink-soft hover:text-brand-700 disabled:opacity-40"
                  disabled={!draftDe && !value.de}
                  onClick={limpar}
                >
                  Limpar
                </button>
                {modo === "intervalo" ? (
                  <button
                    type="button"
                    className="btn-primary px-3 py-2"
                    disabled={!podeAplicar}
                    onClick={aplicarIntervalo}
                  >
                    Aplicar
                  </button>
                ) : (
                  <p className="text-xs text-ink-soft">Escolha o mês</p>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
