import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  EnderecosClienteEditor,
  enderecoDeRegistro,
  enderecoVazio,
} from "../../components/clientes/EnderecosClienteEditor";
import { FieldWrapper, FormInput, FormTextarea } from "../../components/FormField";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { SearchableSelectDropdown } from "../../components/SearchableSelectDropdown";
import { clientesService } from "../../services/clientes";
import {
  enderecosClienteService,
  type EnderecoClienteForm,
} from "../../services/enderecos-cliente";
import { limparParaBanco } from "../../utils/format";
import {
  formatarCnpj,
  formatarCpf,
  formatarDocumento,
  inferirTipoPessoa,
  labelNome,
} from "../../utils/documento";
import type { ClienteInsert, TipoPessoa } from "../../types/entities";
import { opcoesComValorAtual, tipoPessoaOpcoes } from "./clienteOpcoes";

type FormState = {
  nome: string;
  fantasia: string;
  tipo_pessoa: "" | TipoPessoa;
  cpf_cnpj: string;
  inscricao_estadual: string;
  rg: string;
  email: string;
  telefone: string;
  instagram: string;
  pais: string;
  observacoes: string;
};

const vazio: FormState = {
  nome: "",
  fantasia: "",
  tipo_pessoa: "",
  cpf_cnpj: "",
  inscricao_estadual: "",
  rg: "",
  email: "",
  telefone: "",
  instagram: "",
  pais: "Brasil",
  observacoes: "",
};

