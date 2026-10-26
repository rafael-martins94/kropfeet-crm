import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { InlineLoader } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import {
  IconBox,
  IconCheck,
  IconChevronRight,
  IconEye,
  IconEyeOff,
  IconLink,
  IconPlus,
} from "../components/Icons";
import { useAuth } from "../contexts/AuthContext";
import {
  STATUS_ANDAMENTO,
  dashboardService,
  type DashboardResumo,
  type PeriodoDashboard,
  type ResumoEstoqueRegiao,
  type StatusAndamento,
} from "../services/dashboard";
import { linksPedidoService } from "../services/links-pedido";
import type { TipoRegiao } from "../types/entities";
import { useAsync } from "../hooks/useAsync";
import { cn } from "../utils/cn";
import { formatarData, formatarDataHora, formatarMoeda, formatarNumero } from "../utils/format";

const PERIODOS: { valor: PeriodoDashboard; rotulo: string; anterior: string }[] = [
  { valor: "mes", rotulo: "Este mês", anterior: "mesmo período do mês passado" },
  { valor: "30d", rotulo: "30 dias", anterior: "30 dias anteriores" },
  { valor: "ano", rotulo: "Este ano", anterior: "mesmo período do ano passado" },
];

const ROTULO_REGIAO: Record<TipoRegiao | "sem_local", string> = {
  brasil: "Brasil",
  europa: "Europa",
  outros: "Outros",
  sem_local: "Sem local",
};

const SIGLA_REGIAO: Record<TipoRegiao, string> = { brasil: "BR", europa: "EU", outros: "OU" };

const MOEDA_PADRAO: Record<TipoRegiao, string> = { brasil: "BRL", europa: "EUR", outros: "BRL" };

const ROTULO_ANDAMENTO: Record<StatusAndamento, string> = {
  em_aberto: "Em aberto",
  pago: "Pago",
  preparando_envio: "Preparando envio",
  enviado: "Enviado",
};

const REGIOES_VENDA: TipoRegiao[] = ["brasil", "europa"];

function moedaCurta(valor: number, moeda: string): string {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: moeda,
      maximumFractionDigits: 0,
    }).format(valor);
  } catch {
    return formatarMoeda(valor, moeda);
  }
}

const CHAVE_VALORES_VISIVEIS = "kropfeet.dashboard.valoresVisiveis";
const MASCARA = "••••";

type FormatarDinheiro = (valor: number, moeda: string, completo?: boolean) => string;

function criarFormatador(visivel: boolean): FormatarDinheiro {
  return (valor, moeda, completo = false) => {
    if (!visivel) return MASCARA;
    return completo ? formatarMoeda(valor, moeda) : moedaCurta(valor, moeda);
  };
}

const ValoresVisiveisContext = createContext(false);

function useDinheiro(): FormatarDinheiro {
  return criarFormatador(useContext(ValoresVisiveisContext));
}

