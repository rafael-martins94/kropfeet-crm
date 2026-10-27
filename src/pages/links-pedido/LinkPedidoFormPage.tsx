import { useEffect, useMemo, useRef, useState } from "react";
import { useAsync } from "../../hooks/useAsync";
import { useNavigate } from "react-router-dom";
import { FormInput, FormTextarea } from "../../components/FormField";
import { FotoThumbnailHover } from "../../components/FotoThumbnailHover";
import { IconCheck, IconCopy, IconEye, IconLink } from "../../components/Icons";
import { Modal } from "../../components/Modal";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { SeletorTenisLink, type TenisDoLink } from "../../components/links-pedido/SeletorTenisLink";
import { useToast } from "../../contexts/ToastContext";
import { linksPedidoService, type DestinoLink } from "../../services/links-pedido";
import { formatarMoeda } from "../../utils/format";
import { mensagemErro } from "../../utils/errors";
import { calcularValoresCompra, mensagemCotacaoIndisponivel } from "../../services/cambio-compra";
import { destinoPorMoeda, itemTemPrecoNaMoeda, mensagemDoLink, MENSAGEM_LINK_PADRAO, normalizarMoeda, prazoDaMensagemLink, urlDoLink, type ValidadeHorasLink } from "../../utils/linkPedido";
import { cn } from "../../utils/cn";

const ETAPAS_BASE = [
  { id: "dados", label: "Dados" },
  { id: "tenis", label: "Tênis" },
  { id: "preco", label: "Preço" },
  { id: "revisao", label: "Revisão" },
  { id: "pronto", label: "Pronto" },
] as const;

type EtapaLink = (typeof ETAPAS_BASE)[number]["id"];

function etapasVisiveis(mostrarPreco: boolean) {
  return ETAPAS_BASE.filter((item) => mostrarPreco || item.id !== "preco");
}

