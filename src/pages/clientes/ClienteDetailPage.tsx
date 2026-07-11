import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { IconEdit, IconPin, IconUser } from "../../components/Icons";
import { clientesService } from "../../services/clientes";
import { enderecosClienteService } from "../../services/enderecos-cliente";
import { useAsync } from "../../hooks/useAsync";
import { formatarDataHora, traduzirEnum } from "../../utils/format";
import {
  formatarDocumento,
  inferirTipoPessoa,
  labelDocumento,
  labelNome,
} from "../../utils/documento";
import { formatarEnderecoLinha, formatarLocalidade } from "../../utils/endereco";

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading } = useAsync(
    () => (id ? clientesService.obter(id) : Promise.resolve(null)),
    [id],
  );
  const enderecos = useAsync(
    () => (id ? enderecosClienteService.listarPorCliente(id) : Promise.resolve([])),
    [id],
  );

  const principal = enderecos.data?.find((e) => e.principal) ?? enderecos.data?.[0];
  const localidade = principal ? formatarLocalidade(principal) : "";
  const tipo = data?.tipo_pessoa ?? inferirTipoPessoa(data?.cpf_cnpj);
  const ehFisica = tipo === "fisica";
  const ehJuridica = tipo === "juridica";
  const documento = data?.cpf_cnpj
    ? formatarDocumento(data.cpf_cnpj, tipo)
    : "—";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title={data?.nome ?? "Cliente"}
        breadcrumbs={[
          { label: "Comercial" },
          { label: "Clientes", to: "/clientes" },
          { label: data?.nome ?? "…" },
        ]}
        backTo="/clientes"
        actions={
          data ? (
            <SecondaryButton icon={<IconEdit width={16} height={16} />} onClick={() => navigate(`/clientes/${data.id}/editar`)}>
              Editar
            </SecondaryButton>
          ) : null
        }
      />

      {loading ? (
        <SectionCard><div className="text-sm text-ink-soft">Carregando…</div></SectionCard>
      ) : !data ? (
        <SectionCard><div className="text-sm text-ink-soft">Cliente não encontrado.</div></SectionCard>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label={labelDocumento(tipo)}
              value={documento}
              icon={<IconUser width={16} height={16} />}
              mono
            />
            <KpiCard
              label="Localidade"
              value={localidade || "—"}
              icon={<IconPin width={16} height={16} />}
            />
            <KpiCard
              label="Contato"
              value={
                data.email ? (
                  <a href={`mailto:${data.email}`} className="text-brand-600 hover:text-brand-700">
                    {data.email}
                  </a>
                ) : data.telefone ? (
                  <a href={`tel:${data.telefone}`} className="text-brand-600 hover:text-brand-700">
                    {data.telefone}
                  </a>
                ) : (
                  "—"
                )
              }
            />
            <KpiCard
              label="Tipo"
              value={
                data.tipo_pessoa ? (
                  <StatusBadge value={data.tipo_pessoa} />
                ) : (
                  "—"
                )
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <SectionCard title="Identificação">
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <F
                  label="Tipo de pessoa"
                  value={tipo ? traduzirEnum(tipo) : "—"}
                />
                <F label={labelNome(tipo)} value={data.nome} />
                {ehJuridica ? <F label="Nome fantasia" value={data.fantasia ?? "—"} /> : null}
                <F label={labelDocumento(tipo)} value={documento} mono />
                {ehJuridica ? (
                  <F label="Inscrição estadual" value={data.inscricao_estadual ?? "—"} />
                ) : null}
                {ehFisica ? <F label="RG" value={data.rg ?? "—"} /> : null}
              </dl>
            </SectionCard>

            <SectionCard title="Contato">
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <F
                  label="E-mail"
                  value={
                    data.email ? (
                      <a href={`mailto:${data.email}`} className="text-brand-600 hover:text-brand-700">
                        {data.email}
                      </a>
                    ) : (
                      "—"
                    )
                  }
                />
                <F
                  label="Telefone"
                  value={
                    data.telefone ? (
                      <a href={`tel:${data.telefone}`} className="text-brand-600 hover:text-brand-700">
                        {data.telefone}
                      </a>
                    ) : (
                      "—"
                    )
                  }
                />
                <F
                  label="Instagram"
                  value={
                    data.instagram ? (
                      <span>@{data.instagram.replace(/^@/, "")}</span>
                    ) : (
                      "—"
                    )
                  }
                />
                <F label="País" value={data.pais ?? "—"} />
              </dl>
            </SectionCard>
          </div>

          <SectionCard title="Endereços">
            {enderecos.loading ? (
              <p className="text-sm text-ink-soft">Carregando endereços…</p>
            ) : (enderecos.data ?? []).length === 0 ? (
              <p className="text-sm text-ink-soft">Nenhum endereço cadastrado.</p>
            ) : (
              <div className="space-y-3">
                {(enderecos.data ?? []).map((endereco, index) => {
                  const linha = formatarEnderecoLinha(endereco);
                  const local = formatarLocalidade(endereco);
                  return (
                    <div
                      key={endereco.id}
                      className="flex gap-3 rounded-xl border border-line bg-surface-subtle/60 p-4"
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                        <IconPin width={18} height={18} />
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-ink">
                            {endereco.rotulo || `Endereço ${index + 1}`}
                          </span>
                          {endereco.principal ? (
                            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                              Principal
                            </span>
                          ) : null}
                        </div>
                        {linha ? <p className="text-sm text-ink">{linha}</p> : null}
                        {endereco.bairro ? (
                          <p className="text-sm text-ink-soft">{endereco.bairro}</p>
                        ) : null}
                        {local ? <p className="text-sm text-ink-soft">{local}</p> : null}
                        <div className="flex flex-wrap gap-3 text-xs text-ink-faint">
                          {endereco.cep ? <span>CEP {endereco.cep}</span> : null}
                          {endereco.pais ? <span>{endereco.pais}</span> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {data.observacoes ? (
            <SectionCard title="Observações">
              <p className="whitespace-pre-wrap text-sm text-ink">{data.observacoes}</p>
            </SectionCard>
          ) : null}

          <SectionCard title="Auditoria">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <F label="Criado em" value={formatarDataHora(data.criado_em)} />
              <F label="Atualizado em" value={formatarDataHora(data.atualizado_em)} />
              <F label="Código Tiny" value={data.codigo_tiny ?? "—"} mono />
            </dl>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="card flex flex-col justify-between gap-1 p-4">
      <div className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
        {icon}
        {label}
      </div>
      <div className={mono ? "font-numeric tabular-nums text-sm font-semibold text-ink break-all" : "text-sm font-semibold text-ink"}>
        {value}
      </div>
    </div>
  );
}

function F({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
        {label}
      </dt>
      <dd className={`mt-1 text-sm text-ink ${mono ? "font-numeric tabular-nums text-xs break-all" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
