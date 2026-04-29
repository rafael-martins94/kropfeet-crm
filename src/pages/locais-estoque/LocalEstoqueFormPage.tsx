import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormCheckbox, FormInput, FormSelect } from "../../components/FormField";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { locaisEstoqueService } from "../../services/locais-estoque";
import { limparParaBanco } from "../../utils/format";
import type { LocalEstoqueInsert, TipoRegiao } from "../../types/entities";

export default function LocalEstoqueFormPage() {
  const { id } = useParams<{ id: string }>();
  const edicao = Boolean(id);
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [pais, setPais] = useState("");
  const [tipoRegiao, setTipoRegiao] = useState<TipoRegiao>("outros");
  const [ativo, setAtivo] = useState(true);
  const [loadingInicial, setLoadingInicial] = useState(edicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoadingInicial(true);
    locaisEstoqueService
      .obter(id)
      .then((l) => {
        if (!l) return;
        setCodigo(l.codigo);
        setNome(l.nome);
        setPais(l.pais ?? "");
        setTipoRegiao(l.tipo_regiao);
        setAtivo(l.ativo);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setLoadingInicial(false));
  }, [id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const payload = limparParaBanco({
        codigo: codigo.trim(),
        nome: nome.trim(),
        pais: pais.trim(),
        tipo_regiao: tipoRegiao,
        ativo,
      }) as unknown as LocalEstoqueInsert;
      if (id) {
        await locaisEstoqueService.atualizar(id, payload);
      } else {
        const criado = await locaisEstoqueService.criar(payload);
        navigate(`/locais-estoque/${criado.id}`, { replace: true });
        return;
      }
      navigate("/locais-estoque");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title={edicao ? "Editar local" : "Novo local de estoque"}
        breadcrumbs={[
          { label: "Operação" },
          { label: "Locais de estoque", to: "/locais-estoque" },
          { label: edicao ? "Editar" : "Novo" },
        ]}
        backTo="/locais-estoque"
      />

      {loadingInicial ? (
        <SectionCard><div className="text-sm text-ink-soft">Carregando…</div></SectionCard>
      ) : (
        <form onSubmit={handleSubmit}>
          <SectionCard>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormInput
                label="Código"
                required
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ex.: BR-SP-01"
              />
              <FormInput
                label="Nome"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
              <FormSelect
                label="Tipo de região"
                value={tipoRegiao}
                onChange={(e) => setTipoRegiao(e.target.value as TipoRegiao)}
                options={[
                  { value: "brasil", label: "Brasil" },
                  { value: "europa", label: "Europa" },
                  { value: "outros", label: "Outros" },
                ]}
              />
              <FormInput
                label="País"
                value={pais}
                onChange={(e) => setPais(e.target.value)}
              />
              <div className="sm:col-span-2 pt-2">
                <FormCheckbox
                  label="Local ativo"
                  description="Marque para permitir movimentações neste local."
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                />
              </div>
            </div>
            {erro ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {erro}
              </div>
            ) : null}
            <div className="mt-6 flex items-center justify-end gap-2 border-t border-line pt-4">
              <SecondaryButton type="button" onClick={() => navigate("/locais-estoque")}>
                Cancelar
              </SecondaryButton>
              <PrimaryButton type="submit" loading={salvando}>
                {edicao ? "Salvar alterações" : "Criar local"}
              </PrimaryButton>
            </div>
          </SectionCard>
        </form>
      )}
    </div>
  );
}
