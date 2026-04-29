import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormInput, FormSelect, FormTextarea } from "../../components/FormField";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { fornecedoresService } from "../../services/fornecedores";
import { limparParaBanco } from "../../utils/format";
import type { FornecedorInsert } from "../../types/entities";

type FormState = {
  nome: string;
  fantasia: string;
  tipo_pessoa: "" | "fisica" | "juridica";
  cpf_cnpj: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  rg: string;
  tipo_negocio: string;
  situacao: "ativo" | "inativo";
  codigo_fornecedor: string;
  email: string;
  email_nfe: string;
  site: string;
  telefone: string;
  celular: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  cidade: string;
  uf: string;
  pais: string;
  observacoes: string;
};

const vazio: FormState = {
  nome: "",
  fantasia: "",
  tipo_pessoa: "",
  cpf_cnpj: "",
  inscricao_estadual: "",
  inscricao_municipal: "",
  rg: "",
  tipo_negocio: "",
  situacao: "ativo",
  codigo_fornecedor: "",
  email: "",
  email_nfe: "",
  site: "",
  telefone: "",
  celular: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cep: "",
  cidade: "",
  uf: "",
  pais: "",
  observacoes: "",
};

export default function FornecedorFormPage() {
  const { id } = useParams<{ id: string }>();
  const edicao = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(vazio);
  const [loadingInicial, setLoadingInicial] = useState(edicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoadingInicial(true);
    fornecedoresService
      .obter(id)
      .then((f) => {
        if (!f) return;
        setForm({
          nome: f.nome ?? "",
          fantasia: f.fantasia ?? "",
          tipo_pessoa: (f.tipo_pessoa as FormState["tipo_pessoa"]) ?? "",
          cpf_cnpj: f.cpf_cnpj ?? "",
          inscricao_estadual: f.inscricao_estadual ?? "",
          inscricao_municipal: f.inscricao_municipal ?? "",
          rg: f.rg ?? "",
          tipo_negocio: f.tipo_negocio ?? "",
          situacao: f.situacao ?? "ativo",
          codigo_fornecedor: f.codigo_fornecedor ?? "",
          email: f.email ?? "",
          email_nfe: f.email_nfe ?? "",
          site: f.site ?? "",
          telefone: f.telefone ?? "",
          celular: f.celular ?? "",
          endereco: f.endereco ?? "",
          numero: f.numero ?? "",
          complemento: f.complemento ?? "",
          bairro: f.bairro ?? "",
          cep: f.cep ?? "",
          cidade: f.cidade ?? "",
          uf: f.uf ?? "",
          pais: f.pais ?? "",
          observacoes: f.observacoes ?? "",
        });
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setLoadingInicial(false));
  }, [id]);

  const upd = <K extends keyof FormState>(chave: K, valor: FormState[K]) =>
    setForm((s) => ({ ...s, [chave]: valor }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const payload = limparParaBanco({
        ...form,
        tipo_pessoa: form.tipo_pessoa === "" ? null : form.tipo_pessoa,
      }) as unknown as FornecedorInsert;
      if (id) {
        await fornecedoresService.atualizar(id, payload);
      } else {
        const criado = await fornecedoresService.criar(payload);
        navigate(`/fornecedores/${criado.id}`, { replace: true });
        return;
      }
      navigate("/fornecedores");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title={edicao ? "Editar fornecedor" : "Novo fornecedor"}
        breadcrumbs={[
          { label: "Operação" },
          { label: "Fornecedores", to: "/fornecedores" },
          { label: edicao ? "Editar" : "Novo" },
        ]}
        backTo="/fornecedores"
      />

      {loadingInicial ? (
        <SectionCard><div className="text-sm text-ink-soft">Carregando…</div></SectionCard>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <SectionCard title="Identificação">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormInput
                label="Razão social / Nome"
                required
                value={form.nome}
                onChange={(e) => upd("nome", e.target.value)}
              />
              <FormInput
                label="Nome fantasia"
                value={form.fantasia}
                onChange={(e) => upd("fantasia", e.target.value)}
              />
              <FormSelect
                label="Tipo de pessoa"
                value={form.tipo_pessoa}
                onChange={(e) => upd("tipo_pessoa", e.target.value as FormState["tipo_pessoa"])}
                placeholder="—"
                options={[
                  { value: "fisica", label: "Pessoa física" },
                  { value: "juridica", label: "Pessoa jurídica" },
                ]}
              />
              <FormInput
                label="CPF / CNPJ"
                value={form.cpf_cnpj}
                onChange={(e) => upd("cpf_cnpj", e.target.value)}
              />
              <FormInput
                label="Inscrição estadual"
                value={form.inscricao_estadual}
                onChange={(e) => upd("inscricao_estadual", e.target.value)}
              />
              <FormInput
                label="Inscrição municipal"
                value={form.inscricao_municipal}
                onChange={(e) => upd("inscricao_municipal", e.target.value)}
              />
              <FormInput
                label="RG"
                value={form.rg}
                onChange={(e) => upd("rg", e.target.value)}
              />
              <FormInput
                label="Tipo de negócio"
                value={form.tipo_negocio}
                onChange={(e) => upd("tipo_negocio", e.target.value)}
              />
              <FormInput
                label="Código do fornecedor"
                value={form.codigo_fornecedor}
                onChange={(e) => upd("codigo_fornecedor", e.target.value)}
              />
              <FormSelect
                label="Situação"
                value={form.situacao}
                onChange={(e) => upd("situacao", e.target.value as FormState["situacao"])}
                options={[
                  { value: "ativo", label: "Ativo" },
                  { value: "inativo", label: "Inativo" },
                ]}
              />
            </div>
          </SectionCard>

          <SectionCard title="Contato">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormInput
                label="E-mail"
                type="email"
                value={form.email}
                onChange={(e) => upd("email", e.target.value)}
              />
              <FormInput
                label="E-mail NF-e"
                type="email"
                value={form.email_nfe}
                onChange={(e) => upd("email_nfe", e.target.value)}
              />
              <FormInput
                label="Telefone"
                value={form.telefone}
                onChange={(e) => upd("telefone", e.target.value)}
              />
              <FormInput
                label="Celular"
                value={form.celular}
                onChange={(e) => upd("celular", e.target.value)}
              />
              <FormInput
                label="Site"
                value={form.site}
                onChange={(e) => upd("site", e.target.value)}
                wrapperClassName="sm:col-span-2"
              />
            </div>
          </SectionCard>

          <SectionCard title="Endereço">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
              <FormInput
                label="CEP"
                value={form.cep}
                onChange={(e) => upd("cep", e.target.value)}
                wrapperClassName="sm:col-span-2"
              />
              <FormInput
                label="Endereço"
                value={form.endereco}
                onChange={(e) => upd("endereco", e.target.value)}
                wrapperClassName="sm:col-span-3"
              />
              <FormInput
                label="Número"
                value={form.numero}
                onChange={(e) => upd("numero", e.target.value)}
                wrapperClassName="sm:col-span-1"
              />
              <FormInput
                label="Complemento"
                value={form.complemento}
                onChange={(e) => upd("complemento", e.target.value)}
                wrapperClassName="sm:col-span-2"
              />
              <FormInput
                label="Bairro"
                value={form.bairro}
                onChange={(e) => upd("bairro", e.target.value)}
                wrapperClassName="sm:col-span-2"
              />
              <FormInput
                label="Cidade"
                value={form.cidade}
                onChange={(e) => upd("cidade", e.target.value)}
                wrapperClassName="sm:col-span-2"
              />
              <FormInput
                label="UF"
                value={form.uf}
                maxLength={2}
                onChange={(e) => upd("uf", e.target.value.toUpperCase())}
                wrapperClassName="sm:col-span-1"
              />
              <FormInput
                label="País"
                value={form.pais}
                onChange={(e) => upd("pais", e.target.value)}
                wrapperClassName="sm:col-span-2"
              />
            </div>
          </SectionCard>

          <SectionCard title="Observações">
            <FormTextarea
              label="Notas internas"
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
            <SecondaryButton type="button" onClick={() => navigate("/fornecedores")}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="submit" loading={salvando}>
              {edicao ? "Salvar alterações" : "Criar fornecedor"}
            </PrimaryButton>
          </div>
        </form>
      )}
    </div>
  );
}
