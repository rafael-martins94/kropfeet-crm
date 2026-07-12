import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { NomeRapidoModal } from "../../components/NomeRapidoModal";
import { EnderecoClienteCampos } from "../../components/clientes/EnderecoClienteCampos";
import { enderecoVazio } from "../../components/clientes/EnderecosClienteEditor";
import { FieldWrapper, FormDate, FormInput, FormTextarea } from "../../components/FormField";
import { IconPlus, IconUser } from "../../components/Icons";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { StatusSelectDropdown } from "../../components/StatusSelectDropdown";
import { SearchableSelectDropdown } from "../../components/SearchableSelectDropdown";
import { MarcadoresEditor, type Marcador } from "../../components/vendas/MarcadoresEditor";
import {
  ItensVendaEditor,
  totalItensVenda,
  type ItemVendaFormLinha,
} from "../../components/vendas/ItensVendaEditor";
import {
  novaParcelaVendaLinha,
  ParcelasVendaEditor,
  type ParcelaVendaFormLinha,
} from "../../components/vendas/ParcelasVendaEditor";
import {
  caminhoListaVendas,
  formaPagamentoOpcoes,
  formaPagamentoUsaParcelas,
  freteStatusOpcoes,
  localVendaOpcoes,
  moedaPorRegiao,
  opcoesComValorAtual,
  parseRegiaoVendaRota,
  regiaoVendaOpcoes,
} from "./vendaOpcoes";
import { vendasService } from "../../services/vendas";
import { clientesService } from "../../services/clientes";
import { vendedoresService } from "../../services/vendedores";
import { formasEnvioService } from "../../services/formas-envio";
import {
  enderecosClienteService,
  type EnderecoClienteForm,
} from "../../services/enderecos-cliente";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../contexts/ToastContext";
import { mensagemErro } from "../../utils/errors";
import type {
  FreteStatus,
  LocalVenda,
  StatusVenda,
  TipoRegiao,
  VendaInsert,
  VendaUpdate,
} from "../../types/entities";
import { formatarMoeda, traduzirEnum } from "../../utils/format";
import { cn } from "../../utils/cn";
import {
  enderecoTemDados,
  formatarEnderecoLinha,
  formatarEnderecoOpcao,
  formatarLocalidade,
} from "../../utils/endereco";

const statusOpcoes: Array<{ value: StatusVenda; label: string }> = [
  { value: "em_aberto", label: "Em aberto" },
  { value: "pago", label: "Pago" },
  { value: "preparando_envio", label: "Preparando envio" },
  { value: "enviado", label: "Enviado" },
  { value: "finalizado", label: "Finalizado" },
  { value: "cancelado", label: "Cancelado" },
];

type FormState = {
  numero: string;
  status_venda: StatusVenda;
  regiao_venda: TipoRegiao;
  id_cliente: string;
  id_endereco_cliente: string;
  id_vendedor: string;
  id_forma_envio: string;
  local_venda: LocalVenda | "";
  /** Denormalizado a partir do cliente; não aparece na UI. */
  nome_cliente: string;
  data_pedido: string;
  forma_pagamento: string;
  codigo_venda_adquirente: string;
  codigo_rastreamento: string;
  url_rastreamento: string;
  valor_frete: string;
  frete_status: FreteStatus;
  data_pagamento_frete: string;
  valor_desconto: string;
  outras_despesas: string;
  valor_total: string;
  obs: string;
  obs_interna: string;
  marcadores: Marcador[];
};

type ClienteNovoForm = {
  nome: string;
  email: string;
  telefone: string;
  pais: string;
};

function hojeIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function paisPorRegiao(regiao: TipoRegiao): string {
  return regiao === "europa" ? "Europa" : "Brasil";
}

function estadoInicial(regiao: TipoRegiao): FormState {
  return {
    numero: "",
    status_venda: "em_aberto",
    regiao_venda: regiao,
    id_cliente: "",
    id_endereco_cliente: "",
    id_vendedor: "",
    id_forma_envio: "",
    local_venda: "",
    nome_cliente: "",
    data_pedido: hojeIsoDate(),
    forma_pagamento: "",
    codigo_venda_adquirente: "",
    codigo_rastreamento: "",
    url_rastreamento: "",
    valor_frete: "0",
    frete_status: "nao_aplicavel",
    data_pagamento_frete: "",
    valor_desconto: "0",
    outras_despesas: "0",
    valor_total: "0",
    obs: "",
    obs_interna: "",
    marcadores: [],
  };
}

function clienteNovoVazio(regiao: TipoRegiao): ClienteNovoForm {
  return {
    nome: "",
    email: "",
    telefone: "",
    pais: paisPorRegiao(regiao),
  };
}