function EtapasLink({
  etapa,
  etapas,
  onVoltar,
}: {
  etapa: EtapaLink;
  etapas: Array<(typeof ETAPAS_BASE)[number]>;
  onVoltar: (etapa: EtapaLink) => void;
}) {
  const atual = etapas.findIndex((item) => item.id === etapa);
  return (
    <ol className="flex flex-wrap items-center justify-end gap-1.5" aria-label="Etapas do link">
      {etapas.map((item, indice) => {
        const concluida = indice < atual;
        const corrente = indice === atual;
        const podeVoltar = concluida && etapa !== "pronto";
        return (
          <li key={item.id}>
            <button
              type="button"
              disabled={!podeVoltar}
              aria-current={corrente ? "step" : undefined}
              onClick={() => onVoltar(item.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                corrente && "bg-brand-600 text-white",
                concluida && "bg-emerald-50 text-emerald-800",
                !corrente && !concluida && "bg-surface-muted text-ink-muted",
                podeVoltar && "hover:bg-emerald-100",
                !podeVoltar && "cursor-default",
              )}
            >
              {indice + 1}. {item.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function mascaraMoeda(texto: string): string {
  const digitos = texto.replace(/\D/g, "").slice(0, 9);
  if (!digitos) return "";
  return (Number(digitos) / 100).toFixed(2);
}

function textoCampoMoeda(valor: string): string {
  const numero = precoValido(valor);
  if (numero == null) return "";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numero);
}

function precoValido(valor: string): number | null {
  const numero = Number(valor.replace(",", "."));
  if (!Number.isFinite(numero) || numero <= 0 || numero > 999999.99) return null;
  return Math.round(numero * 100) / 100;
}

export default function LinkPedidoFormPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [etapa, setEtapa] = useState<EtapaLink>("dados");
  const [instagram, setInstagram] = useState("");
  const [nome, setNome] = useState("");
  const [destino, setDestino] = useState<DestinoLink>("brasil");
  const [validadeHoras, setValidadeHoras] = useState<ValidadeHorasLink>(24);
  const [boasVindas, setBoasVindas] = useState("Separei estes pares para você. Escolha os que quiser e finalize por aqui.");
  const [mensagem, setMensagem] = useState(MENSAGEM_LINK_PADRAO);
  const [selecionados, setSelecionados] = useState<TenisDoLink[]>([]);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criado, setCriado] = useState<{ id: string; token: string } | null>(null);
  const [copiado, setCopiado] = useState<"link" | "mensagem" | null>(null);
  const [verSelecionados, setVerSelecionados] = useState(false);
  const copiarTimer = useRef<number | null>(null);

  const moeda = destinoPorMoeda(destino);
  const precos = useMemo(
    () => selecionados.map((item) => ({ item, valor: precoValido(item.preco) })),
    [selecionados],
  );
  const precisaPreco = selecionados.some((item) => !itemTemPrecoNaMoeda(item, moeda.moeda));
  const bloqueado = precos.some((linha) => !itemTemPrecoNaMoeda(linha.item, moeda.moeda) && linha.valor == null);
  const etapas = etapasVisiveis(precisaPreco || etapa === "preco");
  const [historico, setHistorico] = useState<Record<string, number>>({});
  const cotacao = useAsync(async () => {
    if (etapa !== "preco") return null;
    const hoje = new Date().toISOString().slice(0, 10);
    const euro = await calcularValoresCompra("EUR", 1, hoje).catch(() => null);
    const eurParaBrl = euro?.valorReal && euro.valorReal > 0 ? euro.valorReal : null;
    const brlParaEur = eurParaBrl ? Math.round((1 / eurParaBrl) * 1_000_000) / 1_000_000 : null;
    return { eurParaBrl, brlParaEur, data: hoje };
  }, [etapa]);

  const modelosSelecionados = selecionados.map((item) => item.idModelo).join("|");

  useEffect(() => {
    if (etapa !== "preco" || modelosSelecionados === "") return;
    let ativo = true;
    linksPedidoService
      .ultimosPrecos(moeda.moeda, modelosSelecionados.split("|"))
      .then((mapa) => {
        if (ativo) setHistorico(mapa);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [etapa, moeda.moeda, modelosSelecionados]);

  useEffect(() => {
    if (etapa === "preco" && selecionados.length === 0) setEtapa("tenis");
  }, [etapa, selecionados.length]);
  const total = precos.reduce((soma, linha) => soma + (linha.valor ?? 0), 0);

  const gerar = async () => {
    setErro(null);
    if (bloqueado || selecionados.length === 0) {
      setErro("Todo tênis precisa de um preço maior que zero na moeda do destino.");
      return;
    }
    setGerando(true);
    try {
      const resultado = await linksPedidoService.criar({
        instagram,
        nome,
        destino,
        validadeHoras,
        mensagem: boasVindas,
        mensagemCompartilhar: mensagem,
        itens: precos.map((linha) => ({
          id: linha.item.id,
          preco: linha.valor ?? (itemTemPrecoNaMoeda(linha.item, moeda.moeda) ? Number(linha.item.precoOriginal) : 0),
        })),
      });
      setCriado({ id: resultado.id, token: resultado.token });
      setEtapa("pronto");
      toast.sucesso("Link gerado.");
    } catch (falha) {
      setErro(mensagemErro(falha));
    } finally {
      setGerando(false);
    }
  };

  const enderecoLink = criado ? urlDoLink(criado.token) : "";
  const instagramVisivel = `@${instagram.replace(/^@+/, "")}`;
  const texto = criado
    ? mensagemDoLink(mensagem, {
        nome,
        instagram,
        validade: prazoDaMensagemLink(validadeHoras),
        url: enderecoLink,
      })
    : "";

  const copiar = async (tipo: "link" | "mensagem", valor: string) => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(tipo);
      toast.sucesso(tipo === "link" ? "Link copiado." : "Mensagem copiada.");
      if (copiarTimer.current != null) window.clearTimeout(copiarTimer.current);
      copiarTimer.current = window.setTimeout(() => setCopiado((atual) => (atual === tipo ? null : atual)), 2000);
    } catch {
      toast.erro("Não foi possível copiar. Selecione o texto e use Ctrl+C.");
    }
  };

  const criarOutro = () => {
    if (copiarTimer.current != null) window.clearTimeout(copiarTimer.current);
    setCriado(null);
    setCopiado(null);
    setSelecionados([]);
    setInstagram("");
    setNome("");
    setErro(null);
    setEtapa("dados");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <PageHeader
        title={etapa === "pronto" ? "Link pronto" : "Criar novo link"}
        titleAccessory={
          <StatusBadge
            value={destino}
            label={destino === "europa" ? "EUROPA" : "BRASIL"}
          />
        }
        backTo="/links-pedido"
        breadcrumbs={[{ label: "Comercial", to: "/links-pedido" }, { label: "Novo link" }]}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <EtapasLink etapa={etapa} etapas={etapas} onVoltar={setEtapa} />
            {etapa === "tenis" ? (
              <SecondaryButton type="button" disabled={selecionados.length === 0} onClick={() => setVerSelecionados(true)} className="whitespace-nowrap">
                Ver selecionados
                <span
                  className={cn(
                    "ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
                    selecionados.length > 0 ? "bg-brand-700 text-white" : "bg-surface-subtle text-ink-muted",
                  )}
                >
                  {selecionados.length}
                </span>
              </SecondaryButton>
            ) : null}
          </div>
        }
      />

      <Modal
        open={verSelecionados}
        onClose={() => setVerSelecionados(false)}
        title="Selecionados"
        description={
          selecionados.length === 0
            ? "Nenhum tênis nesta seleção."
            : `${selecionados.length} ${selecionados.length === 1 ? "par" : "pares"} neste link.`
        }
        size="xl"
        footer={<SecondaryButton type="button" onClick={() => setVerSelecionados(false)}>Fechar</SecondaryButton>}
      >
        {selecionados.length === 0 ? (
          <p className="text-sm text-ink-soft">Escolha os pares na lista para vê-los aqui.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {selecionados.map((item) => {
              const preco = precoValido(item.preco);
              return (
                <li key={item.id} className="flex gap-4 rounded-xl border border-line bg-surface p-4">
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-subtle">
                    {item.foto ? (
                      <img src={item.foto} alt="" className="h-full w-full object-contain" />
                    ) : null}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-ink">{item.nome}</p>
                      <button
                        type="button"
                        className="shrink-0 text-xs font-semibold text-ink-muted hover:text-red-700"
                        onClick={() => {
                          const restantes = selecionados.filter((escolhido) => escolhido.id !== item.id);
                          setSelecionados(restantes);
                          if (restantes.length === 0) setVerSelecionados(false);
                        }}
                      >
                        Remover
                      </button>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-soft">{item.sku}</p>
                    <p className="truncate text-xs text-ink-soft">{item.numeracao || "Sem numeração"}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <StatusBadge
                        value={item.origem === "Europa" ? "europa" : item.origem === "Brasil" ? "brasil" : "outros"}
                        label={item.origem}
                      />
                      <span className="font-numeric text-sm font-semibold text-ink">
                        {preco != null ? formatarMoeda(preco, moeda.moeda) : "Sem preço"}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      {etapa === "dados" ? (
        <SectionCard title="Para quem é o link">
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput label="Instagram" required value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@cliente" />
            <FormInput label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Opcional" />
            <div className="space-y-1">
              <span className="label-base">Destino</span>
              <div className="flex gap-2">
                {(["brasil", "europa"] as const).map((opcao) => (
                  <button
                    key={opcao}
                    type="button"
                    onClick={() => {
                      setDestino(opcao);
                      const moedaNova = destinoPorMoeda(opcao).moeda;
                      setSelecionados((atual) =>
                        atual.map((item) => ({
                          ...item,
                          preco: itemTemPrecoNaMoeda(item, moedaNova) ? String(item.precoOriginal) : "",
                        })),
                      );
                    }}
                    className={cn(
                      "min-h-10 flex-1 rounded-lg border px-3 text-sm font-semibold",
                      destino === opcao ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-ink",
                    )}
                  >
                    {opcao === "brasil" ? "Brasil · BRL · SumUp Brasil" : "Europa · EUR · SumUp Portugal"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <span className="label-base">Validade</span>
              <div className="flex gap-2">
                {([24, 48, 72] as const).map((horas) => (
                  <button
                    key={horas}
                    type="button"
                    onClick={() => setValidadeHoras(horas)}
                    className={cn(
                      "min-h-10 flex-1 rounded-lg border px-3 text-sm font-semibold",
                      validadeHoras === horas ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-ink",
                    )}
                  >
                    {horas} h
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-soft">O prazo começa quando a pessoa abrir o link. Sem abertura, expira em 7 dias.</p>
            </div>
            <FormTextarea
              label="Mensagem de boas-vindas"
              value={boasVindas}
              onChange={(e) => setBoasVindas(e.target.value)}
              wrapperClassName="md:col-span-2"
              rows={3}
            />
          </div>
          <div className="mt-5 flex justify-end">
            <PrimaryButton
              type="button"
              onClick={() => {
                if (!instagram.trim()) {
                  setErro("Informe o @ do Instagram.");
                  return;
                }
                setErro(null);
                setEtapa("tenis");
              }}
            >
              Escolher tênis
            </PrimaryButton>
          </div>
          {erro ? <p className="mt-3 text-sm text-red-700">{erro}</p> : null}
        </SectionCard>
      ) : null}

      {etapa === "tenis" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <SeletorTenisLink
            moedaDestino={moeda.moeda}
            selecionados={selecionados}
            onChange={setSelecionados}
            acaoVoltar={
              <SecondaryButton type="button" onClick={() => setEtapa("dados")}>
                Voltar
              </SecondaryButton>
            }
            acaoAvancar={
              <PrimaryButton
                type="button"
                disabled={selecionados.length === 0}
                onClick={() => {
                  setErro(null);
                  setEtapa(precisaPreco ? "preco" : "revisao");
                }}
              >
                {precisaPreco ? "Definir preços" : "Revisar"}
              </PrimaryButton>
            }
          />
          {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
        </div>
      ) : null}

      {etapa === "preco" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
        <SectionCard
          title="Preço na moeda do destino"
          className="flex min-h-0 flex-1 flex-col"
          bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
          actions={
            <p className="text-right text-sm text-ink-soft">
              {cotacao.data?.eurParaBrl != null
                ? `Cotação de hoje: 1 EUR = ${formatarMoeda(cotacao.data.eurParaBrl, "BRL")}.`
                : cotacao.loading
                  ? "Buscando a cotação de hoje…"
                  : mensagemCotacaoIndisponivel(new Date().toISOString().slice(0, 10))}
              {" "}O preço original do estoque não muda.
            </p>
          }
        >
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-line">
            <div className="hidden min-w-[760px] grid-cols-[minmax(14rem,1.4fr)_11rem_11rem_16rem] gap-4 border-b border-line bg-surface-muted px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft lg:grid">
              <span>Tênis</span>
              <span>Valor</span>
              <span>Cotação</span>
              <span>Câmbio</span>
            </div>
            <ul className="divide-y divide-line">
            {precos.filter(({ item }) => !itemTemPrecoNaMoeda(item, moeda.moeda)).map(({ item }) => {
              const sugestao = historico[item.idModelo];
              const origem = normalizarMoeda(item.moedaOriginal);
              const taxa =
                origem === "EUR" && moeda.moeda === "BRL"
                  ? cotacao.data?.eurParaBrl
                  : origem === "BRL" && moeda.moeda === "EUR"
                    ? cotacao.data?.brlParaEur
                    : null;
              const convertido =
                taxa != null && Number(item.precoOriginal) > 0
                  ? Math.round(Number(item.precoOriginal) * taxa * 100) / 100
                  : null;
              const definirPreco = (valor: string) =>
                setSelecionados((atual) =>
                  atual.map((escolhido) => (escolhido.id === item.id ? { ...escolhido, preco: valor } : escolhido)),
                );
              return (
                <li key={item.id} className="grid gap-4 p-4 lg:min-w-[760px] lg:grid-cols-[minmax(14rem,1.4fr)_11rem_11rem_16rem] lg:items-center">
                  <div className="flex min-w-0 gap-3">
                    <FotoThumbnailHover url={item.foto} alt={item.nome} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{item.nome}</p>
                      <p className="truncate text-xs text-ink-soft">{item.sku} · {item.numeracao || "Sem numeração"} · {item.origem}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft lg:hidden">Valor</span>
                    <p className="font-numeric text-2xl font-semibold text-ink">
                      {item.precoOriginal != null
                        ? formatarMoeda(item.precoOriginal, item.moedaOriginal ?? moeda.moeda)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft lg:hidden">Cotação</span>
                    <p className="font-numeric text-xl font-semibold text-ink">
                      {cotacao.data?.eurParaBrl != null ? formatarMoeda(cotacao.data.eurParaBrl, "BRL") : "—"}
                    </p>
                    <p className="text-xs text-ink-soft">1 EUR</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft lg:hidden">Câmbio</span>
                    <span className="mt-1 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 focus-within:border-brand-500">
                      <span className="font-numeric text-lg font-semibold text-ink-soft">{moeda.moeda === "EUR" ? "€" : "R$"}</span>
                      <input
                        value={textoCampoMoeda(item.preco)}
                        inputMode="numeric"
                        placeholder="0,00"
                        aria-label={`Câmbio em ${moeda.moeda}`}
                        onChange={(evento) => definirPreco(mascaraMoeda(evento.target.value))}
                        className="w-full bg-transparent font-numeric text-2xl font-semibold text-ink outline-none"
                      />
                    </span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {convertido != null ? (
                        <button type="button" className="text-xs font-semibold text-brand-700 hover:underline" onClick={() => definirPreco(convertido.toFixed(2))}>
                          Aplicar {formatarMoeda(convertido, moeda.moeda)}
                        </button>
                      ) : null}
                      {sugestao != null ? (
                        <button type="button" className="text-xs font-semibold text-ink-soft hover:underline" onClick={() => definirPreco(sugestao.toFixed(2))}>
                          Reaplicar {formatarMoeda(sugestao, moeda.moeda)}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
            </ul>
          </div>
        </SectionCard>
          {erro ? <p className="shrink-0 text-sm text-red-700">{erro}</p> : null}
          <div className="flex shrink-0 justify-between gap-3">
            <SecondaryButton type="button" onClick={() => setEtapa("tenis")}>Voltar</SecondaryButton>
            <PrimaryButton
              type="button"
              disabled={bloqueado}
              onClick={() => {
                if (bloqueado) {
                  setErro("Informe o preço na moeda do destino.");
                  return;
                }
                setErro(null);
                setEtapa("revisao");
              }}
            >
              Revisar
            </PrimaryButton>
          </div>
        </div>
      ) : null}

      {etapa === "revisao" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
        <SectionCard
          noPadding
          className="flex min-h-0 flex-1 flex-col"
          bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Pessoa</p>
              <p className="mt-1 truncate text-sm font-semibold text-ink">@{instagram.replace(/^@+/, "")}</p>
              <p className="truncate text-xs text-ink-soft">{nome || "Sem nome"}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Destino</p>
              <div className="mt-2">
                <StatusBadge value={destino} label={destino === "europa" ? "EUROPA" : "BRASIL"} />
              </div>
              <p className="mt-1 text-xs text-ink-soft">SumUp · {moeda.moeda}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Validade</p>
              <p className="mt-1 text-sm font-semibold text-ink">{validadeHoras} horas</p>
              <p className="text-xs text-ink-soft">depois da abertura</p>
            </div>
            <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Total</p>
              <p className="mt-1 font-numeric text-2xl font-semibold text-brand-800">{formatarMoeda(total, moeda.moeda)}</p>
              <p className="text-xs text-brand-700">{selecionados.length} {selecionados.length === 1 ? "par" : "pares"}</p>
            </div>
          </div>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {precos.map(({ item, valor }) => (
              <li key={item.id} className="flex gap-4 rounded-xl border border-line bg-surface p-4">
                <span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-subtle">
                  {item.foto ? <img src={item.foto} alt="" className="h-full w-full object-contain" /> : null}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate text-base font-semibold text-ink">{item.nome}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-soft">{item.sku}</p>
                  <p className="truncate text-xs text-ink-soft">{item.numeracao || "Sem numeração"}</p>
                  <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                    <StatusBadge
                      value={item.origem === "Europa" ? "europa" : item.origem === "Brasil" ? "brasil" : "outros"}
                      label={item.origem}
                    />
                    <span className="font-numeric text-xl font-semibold text-ink">
                      {valor == null ? "Sem preço" : formatarMoeda(valor, moeda.moeda)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <FormTextarea
            label="Mensagem para copiar"
            hint="O trecho {url} vira o endereço do link."
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            wrapperClassName="mt-4"
            rows={12}
          />
          </div>
        </SectionCard>
          {bloqueado ? <p className="shrink-0 text-sm text-red-700">Há item sem preço ou com valor inválido.</p> : null}
          {erro ? <p className="shrink-0 text-sm text-red-700">{erro}</p> : null}
          <div className="flex shrink-0 justify-between gap-3">
            <SecondaryButton type="button" onClick={() => setEtapa(precisaPreco ? "preco" : "tenis")}>Voltar</SecondaryButton>
            <PrimaryButton type="button" loading={gerando} disabled={bloqueado} onClick={() => void gerar()}>
              Gerar link
            </PrimaryButton>
          </div>
        </div>
      ) : null}

      {etapa === "pronto" && criado ? (
        <SectionCard
          title="Mensagem para copiar"
          description={`${instagramVisivel} · ${selecionados.length} ${selecionados.length === 1 ? "par" : "pares"} · ${formatarMoeda(total, moeda.moeda)} · ${validadeHoras} h após a abertura. O preço do estoque não mudou.`}
          actions={
            <PrimaryButton
              type="button"
              icon={copiado === "mensagem" ? <IconCheck width={16} height={16} /> : <IconCopy width={16} height={16} />}
              onClick={() => void copiar("mensagem", texto)}
            >
              {copiado === "mensagem" ? "Mensagem copiada" : "Copiar mensagem"}
            </PrimaryButton>
          }
        >
          <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-surface-subtle px-4 py-3 text-sm leading-relaxed text-ink">
            {texto}
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 truncate font-mono text-sm text-ink" title={enderecoLink}>
              {enderecoLink}
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <SecondaryButton
                type="button"
                icon={copiado === "link" ? <IconCheck width={16} height={16} /> : <IconLink width={16} height={16} />}
                onClick={() => void copiar("link", enderecoLink)}
              >
                {copiado === "link" ? "Link copiado" : "Copiar link"}
              </SecondaryButton>
              <SecondaryButton type="button" icon={<IconEye width={16} height={16} />} onClick={() => navigate(`/links-pedido/${criado.id}`)}>
                Abrir detalhes
              </SecondaryButton>
              <SecondaryButton type="button" onClick={criarOutro}>
                Criar outro
              </SecondaryButton>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
