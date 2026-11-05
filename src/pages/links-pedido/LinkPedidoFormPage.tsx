import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAsync } from "../../hooks/useAsync";
import { useNavigate } from "react-router-dom";
import { FormInput, FormTextarea } from "../../components/FormField";
import { FotoThumbnailHover } from "../../components/FotoThumbnailHover";
import { GaleriaImagensLightbox } from "../../components/imagens/GaleriaImagensLightbox";
import { IconActivity, IconCheck, IconCopy, IconEye, IconLink } from "../../components/Icons";
import { Modal } from "../../components/Modal";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { SeletorTenisLink, type TenisDoLink } from "../../components/links-pedido/SeletorTenisLink";
import { useToast } from "../../contexts/ToastContext";
import { linksPedidoService, type CompraDoTenis, type DestinoLink } from "../../services/links-pedido";
import { modelosProdutoService } from "../../services/modelos-produto";
import type { ImagemDetalhada } from "../../services/imagens";
import { formatarData, formatarMoeda, formatarNumero } from "../../utils/format";
import { mensagemErro } from "../../utils/errors";
import { calcularValoresCompra, mensagemCotacaoIndisponivel } from "../../services/cambio-compra";
import { BOAS_VINDAS_LINK_PADRAO, destinoPorMoeda, itemTemPrecoNaMoeda, mensagemDoLink, MENSAGEM_LINK_PADRAO, normalizarMoeda, prazoDaMensagemLink, urlDoLink, type ValidadeHorasLink } from "../../utils/linkPedido";
import { cn } from "../../utils/cn";

/** Igual ao limite das funções `link_pedido_criar` e `link_pedido_preparar_pagamento`. */
const LIMITE_TENIS_LINK = 50;

const ETAPAS_BASE = [
  { id: "dados", label: "Dados" },
  { id: "tenis", label: "Tênis" },
  { id: "preco", label: "Preço" },
  { id: "revisao", label: "Revisão" },
  { id: "pronto", label: "Pronto" },
] as const;

type EtapaLink = (typeof ETAPAS_BASE)[number]["id"];

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
    <ol className="hidden flex-wrap items-center justify-end gap-1.5 lg:flex" aria-label="Etapas do link">
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

/** No celular: "Etapa 2 de 5 · Tênis" com barra de progresso no lugar dos chips. */
function EtapasLinkCompacto({
  etapa,
  etapas,
}: {
  etapa: EtapaLink;
  etapas: Array<(typeof ETAPAS_BASE)[number]>;
}) {
  const atual = etapas.findIndex((item) => item.id === etapa);
  return (
    <div className="lg:hidden">
      <p className="text-xs font-semibold text-ink-muted">
        Etapa {atual + 1} de {etapas.length} · <span className="text-ink">{etapas[atual]?.label}</span>
      </p>
      <div className="mt-1.5 flex gap-1" aria-hidden>
        {etapas.map((item, indice) => (
          <span
            key={item.id}
            className={cn("h-1 flex-1 rounded-full", indice <= atual ? "bg-brand-600" : "bg-line")}
          />
        ))}
      </div>
    </div>
  );
}

/** Ações da etapa. No celular ficam presas no rodapé para não sumirem na rolagem. */
function BarraAcoesEtapa({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 flex shrink-0 items-center justify-between gap-2 rounded-xl border border-line bg-surface/95 p-2.5 shadow-lg backdrop-blur",
        "lg:static lg:z-auto lg:gap-3 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none",
        className,
      )}
    >
      {children}
    </div>
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