function enderecoNovoVazio(regiao: TipoRegiao): EnderecoClienteForm {
  return {
    ...enderecoVazio(true),
    pais: paisPorRegiao(regiao),
  };
}

function num(s: string, padrao = 0): number {
  if (!s || s.trim() === "") return padrao;
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) ? v : padrao;
}

function txtOuNulo(s: string): string | null {
  return s.trim() === "" ? null : s.trim();
}

function dataOuNulo(s: string): string | null {
  return s.trim() === "" ? null : s;
}

function enderecoMinimoOk(e: EnderecoClienteForm): boolean {
  return Boolean(e.cidade.trim());
}

export default function VendaFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isNovo = !id;
  const regiaoQuery = parseRegiaoVendaRota(searchParams.get("regiao")) ?? "brasil";

  const [form, setForm] = useState<FormState>(() => estadoInicial(regiaoQuery));
  const [modoNovoCliente, setModoNovoCliente] = useState(false);
  const [clienteNovo, setClienteNovo] = useState<ClienteNovoForm>(() =>
    clienteNovoVazio(regiaoQuery),
  );
  const [enderecoNovo, setEnderecoNovo] = useState<EnderecoClienteForm>(() =>
    enderecoNovoVazio(regiaoQuery),
  );
  const [itens, setItens] = useState<ItemVendaFormLinha[]>([]);
  const [parcelas, setParcelas] = useState<ParcelaVendaFormLinha[]>([]);
  const [numeroExibicao, setNumeroExibicao] = useState<string | null>(null);
  const [loadingInicial, setLoadingInicial] = useState(!isNovo);
  const [salvando, setSalvando] = useState(false);
  const [modalVendedor, setModalVendedor] = useState(false);
  const [modalFormaEnvio, setModalFormaEnvio] = useState(false);

  const clientes = useAsync(() => clientesService.listarTodos(), []);
  const vendedores = useAsync(() => vendedoresService.listarAtivos(), []);
  const formasEnvio = useAsync(() => formasEnvioService.listarAtivas(), []);
  const enderecosCliente = useAsync(
    () =>
      form.id_cliente
        ? enderecosClienteService.listarPorCliente(form.id_cliente)
        : Promise.resolve([]),
    [form.id_cliente],
  );
  const opcoesCliente = [
    { value: "", label: "— Sem cliente vinculado —" },
    ...(clientes.data ?? []).map((c) => ({ value: c.id, label: c.nome })),
  ];
  const opcoesVendedor = [
    { value: "", label: "— Sem vendedor —" },
    ...(vendedores.data ?? []).map((v) => ({ value: v.id, label: v.nome })),
  ];
  const opcoesFormaEnvio = [
    { value: "", label: "— Sem forma de envio —" },
    ...(formasEnvio.data ?? []).map((f) => ({ value: f.id, label: f.nome })),
  ];

  const listaEnderecos = enderecosCliente.data ?? [];
  const clienteSemEndereco = Boolean(
    form.id_cliente && !enderecosCliente.loading && listaEnderecos.length === 0,
  );
  const clienteSelecionado = (clientes.data ?? []).find((c) => c.id === form.id_cliente);

  useEffect(() => {
    if (!id) {
      setForm(estadoInicial(regiaoQuery));
      setModoNovoCliente(false);
      setClienteNovo(clienteNovoVazio(regiaoQuery));
      setEnderecoNovo(enderecoNovoVazio(regiaoQuery));
      setItens([]);
      setParcelas([]);
      setLoadingInicial(false);
      return;
    }
    setLoadingInicial(true);
    setModoNovoCliente(false);
    Promise.all([
      vendasService.obter(id),
      vendasService.obterItens(id),
      vendasService.obterParcelas(id),
    ])
      .then(([v, listaItens, listaParcelas]) => {
        if (!v) return;
        setNumeroExibicao(v.numero);
        setForm({
          numero: v.numero ?? "",
          status_venda: v.status_venda,
          regiao_venda: v.regiao_venda,
          id_cliente: v.id_cliente ?? "",
          id_endereco_cliente: v.id_endereco_cliente ?? "",
          id_vendedor: v.id_vendedor ?? "",
          id_forma_envio: v.id_forma_envio ?? "",
          local_venda: v.local_venda ?? "",
          nome_cliente: v.nome_cliente ?? "",
          data_pedido: v.data_pedido ? v.data_pedido.slice(0, 10) : "",
          forma_pagamento: v.forma_pagamento ?? "",
          codigo_venda_adquirente: v.codigo_venda_adquirente ?? "",
          codigo_rastreamento: v.codigo_rastreamento ?? "",
          url_rastreamento: v.url_rastreamento ?? "",
          valor_frete: String(v.valor_frete ?? 0),
          frete_status: v.frete_status ?? "nao_aplicavel",
          data_pagamento_frete: v.data_pagamento_frete
            ? v.data_pagamento_frete.slice(0, 10)
            : "",
          valor_desconto: String(v.valor_desconto ?? 0),
          outras_despesas: String(v.outras_despesas ?? 0),
          valor_total: String(v.valor_total ?? 0),
          obs: v.obs ?? "",
          obs_interna: v.obs_interna ?? "",
          marcadores: Array.isArray(v.marcadores) ? (v.marcadores as Marcador[]) : [],
        });
        setEnderecoNovo(enderecoNovoVazio(v.regiao_venda));
        setItens(
          listaItens.map((iv) => ({
            key: iv.id,
            id_item_estoque: iv.id_item_estoque,
            codigo: iv.codigo ?? iv.item_estoque?.sku ?? "",
            descricao: iv.descricao ?? iv.item_estoque?.nome_produto ?? "",
            valor_unitario: String(iv.valor_unitario ?? 0),
          })),
        );
        setParcelas(
          listaParcelas.map((p) =>
            novaParcelaVendaLinha({
              key: p.id,
              data_vencimento: p.data_vencimento ?? "",
              valor: String(p.valor ?? 0),
              forma_pagamento: p.forma_pagamento ?? "",
              meio_pagamento: p.meio_pagamento ?? "",
              pago: p.pago,
            }),
          ),
        );
      })
      .catch((e) => toast.erro(mensagemErro(e), "Erro ao carregar"))
      .finally(() => setLoadingInicial(false));
  }, [id, regiaoQuery, toast]);

  useEffect(() => {
    const lista = enderecosCliente.data;
    if (!lista) return;

    setForm((s) => {
      if (!s.id_cliente) {
        return s.id_endereco_cliente ? { ...s, id_endereco_cliente: "" } : s;
      }
      if (lista.length === 0) {
        return s.id_endereco_cliente ? { ...s, id_endereco_cliente: "" } : s;
      }
      if (lista.some((e) => e.id === s.id_endereco_cliente)) return s;
      const principal = lista.find((e) => e.principal) ?? lista[0];
      return { ...s, id_endereco_cliente: principal.id };
    });
  }, [form.id_cliente, enderecosCliente.data]);

  useEffect(() => {
    if (!form.id_cliente || modoNovoCliente) return;
    if (enderecosCliente.loading) return;
    if ((enderecosCliente.data ?? []).length > 0) return;
    setEnderecoNovo(enderecoNovoVazio(form.regiao_venda));
  }, [
    form.id_cliente,
    form.regiao_venda,
    modoNovoCliente,
    enderecosCliente.loading,
    enderecosCliente.data,
  ]);

  const enderecoSelecionado = listaEnderecos.find((e) => e.id === form.id_endereco_cliente);
  const opcoesEndereco = [
    { value: "", label: "— Selecione o endereço —" },
    ...listaEnderecos.map((e) => ({
      value: e.id,
      label: formatarEnderecoOpcao(e),
    })),
  ];

  const listaVolta = caminhoListaVendas(form.regiao_venda);
  const moeda = moedaPorRegiao(form.regiao_venda);
  const totalPreview = formatarMoeda(num(form.valor_total), moeda);

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const atualizarItens = (proximos: ItemVendaFormLinha[]) => {
    setItens(proximos);
    const subtotal = totalItensVenda(proximos);
    setForm((s) => {
      const total = Math.max(
        0,
        subtotal + num(s.valor_frete) + num(s.outras_despesas) - num(s.valor_desconto),
      );
      return { ...s, valor_total: String(Number(total.toFixed(2))) };
    });
  };

  const updValor = (campo: "valor_frete" | "valor_desconto" | "outras_despesas", valor: string) => {
    setForm((s) => {
      const next = { ...s, [campo]: valor };
      if (campo === "valor_frete") {
        const frete = num(valor);
        if (frete > 0 && s.frete_status === "nao_aplicavel") {
          next.frete_status = "pendente";
        } else if (frete <= 0 && s.frete_status === "pendente") {
          next.frete_status = "nao_aplicavel";
          next.data_pagamento_frete = "";
        }
      }
      const subtotal = totalItensVenda(itens);
      const total = Math.max(
        0,
        subtotal +
          num(campo === "valor_frete" ? valor : next.valor_frete) +
          num(campo === "outras_despesas" ? valor : next.outras_despesas) -
          num(campo === "valor_desconto" ? valor : next.valor_desconto),
      );
      return { ...next, valor_total: String(Number(total.toFixed(2))) };
    });
  };

  const updFreteStatus = (status: FreteStatus) => {
    setForm((s) => ({
      ...s,
      frete_status: status,
      data_pagamento_frete:
        status === "pago" ? s.data_pagamento_frete || hojeIsoDate() : "",
    }));
  };

  const updClienteNovo = <K extends keyof ClienteNovoForm>(k: K, v: ClienteNovoForm[K]) =>
    setClienteNovo((s) => ({ ...s, [k]: v }));

  const abrirNovoCliente = () => {
    setModoNovoCliente(true);
    setForm((s) => ({ ...s, id_cliente: "", id_endereco_cliente: "", nome_cliente: "" }));
    setClienteNovo(clienteNovoVazio(form.regiao_venda));
    setEnderecoNovo(enderecoNovoVazio(form.regiao_venda));
  };

  const cancelarNovoCliente = () => {
    setModoNovoCliente(false);
    setClienteNovo(clienteNovoVazio(form.regiao_venda));
    setEnderecoNovo(enderecoNovoVazio(form.regiao_venda));
  };

  const montarPayloadBase = (
    idCliente: string | null,
    idEndereco: string | null,
    nomeCliente: string | null,
  ): VendaUpdate => ({
    numero: txtOuNulo(form.numero),
    status_venda: form.status_venda,
    regiao_venda: form.regiao_venda,
    id_cliente: idCliente,
    id_endereco_cliente: idEndereco,
    id_vendedor: form.id_vendedor || null,
    id_forma_envio: form.id_forma_envio || null,
    local_venda: (form.local_venda || null) as LocalVenda | null,
    nome_cliente: nomeCliente,
    data_pedido: dataOuNulo(form.data_pedido),
    forma_pagamento: txtOuNulo(form.forma_pagamento),
    codigo_venda_adquirente: txtOuNulo(form.codigo_venda_adquirente),
    codigo_rastreamento: txtOuNulo(form.codigo_rastreamento),
    url_rastreamento: txtOuNulo(form.url_rastreamento),
    valor_frete: num(form.valor_frete),
    frete_status: form.frete_status,
    data_pagamento_frete:
      form.frete_status === "pago" ? dataOuNulo(form.data_pagamento_frete) : null,
    valor_desconto: num(form.valor_desconto),
    outras_despesas: num(form.outras_despesas),
    valor_total: num(form.valor_total),
    total_produtos: 0,
    obs: txtOuNulo(form.obs),
    obs_interna: txtOuNulo(form.obs_interna),
    marcadores: (form.marcadores.length > 0
      ? form.marcadores
      : null) as VendaUpdate["marcadores"],
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      let idCliente = form.id_cliente || null;
      let idEndereco = form.id_endereco_cliente || null;
      let nomeCliente: string | null = null;

      if (modoNovoCliente) {
        const nome = clienteNovo.nome.trim();
        if (!nome) {
          throw new Error("Informe o nome do cliente.");
        }

        const criado = await clientesService.criar({
          nome,
          email: txtOuNulo(clienteNovo.email),
          telefone: txtOuNulo(clienteNovo.telefone),
          pais: txtOuNulo(clienteNovo.pais) ?? paisPorRegiao(form.regiao_venda),
        });
        idCliente = criado.id;
        nomeCliente = criado.nome;

        // Endereço opcional.
        if (enderecoTemDados(enderecoNovo) && enderecoMinimoOk(enderecoNovo)) {
          const enderecoCriado = await enderecosClienteService.criar(criado.id, {
            ...enderecoNovo,
            principal: true,
            rotulo: enderecoNovo.rotulo.trim() || "Principal",
            pais: enderecoNovo.pais.trim() || criado.pais || paisPorRegiao(form.regiao_venda),
          });
          idEndereco = enderecoCriado.id;
        } else {
          idEndereco = null;
        }
      } else {
        const selecionado = (clientes.data ?? []).find((c) => c.id === form.id_cliente);
        nomeCliente = selecionado?.nome ?? txtOuNulo(form.nome_cliente);
      }

      const payload = montarPayloadBase(idCliente, idEndereco, nomeCliente);
      const subtotal = totalItensVenda(itens);
      const total = Math.max(
        0,
        subtotal + num(form.valor_frete) + num(form.outras_despesas) - num(form.valor_desconto),
      );
      payload.total_produtos = Number(subtotal.toFixed(2));
      // Sem itens, respeita o total informado no formulário (pedido sem produto / só frete etc.).
      payload.valor_total =
        itens.length > 0 ? Number(total.toFixed(2)) : num(form.valor_total) || Number(total.toFixed(2));

      const itensPayload = itens.map((item) => ({
        id_item_estoque: item.id_item_estoque,
        codigo: txtOuNulo(item.codigo),
        descricao: txtOuNulo(item.descricao),
        quantidade: 1,
        valor_unitario: num(item.valor_unitario),
      }));

      const parcelasPayload = parcelas.map((p, idx) => ({
        numero: idx + 1,
        data_vencimento: dataOuNulo(p.data_vencimento),
        valor: num(p.valor),
        forma_pagamento: txtOuNulo(p.forma_pagamento),
        meio_pagamento: txtOuNulo(p.meio_pagamento),
        pago: p.pago,
      }));

      if (
        parcelasPayload.length === 0 &&
        formaPagamentoUsaParcelas(form.forma_pagamento)
      ) {
        toast.aviso(
          "Sem parcelas cadastradas. Em múltiplas/crédito o ideal é detalhar os vencimentos.",
          "Parcelas opcionais",
        );
      }

      if (id) {
        await vendasService.atualizar(id, payload);
        await vendasService.substituirItens(id, itensPayload);
        await vendasService.substituirParcelas(id, parcelasPayload);
        toast.sucesso("Ordem de venda atualizada.");
        navigate(`/vendas/${id}`);
      } else {
        const criada = await vendasService.criar(payload as VendaInsert);
        await vendasService.substituirItens(criada.id, itensPayload);
        await vendasService.substituirParcelas(criada.id, parcelasPayload);
        toast.sucesso("Ordem de venda criada.");
        navigate(`/vendas/${criada.id}`);
      }
    } catch (err) {
      toast.erro(mensagemErro(err), "Não foi possível salvar");
    } finally {
      setSalvando(false);
    }
  };

  const titulo = isNovo
    ? `Nova ordem · ${traduzirEnum(form.regiao_venda)}`
    : numeroExibicao
      ? `Editar pedido ${numeroExibicao}`
      : "Editar ordem de venda";

  const nomeClienteResumo = modoNovoCliente
    ? clienteNovo.nome.trim() || "Novo cliente"
    : clienteSelecionado?.nome || form.nome_cliente || "Sem cliente";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pb-24">
        <PageHeader
          title={titulo}
          breadcrumbs={[
            { label: "Comercial" },
            { label: "Ordens de venda", to: "/vendas" },
            { label: traduzirEnum(form.regiao_venda), to: listaVolta },
            { label: isNovo ? "Nova" : "Editar" },
          ]}
          backTo={id ? `/vendas/${id}` : listaVolta}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={form.regiao_venda} />
              <StatusBadge value={form.status_venda} />
            </div>
          }
        />

        {loadingInicial ? (
          <SectionCard>
            <div className="text-sm text-ink-soft">Carregando…</div>
          </SectionCard>
        ) : (
          <form id="venda-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:order-2 lg:col-span-9">
                <SectionCard
                  title="Cliente e entrega"
                  description={
                    modoNovoCliente
                      ? "Cadastre o cliente neste pedido. Endereço é opcional."
                      : "Quem compra e, se houver, o endereço de entrega."
                  }
                  titleAccessory={
                    modoNovoCliente ? (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-100">
                        Novo
                      </span>
                    ) : null
                  }
                >
                  <div className="space-y-6">
                    {!modoNovoCliente ? (
                      <div className="space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                          <FieldWrapper
                            id="cliente-venda"
                            label="Cliente"
                            className="min-w-0 flex-1"
                          >
                            <SearchableSelectDropdown
                              value={form.id_cliente}
                              options={opcoesCliente}
                              loading={clientes.loading}
                              searchPlaceholder="Buscar por nome…"
                              emptyLabel="— Sem cliente vinculado —"
                              onChange={(v) => {
                                const cliente = (clientes.data ?? []).find((c) => c.id === v);
                                setForm((s) => ({
                                  ...s,
                                  id_cliente: v,
                                  id_endereco_cliente: "",
                                  nome_cliente: cliente?.nome ?? "",
                                }));
                              }}
                            />
                          </FieldWrapper>
                          <SecondaryButton
                            type="button"
                            icon={<IconPlus width={16} height={16} />}
                            onClick={abrirNovoCliente}
                            className="shrink-0"
                          >
                            Novo cliente
                          </SecondaryButton>
                        </div>

                        {clienteSelecionado ? (
                          <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-subtle/50 px-4 py-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                              <IconUser width={16} height={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-ink">
                                {clienteSelecionado.nome}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-ink-soft">
                                {[
                                  clienteSelecionado.email,
                                  clienteSelecionado.telefone,
                                  clienteSelecionado.pais,
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || "Sem contato cadastrado"}
                              </p>
                              {clienteSemEndereco ? (
                                <p className="mt-1.5 text-xs font-medium text-amber-800">
                                  Sem endereço cadastrado.
                                </p>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                            1 · Dados do cliente
                          </p>
                          <button
                            type="button"
                            onClick={cancelarNovoCliente}
                            className="text-sm font-medium text-ink-soft hover:text-brand-700"
                          >
                            Usar existente
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <FormInput
                            label="Nome"
                            value={clienteNovo.nome}
                            onChange={(e) => updClienteNovo("nome", e.target.value)}
                            required
                            autoFocus
                            placeholder="Nome completo"
                            wrapperClassName="sm:col-span-2"
                          />
                          <FormInput
                            label="E-mail"
                            type="email"
                            value={clienteNovo.email}
                            onChange={(e) => updClienteNovo("email", e.target.value)}
                            placeholder="email@exemplo.com"
                          />
                          <FormInput
                            label="Telefone"
                            value={clienteNovo.telefone}
                            onChange={(e) => updClienteNovo("telefone", e.target.value)}
                            placeholder="+351 ou (11) …"
                          />
                          <FormInput
                            label="País"
                            value={clienteNovo.pais}
                            onChange={(e) => updClienteNovo("pais", e.target.value)}
                            wrapperClassName="sm:col-span-2"
                          />
                        </div>
                      </div>
                    )}

                    <div
                      className={cn(
                        "border-t border-line/80 pt-6",
                        !modoNovoCliente && !form.id_cliente && "opacity-70",
                      )}
                    >
                      {modoNovoCliente ? (
                        <>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                            2 · Endereço de entrega
                          </p>
                          <p className="mb-4 text-xs text-ink-soft">Opcional.</p>
                          <EnderecoClienteCampos
                            value={enderecoNovo}
                            onChange={(patch) => setEnderecoNovo((s) => ({ ...s, ...patch }))}
                            idPrefix="endereco-novo"
                          />
                        </>
                      ) : !form.id_cliente ? (
                        <div className="rounded-xl border border-dashed border-line bg-surface-subtle/30 px-4 py-8 text-center">
                          <p className="text-sm text-ink-soft">
                            Selecione um cliente ou cadastre um novo para definir a entrega.
                          </p>
                        </div>
                      ) : enderecosCliente.loading ? (
                        <p className="text-sm text-ink-soft">Carregando endereços…</p>
                      ) : listaEnderecos.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-line bg-surface-subtle/30 px-4 py-6 text-center">
                          <p className="text-sm text-ink-soft">Sem endereço neste pedido.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <FieldWrapper id="endereco-entrega" label="Endereço de entrega">
                            <SearchableSelectDropdown
                              value={form.id_endereco_cliente}
                              options={opcoesEndereco}
                              loading={enderecosCliente.loading}
                              searchPlaceholder="Buscar endereço…"
                              emptyLabel="— Sem endereço neste pedido —"
                              onChange={(v) => upd("id_endereco_cliente", v)}
                            />
                          </FieldWrapper>

                          {enderecoSelecionado ? (
                            <div className="rounded-xl border border-line bg-surface-subtle/60 p-4 text-sm">
                              <p className="font-medium text-ink">
                                {enderecoSelecionado.rotulo || "Endereço selecionado"}
                                {enderecoSelecionado.principal ? (
                                  <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                                    Principal
                                  </span>
                                ) : null}
                              </p>
                              {formatarEnderecoLinha(enderecoSelecionado) ? (
                                <p className="mt-1 text-ink">
                                  {formatarEnderecoLinha(enderecoSelecionado)}
                                </p>
                              ) : null}
                              {enderecoSelecionado.bairro ? (
                                <p className="text-ink-soft">{enderecoSelecionado.bairro}</p>
                              ) : null}
                              {formatarLocalidade(enderecoSelecionado) ? (
                                <p className="text-ink-soft">
                                  {formatarLocalidade(enderecoSelecionado)}
                                </p>
                              ) : null}
                              <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-faint">
                                {enderecoSelecionado.cep ? (
                                  <span>CEP {enderecoSelecionado.cep}</span>
                                ) : null}
                                {enderecoSelecionado.pais ? (
                                  <span>{enderecoSelecionado.pais}</span>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Itens da ordem"
                  description={
                    form.regiao_venda === "europa"
                      ? "Opcional. Somente itens em estoque na Europa — o valor vem do cadastro."
                      : form.regiao_venda === "brasil"
                        ? "Opcional. Somente itens em estoque no Brasil — o valor vem do cadastro."
                        : "Opcional. Cada item de estoque é único — o valor vem do cadastro do item."
                  }
                >
                  <ItensVendaEditor
                    value={itens}
                    onChange={atualizarItens}
                    regiao={form.regiao_venda}
                    moeda={moeda}
                  />
                </SectionCard>

                <SectionCard
                  title="Pagamento e parcelas"
                  description="Forma do pedido e, se quiser, o detalhe das parcelas (vencimento, meio e pago). Parcelas não são obrigatórias."
                >
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FieldWrapper id="forma-pagamento" label="Forma de pagamento">
                        <SearchableSelectDropdown
                          value={form.forma_pagamento}
                          options={opcoesComValorAtual(
                            formaPagamentoOpcoes,
                            form.forma_pagamento,
                            "— Não informado —",
                          )}
                          searchPlaceholder="Buscar forma…"
                          emptyLabel="— Não informado —"
                          onChange={(v) => upd("forma_pagamento", v)}
                        />
                      </FieldWrapper>
                      <FormInput
                        label="Código de venda"
                        value={form.codigo_venda_adquirente}
                        onChange={(e) => upd("codigo_venda_adquirente", e.target.value)}
                        placeholder="Código da adquirente…"
                      />
                    </div>

                    <div className="border-t border-line pt-4">
                      <ParcelasVendaEditor
                        value={parcelas}
                        onChange={setParcelas}
                        valorTotalPedido={
                          itens.length > 0
                            ? Math.max(
                                0,
                                totalItensVenda(itens) +
                                  num(form.valor_frete) +
                                  num(form.outras_despesas) -
                                  num(form.valor_desconto),
                              )
                            : num(form.valor_total)
                        }
                        moeda={moeda}
                      />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Envio e observações"
                  description="Opcional na criação — pode completar depois."
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <FieldWrapper id="forma-envio" label="Forma de envio">
                      <SearchableSelectDropdown
                        value={form.id_forma_envio}
                        options={opcoesFormaEnvio}
                        loading={formasEnvio.loading}
                        searchPlaceholder="Buscar forma…"
                        emptyLabel="— Sem forma de envio —"
                        onChange={(v) => upd("id_forma_envio", v)}
                        onCreateNew={() => setModalFormaEnvio(true)}
                        createNewLabel="Adicionar forma de envio"
                      />
                    </FieldWrapper>
                    <FormInput
                      label="Código de rastreamento"
                      value={form.codigo_rastreamento}
                      onChange={(e) => upd("codigo_rastreamento", e.target.value)}
                    />
                    <FormInput
                      label="URL de rastreamento"
                      value={form.url_rastreamento}
                      onChange={(e) => upd("url_rastreamento", e.target.value)}
                    />
                    <FormTextarea
                      label="Observação"
                      rows={3}
                      value={form.obs}
                      onChange={(e) => upd("obs", e.target.value)}
                      placeholder="Visível no pedido…"
                      wrapperClassName="sm:col-span-3"
                    />
                    <FormTextarea
                      label="Observação interna"
                      rows={5}
                      value={form.obs_interna}
                      onChange={(e) => upd("obs_interna", e.target.value)}
                      placeholder="Só para a equipe…"
                      wrapperClassName="sm:col-span-3"
                    />
                  </div>
                </SectionCard>
              </div>

              <div className="space-y-6 lg:order-1 lg:col-span-3 lg:sticky lg:top-4 lg:self-start">
                <SectionCard
                  title="Pedido"
                  description={
                    isNovo
                      ? `Manual · ${traduzirEnum(form.regiao_venda)} · ${moeda}`
                      : undefined
                  }
                >
                  <div className="space-y-4">
                    <FormInput
                      label="Número"
                      value={form.numero}
                      onChange={(e) => upd("numero", e.target.value)}
                      placeholder="Ex.: 1897"
                      autoFocus={isNovo && !modoNovoCliente}
                    />
                    <FormDate
                      label="Data do pedido"
                      value={form.data_pedido}
                      onChange={(e) => upd("data_pedido", e.target.value)}
                      required={isNovo}
                    />
                    <FieldWrapper id="regiao-venda" label="Região">
                      <StatusSelectDropdown
                        value={form.regiao_venda}
                        options={regiaoVendaOpcoes}
                        onChange={(v) => {
                          const regiao = v as TipoRegiao;
                          const regiaoAnterior = form.regiao_venda;
                          upd("regiao_venda", regiao);
                          if (regiao !== regiaoAnterior && itens.some((i) => i.id_item_estoque)) {
                            atualizarItens([]);
                          }
                          if (modoNovoCliente) {
                            setClienteNovo((s) => ({
                              ...s,
                              pais: s.pais.trim() ? s.pais : paisPorRegiao(regiao),
                            }));
                            setEnderecoNovo((s) => ({
                              ...s,
                              pais: s.pais.trim() ? s.pais : paisPorRegiao(regiao),
                            }));
                          }
                        }}
                      />
                    </FieldWrapper>
                    <FieldWrapper id="vendedor-venda" label="Vendedor">
                      <SearchableSelectDropdown
                        value={form.id_vendedor}
                        options={opcoesVendedor}
                        loading={vendedores.loading}
                        searchPlaceholder="Buscar vendedor…"
                        emptyLabel="— Sem vendedor —"
                        onChange={(v) => upd("id_vendedor", v)}
                        onCreateNew={() => setModalVendedor(true)}
                        createNewLabel="Adicionar vendedor"
                      />
                    </FieldWrapper>
                    <FieldWrapper id="local-venda" label="Local de venda">
                      <StatusSelectDropdown
                        value={form.local_venda}
                        options={localVendaOpcoes}
                        onChange={(v) => upd("local_venda", v as LocalVenda | "")}
                      />
                    </FieldWrapper>
                    <FieldWrapper id="status-venda" label="Status">
                      <StatusSelectDropdown
                        value={form.status_venda}
                        options={statusOpcoes}
                        onChange={(v) => upd("status_venda", v as StatusVenda)}
                      />
                    </FieldWrapper>
                  </div>
                </SectionCard>

                <SectionCard title="Valores" description={`Moeda: ${moeda}`}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
                      <FormInput
                        label="Frete"
                        value={form.valor_frete}
                        onChange={(e) => updValor("valor_frete", e.target.value)}
                        inputMode="decimal"
                      />
                      <FieldWrapper id="frete-status" label="Status do frete">
                        <StatusSelectDropdown
                          value={form.frete_status}
                          options={freteStatusOpcoes}
                          onChange={(v) => updFreteStatus(v as FreteStatus)}
                        />
                      </FieldWrapper>
                      {form.frete_status === "pago" ? (
                        <FormDate
                          label="Data pagamento frete"
                          value={form.data_pagamento_frete}
                          onChange={(e) => upd("data_pagamento_frete", e.target.value)}
                        />
                      ) : null}
                      <FormInput
                        label="Desconto"
                        value={form.valor_desconto}
                        onChange={(e) => updValor("valor_desconto", e.target.value)}
                        inputMode="decimal"
                      />
                      <FormInput
                        label="Outras despesas"
                        value={form.outras_despesas}
                        onChange={(e) => updValor("outras_despesas", e.target.value)}
                        inputMode="decimal"
                      />
                    </div>
                    <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4">
                      <FormInput
                        label="Total do pedido"
                        value={form.valor_total}
                        onChange={(e) => upd("valor_total", e.target.value)}
                        inputMode="decimal"
                      />
                      <p className="mt-2 font-numeric text-lg font-semibold tabular-nums text-brand-800">
                        {totalPreview}
                      </p>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Tags" description="Filtrar na listagem.">
                  <MarcadoresEditor
                    value={form.marcadores}
                    onChange={(v) => upd("marcadores", v)}
                  />
                </SectionCard>

                <div className="hidden rounded-xl border border-line bg-surface px-4 py-3 text-sm lg:block">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                    Resumo
                  </p>
                  <p className="mt-2 font-medium text-ink">{nomeClienteResumo}</p>
                  <p className="mt-0.5 text-ink-soft">
                    {modoNovoCliente
                      ? enderecoNovo.cidade.trim()
                        ? [enderecoNovo.cidade, enderecoNovo.uf || enderecoNovo.pais]
                            .filter(Boolean)
                            .join(" · ")
                        : "Sem endereço"
                      : enderecoSelecionado
                        ? formatarLocalidade(enderecoSelecionado) || "Endereço selecionado"
                        : "Sem endereço"}
                  </p>
                  <p className="mt-2 font-numeric text-sm tabular-nums text-ink">
                    Total {totalPreview}
                  </p>
                </div>
              </div>
            </div>

          </form>
        )}
      </div>

      {!loadingInicial ? (
        <div className="sticky bottom-0 z-10 border-t border-line bg-surface/95 px-0 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-sm text-ink-soft">
              <span className="font-medium text-ink">{nomeClienteResumo}</span>
              <span className="mx-2 text-ink-faint">·</span>
              <span className="font-numeric tabular-nums">{totalPreview}</span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <SecondaryButton
                type="button"
                onClick={() => navigate(id ? `/vendas/${id}` : listaVolta)}
              >
                Cancelar
              </SecondaryButton>
              <PrimaryButton type="submit" form="venda-form" loading={salvando}>
                {isNovo ? "Criar ordem" : "Salvar alterações"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}

      <NomeRapidoModal
        open={modalVendedor}
        onClose={() => setModalVendedor(false)}
        title="Novo vendedor"
        label="Nome"
        placeholder="Ex.: Karina, Gustavo…"
        criar={(nome) => vendedoresService.criar(nome)}
        onCriado={(vendedor) => {
          upd("id_vendedor", vendedor.id);
          vendedores.reload();
        }}
      />
      <NomeRapidoModal
        open={modalFormaEnvio}
        onClose={() => setModalFormaEnvio(false)}
        title="Nova forma de envio"
        label="Nome"
        placeholder="Ex.: CTT, Retirada pessoalmente…"
        criar={(nome) => formasEnvioService.criar(nome)}
        onCriado={(forma) => {
          upd("id_forma_envio", forma.id);
          formasEnvio.reload();
        }}
      />
    </div>
  );
}
