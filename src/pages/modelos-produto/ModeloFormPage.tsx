import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormInput, FormSelect, FormTextarea } from "../../components/FormField";
import {
  ModeloImagensForm,
  limparImagensPendentes,
  type ImagemPendente,
} from "../../components/modelos-produto/ModeloImagensForm";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { marcasService } from "../../services/marcas";
import { categoriasService } from "../../services/categorias";
import { modelosProdutoService } from "../../services/modelos-produto";
import { imagensModeloProdutoService } from "../../services/imagens-modelo-produto";
import { useAsync } from "../../hooks/useAsync";
import { mensagemErroSalvarModeloProduto } from "../../utils/errors";
import { limparParaBanco } from "../../utils/format";
import type { ModeloProdutoInsert, ModeloProdutoUpdate } from "../../types/entities";

type FormState = {
  nome_modelo: string;
  id_marca: string;
  id_categoria: string;
  codigo_fabricante: string;
  cor: string;
  genero: string;
  descricao: string;
};

const GENEROS = [
  { value: "", label: "Não informado" },
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
  { value: "unissex", label: "Unissex" },
  { value: "infantil", label: "Infantil" },
];

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function sincronizarImagens(
  idModelo: string,
  pendentes: ImagemPendente[],
  indicePrincipal: number,
) {
  const arquivos = pendentes.map((p) => p.file);
  if (arquivos.length === 0) return;

  await imagensModeloProdutoService.sincronizarPendentes(idModelo, arquivos, indicePrincipal);
  limparImagensPendentes(pendentes);
}

export default function ModeloFormPage() {
  const { id } = useParams<{ id: string }>();
  const edicao = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    nome_modelo: "",
    id_marca: "",
    id_categoria: "",
    codigo_fabricante: "",
    cor: "",
    genero: "",
    descricao: "",
  });
  const [imagensPendentes, setImagensPendentes] = useState<ImagemPendente[]>([]);
  const [indicePrincipalPendente, setIndicePrincipalPendente] = useState(0);
  const [loadingInicial, setLoadingInicial] = useState(edicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
          id_marca: m.id_marca ?? "",
          id_categoria: m.id_categoria ?? "",
          codigo_fabricante: m.codigo_fabricante ?? "",
          cor: m.cor ?? "",
          genero: m.genero ?? "",
          descricao: m.descricao ?? "",
        });
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setLoadingInicial(false));
  }, [id]);

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const nome = form.nome_modelo.trim();
    if (!nome) {
      setErro("Informe o nome do modelo.");
      return;
    }

    const slug = slugify(nome);
    if (!slug) {
      setErro("Não foi possível gerar o identificador a partir do nome. Ajuste o nome do modelo.");
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const dadosComuns = limparParaBanco({
        nome_modelo: nome,
        slug,
        id_marca: form.id_marca || null,
        id_categoria: form.id_categoria || null,
        codigo_fabricante: form.codigo_fabricante,
        cor: form.cor,
        genero: form.genero,
        descricao: form.descricao,
        ativo: true,
      });

      if (id) {
        await modelosProdutoService.atualizar(id, dadosComuns as ModeloProdutoUpdate);
        await sincronizarImagens(id, imagensPendentes, indicePrincipalPendente);
        setImagensPendentes([]);
        navigate(`/modelos-produto/${id}`, { replace: true });
        return;
      }

      const criado = await modelosProdutoService.criar({
        ...(dadosComuns as ModeloProdutoInsert),
        origem_cadastro: "manual",
      });
      await sincronizarImagens(criado.id, imagensPendentes, indicePrincipalPendente);
      setImagensPendentes([]);
      navigate(`/modelos-produto/${criado.id}`, { replace: true });
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
        backTo={edicao && id ? `/modelos-produto/${id}` : "/modelos-produto"}
      />

      {loadingInicial ? (
        <SectionCard>
          <div className="text-sm text-ink-soft">Carregando…</div>
        </SectionCard>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="space-y-6 lg:col-span-3">
              <SectionCard title="Identificação">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormInput
                    label="Nome do modelo"
                    required
                    value={form.nome_modelo}
                    onChange={(e) => upd("nome_modelo", e.target.value)}
                    placeholder="Ex.: Nike Air Max 90 Branco"
                    wrapperClassName="sm:col-span-2"
                    autoFocus={!edicao}
                  />
                  <FormSelect
                    label="Marca"
                    value={form.id_marca}
                    onChange={(e) => upd("id_marca", e.target.value)}
                    placeholder="— Sem marca —"
                    options={(marcas.data ?? []).map((m) => ({
                      value: m.id,
                      label: m.nome,
                    }))}
                  />
                  <FormSelect
                    label="Categoria"
                    value={form.id_categoria}
                    onChange={(e) => upd("id_categoria", e.target.value)}
                    placeholder="— Sem categoria —"
                    options={(categorias.data ?? []).map((c) => ({
                      value: c.id,
                      label: c.nome,
                    }))}
                  />
                  <FormInput
                    label="Cor"
                    value={form.cor}
                    onChange={(e) => upd("cor", e.target.value)}
                    placeholder="Ex.: Branco / Preto"
                  />
                  <FormSelect
                    label="Gênero"
                    value={form.genero}
                    onChange={(e) => upd("genero", e.target.value)}
                    options={GENEROS}
                  />
                  <FormInput
                    label="Código do fabricante"
                    value={form.codigo_fabricante}
                    onChange={(e) => upd("codigo_fabricante", e.target.value)}
                    wrapperClassName="sm:col-span-2"
                  />
                  <FormTextarea
                    label="Descrição"
                    rows={5}
                    value={form.descricao}
                    onChange={(e) => upd("descricao", e.target.value)}
                    placeholder="Tecnologias, materiais, observações…"
                    wrapperClassName="sm:col-span-2"
                  />
                </div>
              </SectionCard>
            </div>

            <div className="lg:col-span-2">
              <SectionCard>
                <ModeloImagensForm
                  idModelo={edicao ? id : undefined}
                  pendentes={imagensPendentes}
                  onPendentesChange={setImagensPendentes}
                  indicePrincipalPendente={indicePrincipalPendente}
                  onIndicePrincipalPendenteChange={setIndicePrincipalPendente}
                />
              </SectionCard>
            </div>
          </div>

          {erro ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
            <SecondaryButton
              type="button"
              onClick={() =>
                navigate(edicao && id ? `/modelos-produto/${id}` : "/modelos-produto")
              }
            >
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="submit" loading={salvando}>
              {edicao ? "Salvar alterações" : "Cadastrar modelo"}
            </PrimaryButton>
          </div>
        </form>
      )}
    </div>
  );
}