/** Cotação usada na conversão do custo, sempre lida como "1 EUR = R$ x" quando envolve real e euro. */
function textoCotacaoCompra(compra: CompraDoTenis): string | null {
  if (!compra.cotacao || !compra.moedaOriginal) return null;
  if (compra.moedaOriginal === "BRL" && compra.moeda === "EUR") {
    return `1 EUR = ${formatarMoeda(1 / compra.cotacao.valor, "BRL")}`;
  }
  return `1 ${compra.moedaOriginal} = ${formatarMoeda(compra.cotacao.valor, compra.moeda)}`;
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
  const [boasVindas, setBoasVindas] = useState(BOAS_VINDAS_LINK_PADRAO);
  const [mensagem, setMensagem] = useState(MENSAGEM_LINK_PADRAO);
  const [selecionados, setSelecionados] = useState<TenisDoLink[]>([]);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criado, setCriado] = useState<{ id: string; token: string } | null>(null);
  const [copiado, setCopiado] = useState<"link" | "mensagem" | null>(null);
  const [verSelecionados, setVerSelecionados] = useState(false);
  const [historicoDe, setHistoricoDe] = useState<TenisDoLink | null>(null);
  const historicoPrecos = useAsync(
    async () => (historicoDe ? linksPedidoService.historicoPrecosModelo(historicoDe.idModelo) : []),
    [historicoDe?.idModelo],
  );
  const [galeria, setGaleria] = useState<{ imagens: ImagemDetalhada[]; indice: number } | null>(null);
  const [abrindoGaleria, setAbrindoGaleria] = useState<string | null>(null);
  const copiarTimer = useRef<number | null>(null);

  const moeda = destinoPorMoeda(destino);
  const precos = useMemo(
    () => selecionados.map((item) => ({ item, valor: precoValido(item.preco) })),
    [selecionados],
  );
  const bloqueado = precos.some((linha) => linha.valor == null);
  const etapas = [...ETAPAS_BASE];
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
  const idsSelecionados = selecionados.map((item) => item.id).join("|");
  const compras = useAsync(
    async () =>
      etapa === "preco" && idsSelecionados !== ""
        ? linksPedidoService.comprasDosTenis(moeda.moeda, idsSelecionados.split("|"))
        : ({} as Record<string, CompraDoTenis>),
    [etapa, moeda.moeda, idsSelecionados],
  );

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
    if ((etapa === "preco" || etapa === "revisao") && selecionados.length === 0) setEtapa("tenis");
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
          preco: linha.valor ?? 0,
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

  const abrirFotos = async (item: TenisDoLink) => {
    setAbrindoGaleria(item.id);
    try {
      const fotos = await modelosProdutoService.obterImagens(item.idModelo);
      const modelo = { id: item.idModelo, nome_modelo: item.nome, slug: "", categoria: null };
      const imagens: ImagemDetalhada[] =
        fotos.length > 0
          ? fotos.map((foto) => ({ ...foto, modelo }) as ImagemDetalhada)
          : item.foto
            ? [
                {
                  id: item.id,
                  id_modelo_produto: item.idModelo,
                  url_origem: item.foto,
                  caminho_arquivo: null,
                  ordem_exibicao: 0,
                  imagem_principal: true,
                  tipo_origem: "url",
                  criado_em: "",
                  modelo,
                },
              ]
            : [];
      if (imagens.length === 0) {
        toast.erro("Este modelo não tem fotos.");
        return;
      }
      setGaleria({ imagens, indice: 0 });
    } catch (falha) {
      toast.erro(mensagemErro(falha));
    } finally {
      setAbrindoGaleria(null);
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
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto max-lg:[&>*]:shrink-0 max-lg:[&>*]:basis-auto">
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
              <SecondaryButton type="button" disabled={selecionados.length === 0} onClick={() => setVerSelecionados(true)} className="hidden whitespace-nowrap lg:inline-flex">
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

      <EtapasLinkCompacto etapa={etapa} etapas={etapas} />

      {galeria ? (
        <GaleriaImagensLightbox
          imagens={galeria.imagens}
          indice={galeria.indice}
          onClose={() => setGaleria(null)}
          onIndiceChange={(indice) => setGaleria((atual) => (atual ? { ...atual, indice } : atual))}
          semLinkModelo
        />
      ) : null}

      <Modal
        open={historicoDe != null}
        onClose={() => setHistoricoDe(null)}
        title="Histórico de preços em links"
        description={historicoDe ? `${historicoDe.nome} · todas as numerações deste modelo.` : undefined}
        size="lg"
        footer={<SecondaryButton type="button" onClick={() => setHistoricoDe(null)}>Fechar</SecondaryButton>}
      >
        {historicoPrecos.loading ? (
          <p className="text-sm text-ink-soft">Buscando o histórico…</p>
        ) : historicoPrecos.error ? (
          <p className="text-sm text-red-700">Erro ao buscar o histórico: {historicoPrecos.error.message}</p>
        ) : (historicoPrecos.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-ink-soft">Este modelo ainda não entrou em nenhum link.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {historicoPrecos.data?.map((linha) => {
              const mesmoPar = linha.idItemEstoque === historicoDe?.id;
              const mesmaMoeda = linha.moeda === moeda.moeda;
              return (
                <li key={`${linha.idLink}-${linha.idItemEstoque}`} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <a
                        href={`/links-pedido/${linha.idLink}`}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate hover:underline"
                      >
                        {linha.instagram}
                      </a>
                      {mesmoPar ? (
                        <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                          Este par
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-ink-soft">
                      {formatarData(linha.criadoEm)} · {linha.numeracao || "Sem numeração"} · {linha.sku}
                    </p>
                  </div>
                  <span className="shrink-0 font-numeric text-base font-semibold text-ink">
                    {formatarMoeda(linha.preco, linha.moeda)}
                  </span>
                  {mesmaMoeda && historicoDe ? (
                    <button
                      type="button"
                      className="shrink-0 text-xs font-semibold text-brand-700 hover:underline"
                      onClick={() => {
                        setSelecionados((atual) =>
                          atual.map((escolhido) =>
                            escolhido.id === historicoDe.id ? { ...escolhido, preco: linha.preco.toFixed(2) } : escolhido,
                          ),
                        );
                        setHistoricoDe(null);
                      }}
                    >
                      Usar
                    </button>
                  ) : (
                    <span className="w-8 shrink-0" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

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
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
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
            <FormInput
              label="Instagram"
              required
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@cliente"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
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
                      "flex min-h-12 flex-1 flex-col items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-semibold leading-tight",
                      destino === opcao ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-ink",
                    )}
                  >
                    <span>{opcao === "brasil" ? "Brasil · BRL" : "Europa · EUR"}</span>
                    <span
                      className={cn(
                        "text-[11px] font-medium",
                        destino === opcao ? "text-white/80" : "text-ink-soft",
                      )}
                    >
                      {opcao === "brasil" ? "SumUp Brasil" : "SumUp Portugal"}
                    </span>
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
              rows={12}
            />
          </div>
          {erro ? <p className="mt-3 text-sm text-red-700">{erro}</p> : null}
        </SectionCard>
      ) : null}

      {etapa === "dados" ? (
        <BarraAcoesEtapa className="justify-end">
          <PrimaryButton
            type="button"
            className="flex-1 lg:flex-none"
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
        </BarraAcoesEtapa>
      ) : null}

      {etapa === "tenis" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <SeletorTenisLink
            moedaDestino={moeda.moeda}
            selecionados={selecionados}
            limite={LIMITE_TENIS_LINK}
            onLimiteAtingido={() => toast.erro(`O link aceita até ${LIMITE_TENIS_LINK} tênis.`)}
            onChange={setSelecionados}
            acaoVoltar={
              <SecondaryButton type="button" className="hidden lg:inline-flex" onClick={() => setEtapa("dados")}>
                Voltar
              </SecondaryButton>
            }
            acaoAvancar={
              <PrimaryButton
                type="button"
                className="hidden lg:inline-flex"
                disabled={selecionados.length === 0}
                onClick={() => {
                  setErro(null);
                  setEtapa("preco");
                }}
              >
                Definir preços
              </PrimaryButton>
            }
          />
          {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
        </div>
      ) : null}

      {etapa === "tenis" ? (
        <BarraAcoesEtapa className="lg:hidden">
          <SecondaryButton type="button" className="px-3" onClick={() => setEtapa("dados")}>
            Voltar
          </SecondaryButton>
          <SecondaryButton
            type="button"
            className="px-3"
            disabled={selecionados.length === 0}
            onClick={() => setVerSelecionados(true)}
          >
            Pares
            <span
              className={cn(
                "ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
                selecionados.length > 0 ? "bg-brand-700 text-white" : "bg-surface-subtle text-ink-muted",
              )}
            >
              {selecionados.length}
            </span>
          </SecondaryButton>
          <PrimaryButton
            type="button"
            className="flex-1 px-3"
            disabled={selecionados.length === 0}
            onClick={() => {
              setErro(null);
              setEtapa("preco");
            }}
          >
            Definir preços
          </PrimaryButton>
        </BarraAcoesEtapa>
      ) : null}

      {etapa === "preco" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
        <SectionCard
          title="Preço na moeda do destino"
          className="flex min-h-0 flex-1 flex-col"
          bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
          actions={
            <p className="text-sm text-ink-soft sm:text-right">
              {cotacao.data?.eurParaBrl != null
                ? `Cotação de hoje: 1 EUR = ${formatarMoeda(cotacao.data.eurParaBrl, "BRL")}.`
                : cotacao.loading
                  ? "Buscando a cotação de hoje…"
                  : mensagemCotacaoIndisponivel(new Date().toISOString().slice(0, 10))}
              {" "}Pares na moeda {moeda.moeda === "EUR" ? "euro" : "real"} atualizam o preço do estoque; os convertidos não.
            </p>
          }
        >
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-line">
            <div className="hidden min-w-[840px] grid-cols-[minmax(13rem,1.4fr)_10rem_8rem_12rem_6rem_2.5rem] gap-3 border-b border-line bg-surface-muted px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft lg:grid">
              <span>Tênis</span>
              <span>Valor de compra</span>
              <span>Valor de venda</span>
              <span>Preço no link</span>
              <span>Lucro</span>
              <span className="sr-only">Histórico</span>
            </div>
            <ul className="divide-y divide-line">
            {precos.map(({ item }) => {
              const sugestao = historico[item.idModelo];
              const compra = compras.data?.[item.id];
              const cotacaoCompra = compra ? textoCotacaoCompra(compra) : null;
              const precoLink = precoValido(item.preco);
              // Lucro sobre o custo de compra, os dois na moeda do link.
              const lucro = precoLink != null && compra?.valor != null ? precoLink - compra.valor : null;
              const lucroPercentual = lucro != null && compra?.valor ? (lucro / compra.valor) * 100 : null;
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
                <li key={item.id} className="grid gap-3 px-4 py-3 lg:min-w-[840px] lg:grid-cols-[minmax(13rem,1.4fr)_10rem_8rem_12rem_6rem_2.5rem] lg:items-center">
                  <div className="flex min-w-0 gap-3">
                    <FotoThumbnailHover url={item.foto} alt={item.nome} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{item.nome}</p>
                      <p className="truncate text-xs text-ink-soft">{item.sku} · {item.numeracao || "Sem numeração"} · {item.origem}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft lg:hidden">Valor de compra</span>
                    <p className="font-numeric text-base font-semibold text-ink">
                      {compras.loading ? "…" : formatarMoeda(compra?.valor, moeda.moeda)}
                    </p>
                    {compra?.valorOriginal != null && compra.valor == null ? (
                      <p className="text-xs text-amber-800">
                        Sem cotação para converter {formatarMoeda(compra.valorOriginal, compra.moedaOriginal ?? undefined)}.
                      </p>
                    ) : null}
                    {compra?.dataCompra ? (
                      <p className="text-xs text-ink-soft">Compra em {formatarData(compra.dataCompra)}</p>
                    ) : null}
                    {cotacaoCompra ? (
                      <p className="text-xs text-ink-soft">
                        {formatarMoeda(compra?.valorOriginal, compra?.moedaOriginal ?? undefined)} · {cotacaoCompra}
                      </p>
                    ) : null}
                    {!compras.loading && compra && compra.valorOriginal == null ? (
                      <p className="text-xs text-ink-soft">Sem ordem de compra</p>
                    ) : null}
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft lg:hidden">Valor de venda</span>
                    <p className="font-numeric text-base font-semibold text-ink">
                      {item.precoOriginal != null
                        ? formatarMoeda(item.precoOriginal, item.moedaOriginal ?? moeda.moeda)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft lg:hidden">Preço no link</span>
                    <span className="mt-1 flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 focus-within:border-brand-500">
                      <span className="font-numeric text-sm font-semibold text-ink-soft">{moeda.moeda === "EUR" ? "€" : "R$"}</span>
                      <input
                        value={textoCampoMoeda(item.preco)}
                        inputMode="numeric"
                        placeholder="0,00"
                        aria-label={`Preço no link em ${moeda.moeda}`}
                        onChange={(evento) => definirPreco(mascaraMoeda(evento.target.value))}
                        className="w-full bg-transparent font-numeric text-base font-semibold text-ink outline-none"
                      />
                    </span>
                    {origem === moeda.moeda && precoValido(item.preco) != null && precoValido(item.preco) !== Number(item.precoOriginal) ? (
                      <p className="mt-1 text-xs font-medium text-amber-800">
                        O preço do estoque passa a ser {formatarMoeda(precoValido(item.preco), moeda.moeda)}.
                      </p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                      {convertido != null ? (
                        <button type="button" className="text-xs font-semibold text-brand-700 hover:underline" onClick={() => definirPreco(convertido.toFixed(2))}>
                          Aplicar {formatarMoeda(convertido, moeda.moeda)}
                        </button>
                      ) : null}
                      {sugestao != null && sugestao !== precoValido(item.preco) ? (
                        <button type="button" className="text-xs font-semibold text-ink-soft hover:underline" onClick={() => definirPreco(sugestao.toFixed(2))}>
                          Reaplicar {formatarMoeda(sugestao, moeda.moeda)}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft lg:hidden">Lucro</span>
                    {lucroPercentual != null ? (
                      <>
                        <p className={cn("font-numeric text-base font-semibold", lucro! < 0 ? "text-red-700" : "text-emerald-700")}>
                          {formatarNumero(lucroPercentual, 1)}%
                        </p>
                        <p className="text-xs text-ink-soft">{formatarMoeda(lucro, moeda.moeda)}</p>
                      </>
                    ) : (
                      <p className="font-numeric text-base font-semibold text-ink-soft">—</p>
                    )}
                  </div>
                  <div>
                    <button
                      type="button"
                      title="Histórico de preços em links"
                      aria-label="Histórico de preços em links"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-soft hover:border-brand-300 hover:text-brand-700"
                      onClick={() => setHistoricoDe(item)}
                    >
                      <IconActivity className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
            </ul>
          </div>
        </SectionCard>
          {erro ? <p className="shrink-0 text-sm text-red-700">{erro}</p> : null}
          <BarraAcoesEtapa>
            <SecondaryButton type="button" onClick={() => setEtapa("tenis")}>Voltar</SecondaryButton>
            <PrimaryButton
              type="button"
              className="flex-1 lg:flex-none"
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
          </BarraAcoesEtapa>
        </div>
      ) : null}

      {etapa === "revisao" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
        <SectionCard
          noPadding
          className="flex min-h-0 flex-1 flex-col"
          bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
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
            <div className="col-span-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 xl:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Total</p>
              <p className="mt-1 font-numeric text-2xl font-semibold text-brand-800">{formatarMoeda(total, moeda.moeda)}</p>
              <p className="text-xs text-brand-700">{selecionados.length} {selecionados.length === 1 ? "par" : "pares"}</p>
            </div>
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:mt-5 sm:grid-cols-2 sm:gap-4">
            {precos.map(({ item, valor }) => (
              <li key={item.id} className="flex gap-3 rounded-xl border border-line bg-surface p-3 sm:gap-4 sm:p-4">
                <button
                  type="button"
                  onClick={() => void abrirFotos(item)}
                  disabled={abrindoGaleria === item.id}
                  aria-label={`Ver fotos de ${item.nome}`}
                  title="Ver fotos ampliadas"
                  className="group relative flex h-20 w-20 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-subtle transition hover:border-brand-400 sm:h-24 sm:w-24"
                >
                  {item.foto ? <img src={item.foto} alt="" className="h-full w-full object-contain" /> : null}
                  <span className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white transition group-hover:bg-black/75">
                    {abrindoGaleria === item.id ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <circle cx="11" cy="11" r="6" />
                        <path d="M20 20l-4.5-4.5M11 8.5v5M8.5 11h5" strokeLinecap="round" />
                      </svg>
                    )}
                  </span>
                </button>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-base font-semibold text-ink">{item.nome}</p>
                    <button
                      type="button"
                      className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold text-ink-muted transition hover:bg-red-50 hover:text-red-700"
                      aria-label={`Remover ${item.nome} ${item.numeracao}`}
                      onClick={() => setSelecionados((atual) => atual.filter((escolhido) => escolhido.id !== item.id))}
                    >
                      Remover
                    </button>
                  </div>
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
            rows={4}
          />
          </div>
        </SectionCard>
          {bloqueado ? <p className="shrink-0 text-sm text-red-700">Há item sem preço ou com valor inválido.</p> : null}
          {erro ? <p className="shrink-0 text-sm text-red-700">{erro}</p> : null}
          <BarraAcoesEtapa>
            <div className="flex min-w-0 items-center gap-2 lg:gap-3">
              <SecondaryButton type="button" onClick={() => setEtapa("preco")}>Voltar</SecondaryButton>
              <SecondaryButton
                type="button"
                className="whitespace-nowrap"
                disabled={selecionados.length >= LIMITE_TENIS_LINK}
                title={selecionados.length >= LIMITE_TENIS_LINK ? `O link aceita até ${LIMITE_TENIS_LINK} tênis.` : undefined}
                onClick={() => {
                  setErro(null);
                  setEtapa("tenis");
                }}
              >
                <span className="sm:hidden">+ Tênis</span>
                <span className="hidden sm:inline">Adicionar mais tênis</span>
              </SecondaryButton>
            </div>
            <PrimaryButton type="button" className="flex-1 lg:flex-none" loading={gerando} disabled={bloqueado} onClick={() => void gerar()}>
              Gerar link
            </PrimaryButton>
          </BarraAcoesEtapa>
        </div>
      ) : null}

      {etapa === "pronto" && criado ? (
        <SectionCard
          title="Mensagem para copiar"
          description={`${instagramVisivel} · ${selecionados.length} ${selecionados.length === 1 ? "par" : "pares"} · ${formatarMoeda(total, moeda.moeda)} · ${validadeHoras} h após a abertura.`}
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
