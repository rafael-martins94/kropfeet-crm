import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormCheckbox, FormInput, FormSelect, FormTextarea } from "../../components/FormField";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { marcasService } from "../../services/marcas";
import { categoriasService } from "../../services/categorias";
import { modelosProdutoService } from "../../services/modelos-produto";
import { useAsync } from "../../hooks/useAsync";
import { mensagemErroSalvarModeloProduto } from "../../utils/errors";
import { limparParaBanco } from "../../utils/format";
import type { ModeloProdutoInsert, OrigemCadastro } from "../../types/entities";

type FormState = {
  nome_modelo: string;
  slug: string;
  id_marca: string;
  id_categoria: string;
  codigo_referencia: string;
  codigo_fabricante: string;
  cor: string;
  genero: string;
  descricao: string;
  origem_cadastro: OrigemCadastro;
  ativo: boolean;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function ModeloFormPage() {
  const { id } = useParams<{ id: string }>();
  const edicao = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    nome_modelo: "",
    slug: "",
    id_marca: "",
    id_categoria: "",
    codigo_referencia: "",
    codigo_fabricante: "",
    cor: "",
    genero: "",
    descricao: "",
    origem_cadastro: "manual",
    ativo: true,
  });
  const [loadingInicial, setLoadingInicial] = useState(edicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [slugEditadoManualmente, setSlugEditadoManualmente] = useState(edicao);

  const marcas = useAsync(() => marcasService.listarTodas(), []);
  const categorias = useAsync(() => categoriasService.listarTodas(), []);

  useEffect(() => {
    if (!id) return;
    setLoadingInicial(true);
    modelosProdutoService
      .obter(id)
      .then((m) => {
        if (!m) return;
        setForm({
          nome_modelo: m.nome_modelo,
          slug: m.slug,
          id_marca: m.id_marca ?? "",
          id_categoria: m.id_categoria ?? "",
          codigo_referencia: m.codigo_referencia ?? "",
          codigo_fabricante: m.codigo_fabricante ?? "",
          cor: m.cor ?? "",
          genero: m.genero ?? "",
          descricao: m.descricao ?? "",
          origem_cadastro: m.origem_cadastro,
          ativo: m.ativo,
        });
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setLoadingInicial(false));
  }, [id]);

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const handleNomeChange = (v: string) => {
    upd("nome_modelo", v);
    if (!slugEditadoManualmente) {
      upd("slug", slugify(v));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.id_marca.trim()) {
      setErro("Selecione a marca do modelo.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const payload = limparParaBanco({
        ...form,
        id_marca: form.id_marca,
        id_categoria: form.id_categoria || null,
      }) as unknown as ModeloProdutoInsert;

      if (id) {
        await modelosProdutoService.atualizar(id, payload);
      } else {
        const m = await modelosProdutoService.criar(payload);
        navigate(`/modelos-produto/${m.id}`, { replace: true });
        return;
      }
      navigate("/modelos-produto");
    } catch (e) {
      setErro(mensagemErroSalvarModeloProduto(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title={edicao ? "Editar modelo" : "Novo modelo de produto"}
        breadcrumbs={[
          { label: "Catálogo" },
          { label: "Modelos", to: "/modelos-produto" },
          { label: edicao ? "Editar" : "Novo" },
        ]}
        backTo="/modelos-produto"
      />

      {loadingInicial ? (
        <SectionCard><div className="text-sm text-ink-soft">Carregando…</div></SectionCard>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <SectionCard title="Identificação">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormInput
                label="Nome do modelo"
                required
                value={form.nome_modelo}
                onChange={(e) => handleNomeChange(e.target.value)}
                wrapperClassName="sm:col-span-2"
              />
              <FormInput
                label="Slug"
                required
                value={form.slug}
                onChange={(e) => {
                  setSlugEditadoManualmente(true);
                  upd("slug", slugify(e.target.value));
                }}
                hint="Identificador único e URL-friendly."
                wrapperClassName="sm:col-span-2"
              />
              <FormSelect
                label="Marca"
                required
                value={form.id_marca}
                onChange={(e) => upd("id_marca", e.target.value)}
                placeholder="— Selecione —"
                options={(marcas.data ?? []).map((m) => ({
                  value: m.id,
                  label: m.nome,
                }))}
              />
              <FormSelect
                label="Categoria"
                value={form.id_categoria}
                onChange={(e) => upd("id_categoria", e.target.value)}
                placeholder="— Selecione —"
                options={(categorias.data ?? []).map((c) => ({
                  value: c.id,
                  label: c.nome,
                }))}
              />
              <FormInput
                label="Código de referência"
                value={form.codigo_referencia}
                onChange={(e) => upd("codigo_referencia", e.target.value)}
              />
              <FormInput
                label="Código do fabricante"
                value={form.codigo_fabricante}
                onChange={(e) => upd("codigo_fabricante", e.target.value)}
              />
              <FormInput
                label="Cor"
                value={form.cor}
                onChange={(e) => upd("cor", e.target.value)}
              />
              <FormInput
                label="Gênero"
                value={form.genero}
                onChange={(e) => upd("genero", e.target.value)}
                placeholder="Masculino / Feminino / Unissex"
              />
              <FormSelect
                label="Origem do cadastro"
                value={form.origem_cadastro}
                onChange={(e) => upd("origem_cadastro", e.target.value as OrigemCadastro)}
                options={[
                  { value: "manual", label: "Manual" },
                  { value: "tiny", label: "Tiny" },
                  { value: "importacao_planilha", label: "Importação de planilha" },
                  { value: "api", label: "API" },
                ]}
              />
              <div className="flex items-end pb-1">
                <FormCheckbox
                  label="Modelo ativo"
                  checked={form.ativo}
                  onChange={(e) => upd("ativo", e.target.checked)}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Descrição">
            <FormTextarea
              label="Descrição completa"
              rows={6}
              value={form.descricao}
              onChange={(e) => upd("descricao", e.target.value)}
              placeholder="Tecnologias, materiais, história do modelo…"
            />
          </SectionCard>

          {erro ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <SecondaryButton type="button" onClick={() => navigate("/modelos-produto")}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="submit" loading={salvando}>
              {edicao ? "Salvar alterações" : "Criar modelo"}
            </PrimaryButton>
          </div>
        </form>
      )}
    </div>
  );
}
