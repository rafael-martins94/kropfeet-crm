import { useEffect, useState, type FormEvent } from "react";
import { FormInput, FormSelect } from "../FormField";
import { Modal } from "../Modal";
import { PrimaryButton, SecondaryButton } from "../PrimaryButton";
import { SearchableSelectDropdown } from "../SearchableSelectDropdown";
import {
  ModeloImagensForm,
  limparImagensPendentes,
  type ImagemPendente,
} from "./ModeloImagensForm";
import { useAsync } from "../../hooks/useAsync";
import { categoriasService } from "../../services/categorias";
import { imagensModeloProdutoService } from "../../services/imagens-modelo-produto";
import { marcasService } from "../../services/marcas";
import { modelosProdutoService } from "../../services/modelos-produto";
import { limparParaBanco } from "../../utils/format";
import { mensagemErroSalvarModeloProduto } from "../../utils/errors";
import type { ModeloProdutoInsert } from "../../types/entities";

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

type ModeloRapidoModalProps = {
  open: boolean;
  onClose: () => void;
  onCriado: (modelo: { id: string; nome_modelo: string }) => void;
  nomeInicial?: string;
};

export function ModeloRapidoModal({
  open,
  onClose,
  onCriado,
  nomeInicial = "",
}: ModeloRapidoModalProps) {
  const marcas = useAsync(() => marcasService.listarTodas(), []);
  const categorias = useAsync(() => categoriasService.listarTodas(), []);
  const [nome, setNome] = useState(nomeInicial);
  const [idMarca, setIdMarca] = useState("");
  const [idCategoria, setIdCategoria] = useState("");
  const [cor, setCor] = useState("");
  const [genero, setGenero] = useState("");
  const [imagensPendentes, setImagensPendentes] = useState<ImagemPendente[]>([]);
  const [indicePrincipal, setIndicePrincipal] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNome(nomeInicial);
    setErro(null);
  }, [open, nomeInicial]);

  const resetForm = () => {
    limparImagensPendentes(imagensPendentes);
    setNome("");
    setIdMarca("");
    setIdCategoria("");
    setCor("");
    setGenero("");
    setImagensPendentes([]);
    setIndicePrincipal(0);
    setErro(null);
  };

  const handleClose = () => {
    limparImagensPendentes(imagensPendentes);
    setImagensPendentes([]);
    setIndicePrincipal(0);
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nomeModelo = nome.trim();
    if (!nomeModelo) {
      setErro("Informe o nome do modelo.");
      return;
    }
    const slug = slugify(nomeModelo);
    if (!slug) {
      setErro("Não foi possível gerar o identificador a partir do nome.");
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const payload = limparParaBanco({
        nome_modelo: nomeModelo,
        slug,
        id_marca: idMarca || null,
        id_categoria: idCategoria || null,
        cor,
        genero,
        ativo: true,
        origem_cadastro: "manual",
      }) as ModeloProdutoInsert;

      const criado = await modelosProdutoService.criar(payload);

      if (imagensPendentes.length > 0) {
        await imagensModeloProdutoService.sincronizarPendentes(
          criado.id,
          imagensPendentes.map((p) => p.file),
          indicePrincipal,
        );
      }

      onCriado({ id: criado.id, nome_modelo: criado.nome_modelo });
      resetForm();
      onClose();
    } catch (err) {
      setErro(mensagemErroSalvarModeloProduto(err));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Novo modelo"
      description="Cadastre o modelo e as fotos. Depois você pode completar detalhes na tela do modelo."
      size="lg"
      footer={
        <>
          <SecondaryButton type="button" onClick={handleClose}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton type="submit" form="modelo-rapido-form" loading={salvando}>
            Criar e selecionar
          </PrimaryButton>
        </>
      }
    >
      <form
        id="modelo-rapido-form"
        onSubmit={handleSubmit}
        className="grid max-h-[70vh] grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2"
      >
        <FormInput
          label="Nome do modelo"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Nike Air Max 90 Branco"
          autoFocus
          wrapperClassName="sm:col-span-2"
        />
        <SearchableSelectDropdown
          label="Marca"
          value={idMarca}
          onChange={setIdMarca}
          options={[
            { value: "", label: "— Sem marca —" },
            ...(marcas.data ?? []).map((m) => ({ value: m.id, label: m.nome })),
          ]}
          loading={marcas.loading}
          emptyLabel="— Sem marca —"
          searchPlaceholder="Buscar marca…"
        />
        <SearchableSelectDropdown
          label="Categoria"
          value={idCategoria}
          onChange={setIdCategoria}
          options={[
            { value: "", label: "— Sem categoria —" },
            ...(categorias.data ?? []).map((c) => ({ value: c.id, label: c.nome })),
          ]}
          loading={categorias.loading}
          emptyLabel="— Sem categoria —"
          searchPlaceholder="Buscar categoria…"
        />
        <FormInput label="Cor" value={cor} onChange={(e) => setCor(e.target.value)} />
        <FormSelect
          label="Gênero"
          value={genero}
          onChange={(e) => setGenero(e.target.value)}
          options={GENEROS}
        />

        <div className="sm:col-span-2 rounded-xl border border-line bg-surface-subtle/40 p-4">
          <ModeloImagensForm
            pendentes={imagensPendentes}
            onPendentesChange={setImagensPendentes}
            indicePrincipalPendente={indicePrincipal}
            onIndicePrincipalPendenteChange={setIndicePrincipal}
          />
        </div>

        {erro ? (
          <div className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
