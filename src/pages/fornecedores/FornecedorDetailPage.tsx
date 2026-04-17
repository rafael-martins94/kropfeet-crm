import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { DangerButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { IconEdit, IconTrash } from "../../components/Icons";
import { fornecedoresService } from "../../services/fornecedores";
import { useAsync } from "../../hooks/useAsync";
import { formatarDataHora, traduzirEnum } from "../../utils/format";

function F({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
        {label}
      </dt>
      <dd className={`mt-1 text-sm text-ink ${mono ? "font-numeric tabular-nums text-xs break-all" : ""}`}>
        {value ?? <span className="text-ink-faint">—</span>}
      </dd>
    </div>
  );
}

export default function FornecedorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading, error } = useAsync(
    () => (id ? fornecedoresService.obter(id) : Promise.resolve(null)),
    [id],
  );

  const handleDelete = async () => {
    if (!id || !data) return;
    if (!window.confirm(`Excluir fornecedor "${data.nome}"?`)) return;
    try {
      await fornecedoresService.deletar(id);
      navigate("/fornecedores");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  };

  return (
    <div>
      <PageHeader
        title={data?.nome ?? "Fornecedor"}
        description={data?.fantasia ?? undefined}
        breadcrumbs={[
          { label: "Operação" },
          { label: "Fornecedores", to: "/fornecedores" },
          { label: data?.nome ?? "…" },
        ]}
        backTo="/fornecedores"
        actions={
          data ? (
            <>
              <SecondaryButton
                icon={<IconEdit width={16} height={16} />}
                onClick={() => navigate(`/fornecedores/${data.id}/editar`)}
              >
                Editar
              </SecondaryButton>
              <DangerButton
                icon={<IconTrash width={16} height={16} />}
                onClick={handleDelete}
              >
                Excluir
              </DangerButton>
            </>
          ) : null
        }
      />

      {loading ? (
        <SectionCard><div className="text-sm text-ink-soft">Carregando…</div></SectionCard>
      ) : error ? (
        <SectionCard><div className="text-sm text-red-700">Erro: {error.message}</div></SectionCard>
      ) : !data ? (
        <SectionCard><div className="text-sm text-ink-soft">Fornecedor não encontrado.</div></SectionCard>
      ) : (
        <div className="space-y-6">
          <SectionCard
            title="Identificação"
            actions={<StatusBadge value={data.situacao} />}
          >
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <F label="Nome / Razão social" value={data.nome} />
              <F label="Nome fantasia" value={data.fantasia} />
              <F label="Tipo de pessoa" value={traduzirEnum(data.tipo_pessoa)} />
              <F label="CPF / CNPJ" value={data.cpf_cnpj} mono />
              <F label="Inscrição estadual" value={data.inscricao_estadual} mono />
              <F label="Inscrição municipal" value={data.inscricao_municipal} mono />
              <F label="RG" value={data.rg} mono />
              <F label="Tipo de negócio" value={data.tipo_negocio} />
              <F label="Código do fornecedor" value={data.codigo_fornecedor} mono />
            </dl>
          </SectionCard>

          <SectionCard title="Contato">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <F label="E-mail" value={data.email} />
              <F label="E-mail NF-e" value={data.email_nfe} />
              <F label="Telefone" value={data.telefone} />
              <F label="Celular" value={data.celular} />
              <F label="Site" value={data.site} />
            </dl>
          </SectionCard>

          <SectionCard title="Endereço">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <F label="CEP" value={data.cep} mono />
              <F label="Endereço" value={data.endereco} />
              <F label="Número" value={data.numero} />
              <F label="Complemento" value={data.complemento} />
              <F label="Bairro" value={data.bairro} />
              <F label="Cidade" value={data.cidade} />
              <F label="UF" value={data.uf} />
              <F label="País" value={data.pais} />
            </dl>
          </SectionCard>

          <SectionCard title="Integração & auditoria">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <F label="ID Tiny" value={data.id_tiny} mono />
              <F label="Cadastro no Tiny" value={formatarDataHora(data.data_cadastro_tiny)} />
              <F label="Atualização no Tiny" value={formatarDataHora(data.data_atualizacao_tiny)} />
              <F label="Criado em" value={formatarDataHora(data.criado_em)} />
              <F label="Atualizado em" value={formatarDataHora(data.atualizado_em)} />
              <F label="ID interno" value={data.id} mono />
            </dl>
          </SectionCard>

          {data.observacoes ? (
            <SectionCard title="Observações">
              <p className="whitespace-pre-wrap text-sm text-ink">{data.observacoes}</p>
            </SectionCard>
          ) : null}
        </div>
      )}
    </div>
  );
}
