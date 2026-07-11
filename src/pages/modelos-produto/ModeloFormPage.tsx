import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormInput, FormTextarea } from "../../components/FormField";
import {
  ModeloImagensForm,
  limparImagensPendentes,
  type ImagemPendente,
} from "../../components/modelos-produto/ModeloImagensForm";
import { NomeRapidoModal } from "../../components/NomeRapidoModal";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SearchableSelectDropdown } from "../../components/SearchableSelectDropdown";
import { SectionCard } from "../../components/SectionCard";
import { marcasService } from "../../services/marcas";
import { categoriasService } from "../../services/categorias";
import { modelosProdutoService } from "../../services/modelos-produto";
import { imagensModeloProdutoService } from "../../services/imagens-modelo-produto";
import { useAsync } from "../../hooks/useAsync";
import { useListReturnTo } from "../../hooks/useListDetailNavigation";
import { mensagemErroSalvarModeloProduto } from "../../utils/errors";
import { limparParaBanco } from "../../utils/format";
import type { ModeloProdutoInsert, ModeloProdutoUpdate } from "../../types/entities";

type FormState = {
  nome_modelo: string;
  id_marca: string;
  id_categoria: string;
  cor: string;
  codigo_fornecedor: string;
  descricao: string;
};

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
  const returnToLista = useListReturnTo("/modelos-produto");
  const detalheState = edicao && id ? { returnTo: returnToLista } : undefined;

  const [form, setForm] = useState<FormState>({
    nome_modelo: "",
    id_marca: "",
    id_categoria: "",
    cor: "",
    codigo_fornecedor: "",
    descricao: "",
  });
  const [imagensPendentes, setImagensPendentes] = useState<ImagemPendente[]>([]);
  const [indicePrincipalPendente, setIndicePrincipalPendente] = useState(0);
  const [loadingInicial, setLoadingInicial] = useState(edicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modalMarca, setModalMarca] = useState(false);
  const [modalCategoria, setModalCategoria] = useState(false);

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
          cor: m.cor ?? "",
          codigo_fornecedor: m.codigo_fornecedor ?? "",
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
      setErro(
        "Não foi possível gerar o identificador a partir do nome. Ajuste o nome do modelo.",
      );
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
        cor: form.cor,
        codigo_fornecedor: form.codigo_fornecedor,
        descricao: form.descricao,
        ativo: true,
      });

      if (id) {
        await modelosProdutoService.atualizar(id, dadosComuns as ModeloProdutoUpdate);
        await sincronizarImagens(id, imagensPendentes, indicePrincipalPendente);
        setImagensPendentes([]);
        navigate(`/modelos-produto/${id}`, { replace: true, state: detalheState });
        return;
      }

      const criado = await modelosProdutoService.criar({
        ...(dadosComuns as ModeloProdutoInsert),
        origem_cadastro: "manual",
      });
      await sincronizarImagens(criado.id, imagensPendentes, indicePrincipalPendente);
      setImagensPendentes([]);
      navigate(`/modelos-produto/${criado.id}`, { replace: true });
    } catch (err) {
      setErro(mensagemErroSalvarModeloProduto(err));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={edicao ? "Editar modelo" : "Novo modelo de produto"}
        breadcrumbs={[
          { label: "Catálogo" },
          { label: "Modelos", to: returnToLista },
          { label: edicao ? "Editar" : "Novo" },
        ]}
        backTo={returnToLista}
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
                  <SearchableSelectDropdown
                    label="Marca"
                    value={form.id_marca}
                    onChange={(v) => upd("id_marca", v)}
                    options={[
                      { value: "", label: "— Sem marca —" },
                      ...(marcas.data ?? []).map((m) => ({
                        value: m.id,
                        label: m.nome,
                      })),
                    ]}
                    loading={marcas.loading}
                    emptyLabel="— Sem marca —"
                    searchPlaceholder="Buscar marca…"
                    createNewLabel="Cadastrar nova marca"
                    onCreateNew={() => setModalMarca(true)}
                  />
                  <SearchableSelectDropdown
                    label="Categoria"
                    value={form.id_categoria}
                    onChange={(v) => upd("id_categoria", v)}
                    options={[
                      { value: "", label: "— Sem categoria —" },
                      ...(categorias.data ?? []).map((c) => ({
                        value: c.id,
                        label: c.nome,
                      })),
                    ]}
                    loading={categorias.loading}
                    emptyLabel="— Sem categoria —"
                    searchPlaceholder="Buscar categoria…"
                    createNewLabel="Cadastrar nova categoria"
                    onCreateNew={() => setModalCategoria(true)}
                  />
                  <FormInput
                    label="Cor"
                    value={form.cor}
                    onChange={(e) => upd("cor", e.target.value)}
                    placeholder="Ex.: Branco / Preto"
                  />
                  <FormInput
                    label="Código do fornecedor"
                    value={form.codigo_fornecedor}
                    onChange={(e) => upd("codigo_fornecedor", e.target.value)}
                    placeholder="Referência no catálogo do fornecedor"
                    className="font-numeric tabular-nums"
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
            <SecondaryButton type="button" onClick={() => navigate(returnToLista)}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="submit" loading={salvando}>
              {edicao ? "Salvar alterações" : "Criar modelo"}
            </PrimaryButton>
          </div>
        </form>
      )}

      <NomeRapidoModal
        open={modalMarca}
        onClose={() => setModalMarca(false)}
        title="Nova marca"
        label="Nome da marca"
        placeholder="Ex.: Nike, Adidas, New Balance…"
        criar={(nome) => marcasService.criar({ nome })}
        onCriado={(marca) => {
          upd("id_marca", marca.id);
          marcas.reload();
        }}
      />
      <NomeRapidoModal
        open={modalCategoria}
        onClose={() => setModalCategoria(false)}
        title="Nova categoria"
        label="Nome da categoria"
        placeholder="Ex.: Lifestyle, Running…"
        criar={(nome) => categoriasService.criar({ nome })}
        onCriado={(categoria) => {
          upd("id_categoria", categoria.id);
          categorias.reload();
        }}
      />
    </div>
  );
}