function variacao(atual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

function saudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

export default function DashboardPage() {
  const { perfil } = useAuth();
  const [periodo, setPeriodo] = useState<PeriodoDashboard>("mes");
  const resumo = useAsync(() => dashboardService.carregarResumo(periodo), [periodo]);
  const ultimasVendas = useAsync(() => dashboardService.ultimasVendas(6), []);
  const avisos = useAsync(() => linksPedidoService.avisosRecentes(), []);
  const [valoresVisiveis, setValoresVisiveis] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(CHAVE_VALORES_VISIVEIS) === "1",
  );
  useEffect(() => {
    window.localStorage.setItem(CHAVE_VALORES_VISIVEIS, valoresVisiveis ? "1" : "0");
  }, [valoresVisiveis]);
  const dinheiro = criarFormatador(valoresVisiveis);

  const primeiroNome = perfil?.nome?.trim().split(/\s+/)[0];
  const infoPeriodo = PERIODOS.find((p) => p.valor === periodo) ?? PERIODOS[0];
  const dados = resumo.data;
  const carregando = resumo.loading && !dados;

  return (
    <ValoresVisiveisContext.Provider value={valoresVisiveis}>
    <div className="min-h-0 flex-1 overflow-y-auto">
      <header className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
        <div className="min-w-0">
          <p className="text-xs capitalize text-ink-soft">
            {formatarData(new Date().toISOString(), { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="truncate font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            {saudacao()}
            {primeiroNome ? `, ${primeiroNome}` : ""}
          </h1>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <Link to="/itens-estoque" className="btn-secondary !px-3 !py-2" aria-label="Ver estoque">
            <IconBox />
            <span className="hidden sm:inline">Estoque</span>
          </Link>
          <Link to="/vendas/novo" className="btn-primary !px-3 !py-2">
            <IconPlus />
            <span className="hidden sm:inline">Nova venda</span>
            <span className="sm:hidden">Venda</span>
          </Link>
        </div>
      </header>

      {(avisos.data?.length ?? 0) > 0 ? (
        <SectionCard title="Novos avisos de link" className="mb-4" noPadding>
          <ul className="divide-y divide-line">
            {avisos.data?.map((aviso) => (
              <li key={aviso.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{aviso.titulo}</p>
                  {aviso.corpo ? <p className="text-sm text-ink-soft">{aviso.corpo}</p> : null}
                  <p className="mt-0.5 text-xs text-ink-muted">{formatarDataHora(aviso.criado_em)}</p>
                </div>
                <div className="flex flex-shrink-0 gap-4">
                  {aviso.id_venda ? (
                    <Link to={`/vendas/${aviso.id_venda}`} className="text-sm font-semibold text-brand-700 hover:underline">
                      Ver ordem
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="text-sm font-semibold text-ink-muted hover:text-ink"
                    onClick={() => void linksPedidoService.marcarAvisoLido(aviso.id).then(() => avisos.reload())}
                  >
                    Marcar como lido
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-ink">Resumo</h2>
          <button
            type="button"
            onClick={() => setValoresVisiveis((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-subtle hover:text-ink"
            aria-label={valoresVisiveis ? "Ocultar valores" : "Mostrar valores"}
            aria-pressed={valoresVisiveis}
            title={valoresVisiveis ? "Ocultar valores" : "Mostrar valores"}
          >
            {valoresVisiveis ? <IconEye /> : <IconEyeOff />}
          </button>
        </div>
        <div role="tablist" aria-label="Período" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              type="button"
              role="tab"
              aria-selected={periodo === p.valor}
              onClick={() => setPeriodo(p.valor)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition sm:px-3",
                periodo === p.valor ? "bg-brand-600 text-white shadow-sm" : "text-ink-muted hover:text-ink",
              )}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
      </div>

      {resumo.error ? (
        <div className="card mb-4 p-4 text-sm text-red-700">Erro ao carregar o resumo: {resumo.error.message}</div>
      ) : null}

      <div className={cn("mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4", resumo.loading && dados && "opacity-60")}>
        {REGIOES_VENDA.map((regiao) => {
          const r = dados?.vendas.find((v) => v.regiao === regiao);
          const moeda = r?.moeda ?? MOEDA_PADRAO[regiao];
          const faturamento = r?.faturamento ?? 0;
          const qtd = r?.vendas ?? 0;
          return (
            <KpiCard
              key={regiao}
              to={`/vendas/${regiao}`}
              label={`Vendas ${ROTULO_REGIAO[regiao]}`}
              loading={carregando}
              delta={variacao(faturamento, r?.faturamentoAnterior ?? 0)}
              deltaTitulo={`Comparado ao ${infoPeriodo.anterior}`}
              hint={
                qtd > 0
                  ? `${formatarNumero(qtd)} ${qtd === 1 ? "venda" : "vendas"} · ticket ${dinheiro(faturamento / qtd, moeda)}`
                  : "Nenhuma venda"
              }
            >
              {dinheiro(faturamento, moeda)}
            </KpiCard>
          );
        })}
        <KpiCard label="Recebido" loading={carregando} to="/financeiro/contas-receber/brasil" hint="Baixas no período">
          <ValoresPorRegiao
            linhas={REGIOES_VENDA.map((regiao) => {
              const f = dados?.financeiro.find((x) => x.regiao === regiao);
              return { regiao, valor: f?.recebido ?? 0, moeda: f?.moeda ?? MOEDA_PADRAO[regiao] };
            })}
          />
        </KpiCard>
        <KpiCard
          label="A receber"
          loading={carregando}
          to="/financeiro/contas-receber/brasil"
          hint={<VencidoHint financeiro={dados?.financeiro ?? []} />}
        >
          <ValoresPorRegiao
            linhas={REGIOES_VENDA.map((regiao) => {
              const f = dados?.financeiro.find((x) => x.regiao === regiao);
              return { regiao, valor: f?.emAberto ?? 0, moeda: f?.moeda ?? MOEDA_PADRAO[regiao] };
            })}
          />
        </KpiCard>
      </div>

      <PainelLinks
        links={dados?.links}
        carregando={carregando}
        rotuloAnterior={infoPeriodo.anterior}
      />

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PainelAtencao dados={dados} carregando={carregando} />
        <PainelAndamento andamento={dados?.andamento} carregando={carregando} />
        <PainelEstoque estoque={dados?.estoque} carregando={carregando} />
      </div>

      <SectionCard title="Últimas vendas" className="mb-4" actions={<VerTodos to="/vendas" />} noPadding>
          {ultimasVendas.loading ? (
            <div className="p-4">
              <InlineLoader />
            </div>
          ) : (ultimasVendas.data ?? []).length === 0 ? (
            <EmptyState title="Sem vendas" description="Nenhuma venda registrada." />
          ) : (
            <ul className="divide-y divide-line">
              {(ultimasVendas.data ?? []).map((v) => (
                <li key={v.id}>
                  <Link
                    to={`/vendas/${v.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-brand-50/40 sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{v.nome_cliente || "Sem cliente"}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-soft">
                        <span className="font-semibold text-ink-muted">{SIGLA_REGIAO[v.regiao_venda]}</span>
                        {v.numero ? <span>#{v.numero}</span> : null}
                        <span>· {formatarData(v.data_pedido)}</span>
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1">
                      <span className="font-numeric text-sm font-medium tabular-nums text-ink">
                        {dinheiro(v.valor_total, v.moeda_venda, true)}
                      </span>
                      <StatusBadge value={v.status_venda} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </SectionCard>

      <HistoricoVendas historico={dados?.historico} carregando={carregando} />
    </div>
    </ValoresVisiveisContext.Provider>
  );
}

function KpiCard({
  label,
  children,
  hint,
  delta,
  deltaTitulo,
  to,
  loading,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  delta?: number | null;
  deltaTitulo?: string;
  to?: string;
  loading?: boolean;
}) {
  const corpo = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">{label}</span>
        {delta !== undefined && delta !== null && !loading ? (
          <span
            title={deltaTitulo}
            className={cn(
              "flex-shrink-0 rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums",
              delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
            )}
          >
            {delta >= 0 ? "+" : "−"}
            {formatarNumero(Math.abs(delta))}%
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 font-numeric text-lg font-medium leading-tight tabular-nums tracking-tight text-brand-800 sm:text-2xl">
        {loading ? <span className="skeleton inline-block h-6 w-24 rounded" /> : children}
      </div>
      {hint && !loading ? <div className="mt-1 text-[0.7rem] leading-snug text-ink-soft sm:text-xs">{hint}</div> : null}
    </>
  );
  const classe = "card block min-w-0 p-3 sm:p-4";
  return to ? (
    <Link to={to} className={cn(classe, "card-hover")}>
      {corpo}
    </Link>
  ) : (
    <div className={classe}>{corpo}</div>
  );
}

function ValoresPorRegiao({ linhas }: { linhas: { regiao: TipoRegiao; valor: number; moeda: string }[] }) {
  const dinheiro = useDinheiro();
  return (
    <div className="space-y-0.5">
      {linhas.map((l) => (
        <div key={l.regiao} className="flex items-baseline gap-1.5 text-base sm:text-lg">
          <span className="w-5 text-[0.65rem] font-semibold text-ink-soft">{SIGLA_REGIAO[l.regiao]}</span>
          <span className="truncate">{dinheiro(l.valor, l.moeda)}</span>
        </div>
      ))}
    </div>
  );
}

function VencidoHint({ financeiro }: { financeiro: DashboardResumo["financeiro"] }) {
  const dinheiro = useDinheiro();
  const vencidos = financeiro.filter((f) => f.vencido > 0);
  if (vencidos.length === 0) return <>Nada vencido</>;
  return (
    <span className="font-medium text-red-700">
      Vencido: {vencidos.map((f) => dinheiro(f.vencido, f.moeda)).join(" · ")}
    </span>
  );
}

function VerTodos({ to }: { to: string }) {
  return (
    <Link to={to} className="text-xs font-medium text-brand-600 hover:text-brand-700">
      Ver todos →
    </Link>
  );
}

function PainelLinks({
  links,
  carregando,
  rotuloAnterior,
}: {
  links: DashboardResumo["links"] | undefined;
  carregando: boolean;
  rotuloAnterior: string;
}) {
  const dinheiro = useDinheiro();
  const faturamento = Object.entries(links?.faturamentoPorMoeda ?? {});
  const conversao = links && links.linksCriados > 0 ? (links.linksComVenda / links.linksCriados) * 100 : null;
  const delta = links ? variacao(links.vendas, links.vendasAnterior) : null;

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-1.5">
          <IconLink width={15} height={15} className="text-brand-600" />
          Vendas por link
        </span>
      }
      titleAccessory={
        links && !carregando ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.7rem] font-medium text-emerald-700">
            {formatarNumero(links.linksAtivos)} {links.linksAtivos === 1 ? "link ativo" : "links ativos"} agora
          </span>
        ) : null
      }
      actions={<VerTodos to="/links-pedido" />}
      className="mb-4"
      noPadding
    >
      {carregando || !links ? (
        <div className="p-4">
          <InlineLoader />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
          <MiniMetrica
            rotulo="Vendas confirmadas"
            valor={formatarNumero(links.vendas)}
            delta={delta}
            deltaTitulo={`Comparado ao ${rotuloAnterior}`}
            dica={links.vendasAnterior > 0 ? `${formatarNumero(links.vendasAnterior)} no período anterior` : undefined}
          />
          <MiniMetrica
            rotulo="Faturado via link"
            valor={
              faturamento.length === 0
                ? dinheiro(0, "BRL")
                : faturamento.map(([moeda, valor]) => dinheiro(valor, moeda)).join(" · ")
            }
          />
          <MiniMetrica
            rotulo="Links criados"
            valor={formatarNumero(links.linksCriados)}
            dica={`${formatarNumero(links.acessos)} ${links.acessos === 1 ? "acesso" : "acessos"}`}
          />
          <MiniMetrica
            rotulo="Conversão"
            valor={conversao === null ? "—" : `${formatarNumero(conversao)}%`}
            dica={
              links.linksCriados > 0
                ? `${formatarNumero(links.linksComVenda)} de ${formatarNumero(links.linksCriados)} links com venda`
                : "Nenhum link no período"
            }
          />
        </div>
      )}
    </SectionCard>
  );
}

function MiniMetrica({
  rotulo,
  valor,
  dica,
  delta,
  deltaTitulo,
}: {
  rotulo: string;
  valor: string;
  dica?: string;
  delta?: number | null;
  deltaTitulo?: string;
}) {
  return (
    <div className="min-w-0 bg-surface px-4 py-3 sm:px-5">
      <div className="flex items-center gap-1.5">
        <span className="truncate text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">{rotulo}</span>
        {delta !== undefined && delta !== null ? (
          <span
            title={deltaTitulo}
            className={cn(
              "flex-shrink-0 rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums",
              delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
            )}
          >
            {delta >= 0 ? "+" : "−"}
            {formatarNumero(Math.abs(delta))}%
          </span>
        ) : null}
      </div>
      <div className="mt-1 truncate font-numeric text-lg font-medium tabular-nums text-brand-800">{valor}</div>
      {dica ? <div className="mt-0.5 truncate text-[0.7rem] text-ink-soft sm:text-xs">{dica}</div> : null}
    </div>
  );
}

type ItemAtencao = { chave: string; rotulo: string; quantidade: number; detalhe?: string; to: string; grave?: boolean };

function PainelAtencao({ dados, carregando }: { dados: DashboardResumo | null; carregando: boolean }) {
  const dinheiro = useDinheiro();
  const itens: ItemAtencao[] = [];
  if (dados) {
    for (const f of dados.financeiro) {
      if (f.quantidadeVencida > 0 && (f.regiao === "brasil" || f.regiao === "europa")) {
        itens.push({
          chave: `vencidas-${f.regiao}`,
          rotulo: `Contas vencidas · ${ROTULO_REGIAO[f.regiao]}`,
          quantidade: f.quantidadeVencida,
          detalhe: dinheiro(f.vencido, f.moeda),
          to: `/financeiro/contas-receber/${f.regiao}`,
          grave: true,
        });
      }
    }
    const p = dados.pendencias;
    const candidatos: ItemAtencao[] = [
      { chave: "divergentes", rotulo: "Contas divergentes", quantidade: p.contasDivergentes, to: "/financeiro/contas-receber/brasil", grave: true },
      { chave: "vitrine", rotulo: "Alertas na vitrine", quantidade: p.alertasVitrine, to: "/vitrines/atual", grave: true },
      { chave: "frete", rotulo: "Frete pendente", quantidade: p.fretePendente, to: "/vendas" },
      { chave: "carrinhos", rotulo: "Carrinhos abertos na galeria", quantidade: p.carrinhosAbertos, to: "/carrinhos-galeria" },
      { chave: "conferencias", rotulo: "Conferências abertas", quantidade: p.conferenciasAbertas, to: "/conferencia-estoque" },
      { chave: "reservados", rotulo: "Itens reservados", quantidade: p.itensReservados, to: "/itens-estoque?status=reservado" },
      { chave: "transferencia", rotulo: "Itens em transferência", quantidade: p.itensTransferencia, to: "/itens-estoque?status=transferencia" },
      { chave: "compra", rotulo: "Itens em processo de compra", quantidade: p.itensEmCompra, to: "/itens-estoque?status=em_processo_de_compra" },
    ];
    itens.push(...candidatos.filter((c) => c.quantidade > 0));
  }

  return (
    <SectionCard title="Precisa de atenção" noPadding>
      {carregando ? (
        <div className="p-4">
          <InlineLoader />
        </div>
      ) : itens.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-5 text-sm text-ink-soft sm:px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <IconCheck width={16} height={16} />
          </span>
          Tudo em dia por aqui.
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {itens.map((item) => (
            <li key={item.chave}>
              <Link
                to={item.to}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-brand-50/40 sm:px-5"
              >
                <span
                  className={cn(
                    "flex h-7 min-w-[1.75rem] flex-shrink-0 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums",
                    item.grave ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800",
                  )}
                >
                  {formatarNumero(item.quantidade)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{item.rotulo}</span>
                {item.detalhe ? (
                  <span className="flex-shrink-0 text-xs font-medium tabular-nums text-ink-muted">{item.detalhe}</span>
                ) : null}
                <IconChevronRight width={14} height={14} className="flex-shrink-0 text-ink-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function PainelAndamento({
  andamento,
  carregando,
}: {
  andamento: DashboardResumo["andamento"] | undefined;
  carregando: boolean;
}) {
  return (
    <SectionCard title="Pedidos em andamento" actions={<VerTodos to="/vendas" />} noPadding>
      {carregando || !andamento ? (
        <div className="p-4">
          <InlineLoader />
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
              <th className="px-4 py-2 text-left font-semibold sm:px-5">Status</th>
              {REGIOES_VENDA.map((r) => (
                <th key={r} className="w-16 px-2 py-2 text-right font-semibold">
                  {SIGLA_REGIAO[r]}
                </th>
              ))}
              <th className="w-4 pr-4 sm:pr-5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {STATUS_ANDAMENTO.map((status) => (
              <tr key={status}>
                <td className="px-4 py-2.5 sm:px-5">
                  <StatusBadge value={status} label={ROTULO_ANDAMENTO[status]} />
                </td>
                {REGIOES_VENDA.map((regiao) => {
                  const qtd = andamento[status][regiao] ?? 0;
                  return (
                    <td key={regiao} className="px-2 py-2.5 text-right tabular-nums">
                      {qtd > 0 ? (
                        <Link
                          to={`/vendas/${regiao}?status=${status}`}
                          className="inline-block min-w-[2rem] rounded-md px-1.5 py-0.5 font-semibold text-brand-700 hover:bg-brand-50"
                        >
                          {formatarNumero(qtd)}
                        </Link>
                      ) : (
                        <span className="px-1.5 text-ink-faint">0</span>
                      )}
                    </td>
                  );
                })}
                <td className="pr-4 sm:pr-5" />
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}

function PainelEstoque({ estoque, carregando }: { estoque: ResumoEstoqueRegiao[] | undefined; carregando: boolean }) {
  const dinheiro = useDinheiro();
  const total = (estoque ?? []).reduce((acc, r) => acc + r.pares, 0);
  const filtroRegiao: Partial<Record<ResumoEstoqueRegiao["regiao"], string>> = { brasil: "br", europa: "eu" };
  return (
    <SectionCard
      title="Estoque disponível"
      titleAccessory={
        !carregando ? (
          <span className="text-xs text-ink-soft">{formatarNumero(total)} pares</span>
        ) : null
      }
      actions={<VerTodos to="/itens-estoque?status=em_estoque" />}
      noPadding
    >
      {carregando || !estoque ? (
        <div className="p-4">
          <InlineLoader />
        </div>
      ) : estoque.length === 0 ? (
        <EmptyState title="Sem estoque" description="Nenhum par em estoque." />
      ) : (
        <ul className="divide-y divide-line">
          {estoque.map((r) => {
            const filtro = filtroRegiao[r.regiao];
            const valores = Object.entries(r.valorPorMoeda);
            return (
              <li key={r.regiao}>
                <Link
                  to={`/itens-estoque?status=em_estoque${filtro ? `&regiao=${filtro}` : ""}`}
                  className="block px-4 py-3 transition-colors hover:bg-brand-50/40 sm:px-5"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-ink">{ROTULO_REGIAO[r.regiao]}</span>
                    <span className="font-numeric text-base font-medium tabular-nums text-brand-800">
                      {formatarNumero(r.pares)} <span className="text-xs text-ink-soft">pares</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-subtle">
                    <div className="h-full rounded-full bg-accent-400" style={{ width: `${total ? (r.pares / total) * 100 : 0}%` }} />
                  </div>
                  {valores.length > 0 ? (
                    <p className="mt-1 text-xs text-ink-soft">
                      Valor de venda: {valores.map(([moeda, valor]) => dinheiro(valor, moeda)).join(" · ")}
                    </p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

function HistoricoVendas({
  historico,
  carregando,
}: {
  historico: DashboardResumo["historico"] | undefined;
  carregando: boolean;
}) {
  const totais = (historico ?? []).map((m) => REGIOES_VENDA.reduce((acc, r) => acc + (m.porRegiao[r] ?? 0), 0));
  const max = Math.max(1, ...totais);
  return (
    <SectionCard
      title="Vendas nos últimos 6 meses"
      titleAccessory={
        <span className="flex items-center gap-3 text-xs text-ink-soft">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-brand-600" /> Brasil
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-accent-400" /> Europa
          </span>
        </span>
      }
    >
      {carregando || !historico ? (
        <InlineLoader />
      ) : (
        <div className="flex h-36 items-end gap-2 sm:gap-4">
          {historico.map((m, i) => {
            const [ano, mes] = m.mes.split("-").map(Number);
            const rotulo = new Intl.DateTimeFormat("pt-BR", { month: "short" })
              .format(new Date(ano, mes - 1, 1))
              .replace(".", "");
            return (
              <div key={m.mes} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <span className="text-xs font-semibold tabular-nums text-ink-muted">{totais[i] || ""}</span>
                <div
                  className="flex w-full max-w-[3rem] flex-col-reverse overflow-hidden rounded-t-md bg-surface-subtle"
                  style={{ height: `${(totais[i] / max) * 100}%`, minHeight: 2 }}
                  title={REGIOES_VENDA.map((r) => `${ROTULO_REGIAO[r]}: ${m.porRegiao[r] ?? 0}`).join(" · ")}
                >
                  {REGIOES_VENDA.map((r) => (
                    <div
                      key={r}
                      className={r === "brasil" ? "bg-brand-600" : "bg-accent-400"}
                      style={{ height: `${totais[i] ? ((m.porRegiao[r] ?? 0) / totais[i]) * 100 : 0}%` }}
                    />
                  ))}
                </div>
                <span className="text-[0.7rem] capitalize text-ink-soft">{rotulo}</span>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
