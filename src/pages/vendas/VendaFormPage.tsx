import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FieldWrapper, FormDate, FormInput, FormTextarea } from "../../components/FormField";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { StatusSelectDropdown } from "../../components/StatusSelectDropdown";
import { SearchableSelectDropdown } from "../../components/SearchableSelectDropdown";
import { MarcadoresEditor, type Marcador } from "../../components/vendas/MarcadoresEditor";
import {
  caminhoListaVendas,
  formaPagamentoOpcoes,
  meioPagamentoOpcoes,
  moedaPorRegiao,
  opcoesComValorAtual,
  parseRegiaoVendaRota,
  regiaoVendaOpcoes,
} from "./vendaOpcoes";
import { vendasService } from "../../services/vendas";
import { clientesService } from "../../services/clientes";
import { enderecosClienteService } from "../../services/enderecos-cliente";
import { useAsync } from "../../hooks/useAsync";
import type { StatusVenda, TipoRegiao, VendaInsert, VendaUpdate } from "../../types/entities";
import { traduzirEnum } from "../../utils/format";
import {
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
  nome_cliente: string;
  data_pedido: string;
  data_prevista: string;
  data_envio: string;
  data_entrega: string;
  forma_pagamento: string;
  meio_pagamento: string;
  codigo_rastreamento: string;
  url_rastreamento: string;
  valor_frete: string;
  valor_desconto: string;
  outras_despesas: string;
  valor_total: string;
  obs: string;
  obs_interna: string;
  marcadores: Marcador[];
};

function hojeIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function estadoInicial(regiao: TipoRegiao): FormState {
  return {
    numero: "",
    status_venda: "em_aberto",
    regiao_venda: regiao,
    id_cliente: "",
    id_endereco_cliente: "",
    nome_cliente: "",
    data_pedido: hojeIsoDate(),
    data_prevista: "",
    data_envio: "",
    data_entrega: "",
    forma_pagamento: "",
    meio_pagamento: "",
    codigo_rastreamento: "",
    url_rastreamento: "",
    valor_frete: "0",
    valor_desconto: "0",
    outras_despesas: "0",
    valor_total: "0",
    obs: "",
    obs_interna: "",
    marcadores: [],
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

export default function VendaFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNovo = !id;
  const regiaoQuery = parseRegiaoVendaRota(searchParams.get("regiao")) ?? "brasil";

  const [form, setForm] = useState<FormState>(() => estadoInicial(regiaoQuery));
  const [numeroExibicao, setNumeroExibicao] = useState<string | null>(null);
  const [loadingInicial, setLoadingInicial] = useState(!isNovo);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const clientes = useAsync(() => clientesService.listarTodos(), []);
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

  useEffect(() => {
    if (!id) {
      setForm(estadoInicial(regiaoQuery));
      setLoadingInicial(false);
      return;
    }
    setLoadingInicial(true);
    vendasService
      .obter(id)
      .then((v) => {
        if (!v) return;
        setNumeroExibicao(v.numero);
        setForm({
          numero: v.numero ?? "",
          status_venda: v.status_venda,
          regiao_venda: v.regiao_venda,
          id_cliente: v.id_cliente ?? "",
          id_endereco_cliente: v.id_endereco_cliente ?? "",
          nome_cliente: v.nome_cliente ?? "",
          data_pedido: v.data_pedido ? v.data_pedido.slice(0, 10) : "",
          data_prevista: v.data_prevista ?? "",
          data_envio: v.data_envio ?? "",
          data_entrega: v.data_entrega ?? "",
          forma_pagamento: v.forma_pagamento ?? "",
          meio_pagamento: v.meio_pagamento ?? "",
          codigo_rastreamento: v.codigo_rastreamento ?? "",
          url_rastreamento: v.url_rastreamento ?? "",
          valor_frete: String(v.valor_frete ?? 0),
          valor_desconto: String(v.valor_desconto ?? 0),
          outras_despesas: String(v.outras_despesas ?? 0),
          valor_total: String(v.valor_total ?? 0),
          obs: v.obs ?? "",
          obs_interna: v.obs_interna ?? "",
          marcadores: Array.isArray(v.marcadores) ? (v.marcadores as Marcador[]) : [],
        });
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setLoadingInicial(false));
  }, [id, regiaoQuery]);

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

  const enderecoSelecionado = (enderecosCliente.data ?? []).find(
    (e) => e.id === form.id_endereco_cliente,
  );
  const opcoesEndereco = [
    { value: "", label: "— Selecione o endereço —" },
    ...(enderecosCliente.data ?? []).map((e) => ({
      value: e.id,
      label: formatarEnderecoOpcao(e),
    })),
  ];

  const listaVolta = caminhoListaVendas(form.regiao_venda);
  const moeda = moedaPorRegiao(form.regiao_venda);

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const montarPayloadBase = (): VendaUpdate => ({
    numero: txtOuNulo(form.numero),
    status_venda: form.status_venda,
    regiao_venda: form.regiao_venda,
    id_cliente: form.id_cliente || null,
    id_endereco_cliente: form.id_endereco_cliente || null,
    nome_cliente: txtOuNulo(form.nome_cliente),
    data_pedido: dataOuNulo(form.data_pedido),
    data_prevista: dataOuNulo(form.data_prevista),
    data_envio: dataOuNulo(form.data_envio),
    data_entrega: dataOuNulo(form.data_entrega),
    forma_pagamento: txtOuNulo(form.forma_pagamento),
    meio_pagamento: txtOuNulo(form.meio_pagamento),
    codigo_rastreamento: txtOuNulo(form.codigo_rastreamento),
    url_rastreamento: txtOuNulo(form.url_rastreamento),
    valor_frete: num(form.valor_frete),
    valor_desconto: num(form.valor_desconto),
    outras_despesas: num(form.outras_despesas),
    valor_total: num(form.valor_total),
    total_produtos: num(form.valor_total),
    obs: txtOuNulo(form.obs),
    obs_interna: txtOuNulo(form.obs_interna),
    marcadores: (form.marcadores.length > 0
      ? form.marcadores
      : null) as VendaUpdate["marcadores"],
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const payload = montarPayloadBase();
      if (id) {
        await vendasService.atualizar(id, payload);
        navigate(`/vendas/${id}`);
      } else {
        const criada = await vendasService.criar(payload as VendaInsert);
        navigate(`/vendas/${criada.id}`);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const titulo = isNovo
    ? `Nova ordem · ${traduzirEnum(form.regiao_venda)}`
    : numeroExibicao
      ? `Editar pedido ${numeroExibicao}`
      : "Editar ordem de venda";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title={titulo}
        breadcrumbs={[
          { label: "Comercial" },
          { label: "Ordens de venda", to: "/vendas" },
          { label: traduzirEnum(form.regiao_venda), to: listaVolta },
          { label: isNovo ? "Nova" : "Editar" },
        ]}
        backTo={id ? `/vendas/${id}` : listaVolta}
      />

      {loadingInicial ? (
        <SectionCard>
          <div className="text-sm text-ink-soft">Carregando…</div>
        </SectionCard>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <SectionCard
            title="Identificação"
            description={
              isNovo
                ? `Pedido manual em ${traduzirEnum(form.regiao_venda)} (${moeda}).`
                : undefined
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormInput
                label="Número do pedido"
                value={form.numero}
                onChange={(e) => upd("numero", e.target.value)}
                placeholder="Ex.: 1897"
              />
              <FormDate
                label="Data do pedido"
                value={form.data_pedido}
                onChange={(e) => upd("data_pedido", e.target.value)}
                required={isNovo}
              />
              <FieldWrapper id="regiao-venda" label="Região da venda">
                <StatusSelectDropdown
                  value={form.regiao_venda}
                  options={regiaoVendaOpcoes}
                  onChange={(v) => upd("regiao_venda", v as TipoRegiao)}
                />
              </FieldWrapper>
            </div>
          </SectionCard>

          <SectionCard title="Status e cliente">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldWrapper id="status-venda" label="Status">
                <StatusSelectDropdown
                  value={form.status_venda}
                  options={statusOpcoes}
                  onChange={(v) => upd("status_venda", v as StatusVenda)}
                />
              </FieldWrapper>
              <FieldWrapper id="cliente-venda" label="Cliente vinculado">
                <SearchableSelectDropdown
                  value={form.id_cliente}
                  options={opcoesCliente}
                  loading={clientes.loading}
                  searchPlaceholder="Buscar cliente…"
                  emptyLabel="— Sem cliente vinculado —"
                  onChange={(v) => {
                    const cliente = (clientes.data ?? []).find((c) => c.id === v);
                    setForm((s) => ({
                      ...s,
                      id_cliente: v,
                      nome_cliente: cliente?.nome ?? s.nome_cliente,
                    }));
                  }}
                />
              </FieldWrapper>
              <FormInput
                label="Nome do cliente (pedido)"
                value={form.nome_cliente}
                onChange={(e) => upd("nome_cliente", e.target.value)}
                wrapperClassName="sm:col-span-2"
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Endereço de entrega"
            description="Endereço do cliente usado neste pedido."
          >
            {!form.id_cliente ? (
              <p className="text-sm text-ink-soft">
                Selecione um cliente para escolher o endereço de entrega.
              </p>
            ) : enderecosCliente.loading ? (
              <p className="text-sm text-ink-soft">Carregando endereços…</p>
            ) : (enderecosCliente.data ?? []).length === 0 ? (
              <p className="text-sm text-ink-soft">
                Este cliente não tem endereços cadastrados.{" "}
                <Link
                  to={`/clientes/${form.id_cliente}/editar`}
                  className="text-brand-600 hover:text-brand-700"
                >
                  Cadastrar endereço
                </Link>
              </p>
            ) : (
              <div className="space-y-4">
                <FieldWrapper id="endereco-entrega" label="Endereço">
                  <SearchableSelectDropdown
                    value={form.id_endereco_cliente}
                    options={opcoesEndereco}
                    loading={enderecosCliente.loading}
                    searchPlaceholder="Buscar endereço…"
                    emptyLabel="— Selecione o endereço —"
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
                      <p className="mt-1 text-ink">{formatarEnderecoLinha(enderecoSelecionado)}</p>
                    ) : null}
                    {enderecoSelecionado.bairro ? (
                      <p className="text-ink-soft">{enderecoSelecionado.bairro}</p>
                    ) : null}
                    {formatarLocalidade(enderecoSelecionado) ? (
                      <p className="text-ink-soft">{formatarLocalidade(enderecoSelecionado)}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-faint">
                      {enderecoSelecionado.cep ? <span>CEP {enderecoSelecionado.cep}</span> : null}
                      {enderecoSelecionado.pais ? <span>{enderecoSelecionado.pais}</span> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Marcadores" description="Tags para organizar e filtrar o pedido.">
            <MarcadoresEditor
              value={form.marcadores}
              onChange={(v) => upd("marcadores", v)}
            />
          </SectionCard>

          <SectionCard title="Datas e envio">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormDate
                label="Data prevista"
                value={form.data_prevista}
                onChange={(e) => upd("data_prevista", e.target.value)}
              />
              <FormDate
                label="Data de envio"
                value={form.data_envio}
                onChange={(e) => upd("data_envio", e.target.value)}
              />
              <FormDate
                label="Data de entrega"
                value={form.data_entrega}
                onChange={(e) => upd("data_entrega", e.target.value)}
              />
              <FormInput
                label="Código de rastreamento"
                value={form.codigo_rastreamento}
                onChange={(e) => upd("codigo_rastreamento", e.target.value)}
              />
              <FormInput
                label="URL de rastreamento"
                value={form.url_rastreamento}
                onChange={(e) => upd("url_rastreamento", e.target.value)}
                wrapperClassName="sm:col-span-2"
              />
            </div>
          </SectionCard>

          <SectionCard title="Pagamento">
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
              <FieldWrapper id="meio-pagamento" label="Meio de pagamento">
                <SearchableSelectDropdown
                  value={form.meio_pagamento}
                  options={opcoesComValorAtual(
                    meioPagamentoOpcoes,
                    form.meio_pagamento,
                    "— Não informado —",
                  )}
                  searchPlaceholder="Buscar meio…"
                  emptyLabel="— Não informado —"
                  onChange={(v) => upd("meio_pagamento", v)}
                />
              </FieldWrapper>
            </div>
          </SectionCard>

          <SectionCard title="Valores" description={`Valores em ${moeda}.`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <FormInput
                label="Frete"
                value={form.valor_frete}
                onChange={(e) => upd("valor_frete", e.target.value)}
                inputMode="decimal"
              />
              <FormInput
                label="Desconto"
                value={form.valor_desconto}
                onChange={(e) => upd("valor_desconto", e.target.value)}
                inputMode="decimal"
              />
              <FormInput
                label="Outras despesas"
                value={form.outras_despesas}
                onChange={(e) => upd("outras_despesas", e.target.value)}
                inputMode="decimal"
              />
              <FormInput
                label="Total do pedido"
                value={form.valor_total}
                onChange={(e) => upd("valor_total", e.target.value)}
                inputMode="decimal"
              />
            </div>
          </SectionCard>

          <SectionCard title="Observações">
            <div className="grid grid-cols-1 gap-4">
              <FormTextarea
                label="Observação"
                rows={3}
                value={form.obs}
                onChange={(e) => upd("obs", e.target.value)}
              />
              <FormTextarea
                label="Observação interna"
                rows={3}
                value={form.obs_interna}
                onChange={(e) => upd("obs_interna", e.target.value)}
              />
            </div>
          </SectionCard>

          {erro ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <SecondaryButton
              type="button"
              onClick={() => navigate(id ? `/vendas/${id}` : listaVolta)}
            >
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="submit" loading={salvando}>
              {isNovo ? "Criar ordem" : "Salvar alterações"}
            </PrimaryButton>
          </div>
        </form>
      )}
    </div>
  );
}