export default function ClienteFormPage() {
  const { id } = useParams<{ id: string }>();
  const edicao = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(vazio);
  const [enderecos, setEnderecos] = useState<EnderecoClienteForm[]>([enderecoVazio(true)]);
  const [loadingInicial, setLoadingInicial] = useState(edicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoadingInicial(true);
    Promise.all([clientesService.obter(id), enderecosClienteService.listarPorCliente(id)])
      .then(([c, listaEnderecos]) => {
        if (!c) return;
        const tipo = (c.tipo_pessoa as FormState["tipo_pessoa"]) || inferirTipoPessoa(c.cpf_cnpj);
        setForm({
          nome: c.nome ?? "",
          fantasia: c.fantasia ?? "",
          tipo_pessoa: tipo,
          cpf_cnpj: formatarDocumento(c.cpf_cnpj ?? "", tipo),
          inscricao_estadual: c.inscricao_estadual ?? "",
          rg: c.rg ?? "",
          email: c.email ?? "",
          telefone: c.telefone ?? "",
          instagram: c.instagram ?? "",
          pais: c.pais ?? "Brasil",
          observacoes: c.observacoes ?? "",
        });
        setEnderecos(
          listaEnderecos.length > 0
            ? listaEnderecos.map(enderecoDeRegistro)
            : [enderecoVazio(true)],
        );
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setLoadingInicial(false));
  }, [id]);

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const handleTipoChange = (tipo: FormState["tipo_pessoa"]) => {
    setForm((s) => ({
      ...s,
      tipo_pessoa: tipo,
      cpf_cnpj:
        tipo === "fisica"
          ? formatarCpf(s.cpf_cnpj)
          : tipo === "juridica"
            ? formatarCnpj(s.cpf_cnpj)
            : s.cpf_cnpj,
      fantasia: tipo === "fisica" ? "" : s.fantasia,
      inscricao_estadual: tipo === "fisica" ? "" : s.inscricao_estadual,
      rg: tipo === "juridica" ? "" : s.rg,
    }));
  };

  const ehFisica = form.tipo_pessoa === "fisica";
  const ehJuridica = form.tipo_pessoa === "juridica";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const payload = limparParaBanco({
        ...form,
        tipo_pessoa: form.tipo_pessoa === "" ? null : form.tipo_pessoa,
        fantasia: ehFisica ? null : form.fantasia,
        inscricao_estadual: ehFisica ? null : form.inscricao_estadual,
        rg: ehJuridica ? null : form.rg,
      }) as unknown as ClienteInsert;

      if (id) {
        await clientesService.atualizar(id, payload);
        await enderecosClienteService.salvarTodos(id, enderecos);
        navigate(`/clientes/${id}`);
        return;
      }

      const c = await clientesService.criar(payload);
      await enderecosClienteService.salvarTodos(c.id, enderecos);
      navigate(`/clientes/${c.id}`, { replace: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title={edicao ? "Editar cliente" : "Novo cliente"}
        breadcrumbs={[
          { label: "Comercial" },
          { label: "Clientes", to: "/clientes" },
          { label: edicao ? "Editar" : "Novo" },
        ]}
        backTo={id ? `/clientes/${id}` : "/clientes"}
      />

      {loadingInicial ? (
        <SectionCard><div className="text-sm text-ink-soft">Carregando…</div></SectionCard>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <SectionCard title="Identificação">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FieldWrapper id="tipo-pessoa" label="Tipo de pessoa" className="sm:col-span-2">
                  <SearchableSelectDropdown
                    value={form.tipo_pessoa}
                    options={opcoesComValorAtual(tipoPessoaOpcoes, form.tipo_pessoa, "— Selecione —")}
                    emptyLabel="— Selecione —"
                    onChange={(v) => handleTipoChange(v as FormState["tipo_pessoa"])}
                  />
                </FieldWrapper>

                {!form.tipo_pessoa ? (
                  <p className="sm:col-span-2 text-sm text-ink-soft">
                    Selecione o tipo de pessoa para exibir os campos de identificação.
                  </p>
                ) : null}

                {ehFisica ? (
                  <>
                    <FormInput
                      label={labelNome("fisica")}
                      required
                      value={form.nome}
                      onChange={(e) => upd("nome", e.target.value)}
                      wrapperClassName="sm:col-span-2"
                    />
                    <FormInput
                      label="CPF"
                      value={form.cpf_cnpj}
                      onChange={(e) => upd("cpf_cnpj", formatarCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                      maxLength={14}
                    />
                    <FormInput
                      label="RG"
                      value={form.rg}
                      onChange={(e) => upd("rg", e.target.value)}
                    />
                  </>
                ) : null}

                {ehJuridica ? (
                  <>
                    <FormInput
                      label={labelNome("juridica")}
                      required
                      value={form.nome}
                      onChange={(e) => upd("nome", e.target.value)}
                      wrapperClassName="sm:col-span-2"
                    />
                    <FormInput
                      label="Nome fantasia"
                      value={form.fantasia}
                      onChange={(e) => upd("fantasia", e.target.value)}
                    />
                    <FormInput
                      label="CNPJ"
                      value={form.cpf_cnpj}
                      onChange={(e) => upd("cpf_cnpj", formatarCnpj(e.target.value))}
                      placeholder="00.000.000/0000-00"
                      inputMode="numeric"
                      maxLength={18}
                    />
                    <FormInput
                      label="Inscrição estadual"
                      value={form.inscricao_estadual}
                      onChange={(e) => upd("inscricao_estadual", e.target.value)}
                      wrapperClassName="sm:col-span-2"
                    />
                  </>
                ) : null}
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
                  label="Telefone"
                  value={form.telefone}
                  onChange={(e) => upd("telefone", e.target.value)}
                  placeholder="(00) 00000-0000"
                />
                <FormInput
                  label="Instagram"
                  value={form.instagram}
                  onChange={(e) => upd("instagram", e.target.value)}
                  placeholder="@usuario"
                />
                <FormInput
                  label="País (cadastro)"
                  value={form.pais}
                  onChange={(e) => upd("pais", e.target.value)}
                />
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Endereços"
            description="Cadastre um ou mais endereços. Marque um como principal para exibição na listagem."
          >
            <EnderecosClienteEditor enderecos={enderecos} onChange={setEnderecos} />
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
            <SecondaryButton type="button" onClick={() => navigate(id ? `/clientes/${id}` : "/clientes")}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="submit" loading={salvando}>
              {edicao ? "Salvar alterações" : "Criar cliente"}
            </PrimaryButton>
          </div>
        </form>
      )}
    </div>
  );
}
