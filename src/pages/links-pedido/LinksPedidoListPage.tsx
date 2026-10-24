import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton } from "../../components/PrimaryButton";
import { RowActionsDotsMenu } from "../../components/RowActionsDotsMenu";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SearchInput } from "../../components/SearchInput";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { StatusSelectDropdown, type StatusSelectOption } from "../../components/StatusSelectDropdown";
import { IconCopy, IconEye, IconLink, IconPlus } from "../../components/Icons";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { useToast } from "../../contexts/ToastContext";
import {
  linksPedidoService,
  type LinkPedidoLista,
  type SituacaoFiltroLink,
  type VendaFiltroLink,
} from "../../services/links-pedido";
import { formatarDataHora, formatarMoeda } from "../../utils/format";
import { mensagemDoLink, prazoDaMensagemLink, rotuloSituacaoLink, situacaoLink, urlDoLink } from "../../utils/linkPedido";
import { mensagemErro } from "../../utils/errors";

const situacoes: StatusSelectOption[] = [
  { value: "todos", label: "Todas as situações", tom: "neutro" },
  { value: "ativo", label: "Ativos", tom: "sucesso" },
  { value: "expirado", label: "Expirados", tom: "aviso" },
  { value: "desativado", label: "Desativados", tom: "neutro" },
];

const vendas: StatusSelectOption[] = [
  { value: "todas", label: "Com ou sem venda", tom: "brand" },
  { value: "com", label: "Com venda", tom: "verde_escuro" },
  { value: "sem", label: "Sem venda", tom: "zinco" },
];

