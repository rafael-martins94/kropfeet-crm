import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormInput, FormSelect, FormTextarea } from "../../components/FormField";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { vendasService } from "../../services/vendas";
import { clientesService } from "../../services/clientes";
import { useAsync } from "../../hooks/useAsync";
import { limparParaBanco } from "../../utils/format";
import type { CanalVenda, StatusVenda, VendaInsert } from "../../types/entities";

type FormState = {
  id_cliente: string;
  data_venda: string;
  moeda_venda: string;
  status_venda: StatusVenda;
  canal_venda: CanalVenda | "";
  valor_subtotal: string;
  valor_desconto: string;
  valor_total: string;
  cambio_venda_para_real: string;
  cambio_venda_para_euro: string;
  provedor_link_pagamento: string;
  url_link_pagamento: string;
  observacoes: string;
};

function numOuNulo(s: string): number | null {
  if (!s || s.trim() === "") return null;
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

function num(s: string, padrao = 0): number {
  if (!s || s.trim() === "") return padrao;
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) ? v : padrao;
}

function agoraISODate(): string {
  return new Date().toISOString().slice(0, 16);
}

export default function VendaFormPage() {
  const { id } = useParams<{ id: string }>();
  const edicao = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    id_cliente: "",
    data_venda: agoraISODate(),
    moeda_venda: "BRL",
    status_venda: "pendente",
    canal_venda: "",
    valor_subtotal: "0",
    valor_desconto: "0",
    valor_total: "0",
    cambio_venda_para_real: "",
    cambio_venda_para_euro: "",
    provedor_link_pagamento: "",
    url_link_pagamento: "",
    observacoes: "",
  });
  const [loadingInicial, setLoadingInicial] = useState(edicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const clientes = useAsync(() => clientesService.listarTodos(), []);

  useEffect(() => {
    if (!id) return;
    setLoadingInicial(true);
    vendasService
      .obter(id)
      .then((v) => {
        if (!v) return;
        setForm({
          id_cliente: v.id_cliente ?? "",
          data_venda: v.data_venda?.slice(0, 16) ?? "",
          moeda_venda: v.moeda_venda ?? "BRL",
          status_venda: v.status_venda,
          canal_venda: v.canal_venda ?? "",
          valor_subtotal: String(v.valor_subtotal ?? 0),
          valor_desconto: String(v.valor_desconto ?? 0),
          valor_total: String(v.valor_total ?? 0),
          cambio_venda_para_real: v.cambio_venda_para_real?.toString() ?? "",
          cambio_venda_para_euro: v.cambio_venda_para_euro?.toString() ?? "",
          provedor_link_pagamento: v.provedor_link_pagamento ?? "",
          url_link_pagamento: v.url_link_pagamento ?? "",
          observacoes: v.observacoes ?? "",
        });
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setLoadingInicial(false));
  }, [id]);

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const base = limparParaBanco({
        id_cliente: form.id_cliente || null,
        moeda_venda: form.moeda_venda.toUpperCase(),
        status_venda: form.status_venda,
        canal_venda: form.canal_venda === "" ? null : form.canal_venda,
        provedor_link_pagamento: form.provedor_link_pagamento,
        url_link_pagamento: form.url_link_pagamento,
        observacoes: form.observacoes,
      });
      const payload = {
        ...base,
        data_venda: form.data_venda ? new Date(form.data_venda).toISOString() : new Date().toISOString(),
        valor_subtotal: num(form.valor_subtotal),
        valor_desconto: num(form.valor_desconto),
        valor_total: num(form.valor_total),
        cambio_venda_para_real: numOuNulo(form.cambio_venda_para_real),
        cambio_venda_para_euro: numOuNulo(form.cambio_venda_para_euro),
      } as unknown as VendaInsert;

      if (id) {
        await vendasService.atualizar(id, payload);
      } else {
        const v = await vendasService.criar(payload);
        navigate(`/vendas/${v.id}`, { replace: true });
        return;
      }
      navigate("/vendas");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title={edicao ? "Editar venda" : "Nova venda"}
        breadcrumbs={[
          { label: "Comercial" },
          { label: "Vendas", to: "/vendas" },
          { label: edicao ? "Editar" : "Nova" },
        ]}
        backTo="/vendas"
      />

      {loadingInicial ? (
        <SectionCard><div className="text-sm text-ink-soft">Carregando…</div></SectionCard>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <SectionCard title="Dados da venda">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormSelect
                label="Cliente"
                value={form.id_cliente}
                onChange={(e) => upd("id_cliente", e.target.value)}
                placeholder="— Sem cliente vinculado —"
                options={(clientes.data ?? []).map((c) => ({ value: c.id, label: c.nome }))}
                wrapperClassName="sm:col-span-2"
              />
              <FormInput
                label="Data da venda"
                type="datetime-local"
                value={form.data_venda}
                onChange={(e) => upd("data_venda", e.target.value)}
              />
              <FormInput
                label="Moeda"
                value={form.moeda_venda}
                onChange={(e) => upd("moeda_venda", e.target.value.toUpperCase())}
                maxLength={3}
              />
              <FormSelect
                label="Status"
                value={form.status_venda}
                onChange={(e) => upd("status_venda", e.target.value as StatusVenda)}
                options={[
                  { value: "pendente", label: "Pendente" },
                  { value: "paga", label: "Paga" },
                  { value: "cancelada", label: "Cancelada" },
                  { value: "devolvida", label: "Devolvida" },
                ]}
              />
              <FormSelect
                label="Canal de venda"
                value={form.canal_venda}
                onChange={(e) => upd("canal_venda", e.target.value as CanalVenda | "")}
                placeholder="— Não informado —"
                options={[
                  { value: "instagram", label: "Instagram" },
                  { value: "whatsapp", label: "WhatsApp" },
                  { value: "site", label: "Site" },
                  { value: "loja_fisica", label: "Loja física" },
                  { value: "marketplace", label: "Marketplace" },
                  { value: "outro", label: "Outro" },
                ]}
              />
            </div>
          </SectionCard>

          <SectionCard title="Valores">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormInput
                label="Subtotal"
                value={form.valor_subtotal}
                onChange={(e) => upd("valor_subtotal", e.target.value)}
                inputMode="decimal"
              />
              <FormInput
                label="Desconto"
                value={form.valor_desconto}
                onChange={(e) => upd("valor_desconto", e.target.value)}
                inputMode="decimal"
              />
              <FormInput
                label="Total"
                value={form.valor_total}
                onChange={(e) => upd("valor_total", e.target.value)}
                inputMode="decimal"
              />
              <FormInput
                label="Câmbio → BRL"
                value={form.cambio_venda_para_real}
                onChange={(e) => upd("cambio_venda_para_real", e.target.value)}
                inputMode="decimal"
              />
              <FormInput
                label="Câmbio → EUR"
                value={form.cambio_venda_para_euro}
                onChange={(e) => upd("cambio_venda_para_euro", e.target.value)}
                inputMode="decimal"
              />
            </div>
          </SectionCard>

          <SectionCard title="Pagamento">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormInput
                label="Provedor do link"
                value={form.provedor_link_pagamento}
                onChange={(e) => upd("provedor_link_pagamento", e.target.value)}
                placeholder="Mercado Pago, Stripe, Pix…"
              />
              <FormInput
                label="URL do link de pagamento"
                value={form.url_link_pagamento}
                onChange={(e) => upd("url_link_pagamento", e.target.value)}
              />
            </div>
          </SectionCard>

          <SectionCard title="Observações">
            <FormTextarea
              label="Notas da venda"
              rows={4}
              value={form.observacoes}
              onChange={(e) => upd("observacoes", e.target.value)}
            />
          </SectionCard>

          {erro ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <SecondaryButton type="button" onClick={() => navigate("/vendas")}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="submit" loading={salvando}>
              {edicao ? "Salvar alterações" : "Criar venda"}
            </PrimaryButton>
          </div>
        </form>
      )}
    </div>
  );
}