export default function LinksPedidoListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [situacao, setSituacao] = useState<SituacaoFiltroLink>("todos");
  const [venda, setVenda] = useState<VendaFiltroLink>("todas");
  const busca = useDebounce(search, 300);

  const lista = useAsync(
    () => linksPedidoService.listar({ page, pageSize: 20, search: busca, situacao, venda }),
    [page, busca, situacao, venda],
  );

  const copiar = async (texto: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.sucesso(ok);
    } catch {
      toast.erro("Não foi possível copiar. Selecione o texto e use Ctrl+C.");
    }
  };

  const reativar = async (row: LinkPedidoLista) => {
    if (!window.confirm(`Reativar o link de @${row.instagram}? O prazo de ${row.validade_horas} h volta a contar quando a pessoa abrir. Sem abertura, expira de novo em 7 dias.`)) return;
    try {
      await linksPedidoService.reativar(row.id);
      toast.sucesso("Link reativado.");
      lista.reload();
    } catch (erro) {
      toast.erro(mensagemErro(erro));
    }
  };

  const desativar = async (row: LinkPedidoLista) => {
    if (!window.confirm(`Desativar o link de @${row.instagram}? Novas compras serão bloqueadas.`)) return;
    try {
      await linksPedidoService.desativar(row.id);
      toast.sucesso("Link desativado.");
      lista.reload();
    } catch (erro) {
      toast.erro(mensagemErro(erro));
    }
  };

  const columns: Column<LinkPedidoLista>[] = [
    {
      key: "pessoa",
      header: "Pessoa",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">@{row.instagram}</div>
          <div className="truncate text-xs text-ink-soft">
            {row.nome || "Sem nome"} · {formatarDataHora(row.criado_em)}
          </div>
        </div>
      ),
    },
    {
      key: "destino",
      header: "Destino",
      width: "120px",
      render: (row) => (
        <StatusBadge
          value={row.destino}
          label={row.destino === "europa" ? "EUROPA" : "BRASIL"}
        />
      ),
    },
    {
      key: "validade",
      header: "Validade",
      width: "190px",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-sm text-ink">
            {row.aberto_em ? `Até ${formatarDataHora(row.validade_em)}` : `${row.validade_horas} h após abrir`}
          </div>
          <div className="truncate text-xs text-ink-muted">
            {row.aberto_em
              ? `Aberto ${formatarDataHora(row.aberto_em)}`
              : `Sem abrir até ${formatarDataHora(row.validade_em)}`}
          </div>
        </div>
      ),
    },
    {
      key: "situacao",
      header: "Situação",
      width: "130px",
      render: (row) => {
        const atual = situacaoLink(row.status, row.validade_em);
        return (
          <StatusBadge
            value={atual}
            label={rotuloSituacaoLink(atual)}
            tom={atual === "ativo" ? "sucesso" : atual === "expirado" ? "aviso" : "neutro"}
          />
        );
      },
    },
    {
      key: "venda",
      header: "Venda",
      width: "210px",
      render: (row) => {
        const primeira = row.vendas[0];
        const resto = row.vendas.length - 1;
        if (!primeira) {
          return (
            <div className="flex min-w-0 items-center gap-2">
              <StatusBadge value="sem_venda" label="Sem venda" tom="neutro" />
              <span className="truncate text-xs text-ink-soft">
                {row.acessos} {row.acessos === 1 ? "acesso" : "acessos"}
              </span>
            </div>
          );
        }
        return (
          <div className="min-w-0" onClick={(evento) => evento.stopPropagation()}>
            <Link
              to={`/vendas/${primeira.id}`}
              className="block truncate text-sm font-medium text-brand-700 hover:underline"
              title={row.vendas.map((item) => item.numero || "Ver ordem").join(", ")}
            >
              {primeira.numero || "Ver ordem"} · {formatarMoeda(primeira.valor_total, primeira.moeda_venda ?? row.moeda)}
            </Link>
            {resto > 0 ? (
              <span className="text-xs text-ink-soft">+{resto} {resto === 1 ? "venda" : "vendas"}</span>
            ) : (
              <span className="text-xs text-ink-soft">
                {row.acessos} {row.acessos === 1 ? "acesso" : "acessos"}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "acoes",
      header: "",
      width: "132px",
      className: "text-right",
      render: (row) => {
        const endereco = urlDoLink(row.token);
        const mensagem = mensagemDoLink(row.mensagem_compartilhar, {
          nome: row.nome,
          instagram: row.instagram,
          validade: prazoDaMensagemLink(row.validade_horas),
          url: endereco,
        });
        const atual = situacaoLink(row.status, row.validade_em);
        return (
          <div className="flex justify-end gap-1" onClick={(evento) => evento.stopPropagation()}>
            <button
              type="button"
              className="btn-ghost h-8 w-8 p-0"
              title="Copiar mensagem"
              aria-label={`Copiar mensagem de @${row.instagram}`}
              onClick={() => void copiar(mensagem, "Mensagem copiada.")}
            >
              <IconCopy width={16} height={16} />
            </button>
            <button
              type="button"
              className="btn-ghost h-8 w-8 p-0"
              title="Copiar link"
              aria-label={`Copiar link de @${row.instagram}`}
              onClick={() => void copiar(endereco, "Link copiado.")}
            >
              <IconLink width={16} height={16} />
            </button>
            <RowActionsDotsMenu
              label={`Ações de @${row.instagram}`}
              items={[
                { key: "ver", label: "Visualizar", icon: <IconEye width={15} height={15} />, onClick: () => navigate(`/links-pedido/${row.id}`) },
                ...(atual === "expirado" ? [{ key: "on", label: "Reativar", onClick: () => void reativar(row) }] : []),
                ...(atual === "desativado" ? [] : [{ key: "off", label: "Desativar", onClick: () => void desativar(row) }]),
              ]}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title="Links de pedido"
        breadcrumbs={[{ label: "Comercial" }, { label: "Links de pedido" }]}
        actions={
          <PrimaryButton type="button" icon={<IconPlus />} onClick={() => navigate("/links-pedido/novo")}>
            Criar novo link
          </PrimaryButton>
        }
      />

      <SectionCard noPadding className="flex min-h-0 flex-1 flex-col overflow-hidden" bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ScrollableListShell
          toolbar={
            <div className="flex flex-col gap-2 border-b border-line px-5 py-3 sm:flex-row sm:items-center">
              <SearchInput
                placeholder="Buscar por @ ou nome…"
                value={search}
                onChange={(evento) => {
                  setSearch(evento.target.value);
                  setPage(1);
                }}
                wrapperClassName="w-full sm:w-72"
              />
              <StatusSelectDropdown
                value={situacao}
                options={situacoes}
                onChange={(valor) => {
                  setSituacao(valor as SituacaoFiltroLink);
                  setPage(1);
                }}
                className="w-full sm:w-52"
              />
              <StatusSelectDropdown
                value={venda}
                options={vendas}
                onChange={(valor) => {
                  setVenda(valor as VendaFiltroLink);
                  setPage(1);
                }}
                className="w-full sm:w-52"
              />
            </div>
          }
          body={
            lista.error ? (
              <p className="p-5 text-sm text-red-700">Erro ao carregar os links: {lista.error.message}</p>
            ) : (
              <DataTable
                columns={columns}
                rows={lista.data?.data ?? []}
                rowKey={(row) => row.id}
                loading={lista.loading}
                onRowClick={(row) => navigate(`/links-pedido/${row.id}`)}
                tableClassName="table-fixed"
                emptyTitle={busca ? "Nenhum link encontrado" : "Nenhum link gerado"}
                emptyDescription={busca ? "Tente outro @ ou nome." : "Crie um link para enviar uma seleção fechada de tênis."}
                emptyAction={
                  busca ? undefined : (
                    <PrimaryButton type="button" onClick={() => navigate("/links-pedido/novo")}>
                      Criar novo link
                    </PrimaryButton>
                  )
                }
              />
            )
          }
          footer={<Pagination page={page} pageSize={20} total={lista.data?.total ?? 0} onPageChange={setPage} />}
        />
      </SectionCard>
    </div>
  );
}
