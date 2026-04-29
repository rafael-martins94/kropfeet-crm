import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SearchInput } from "../../components/SearchInput";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import {
  IconEdit,
  IconPlus,
  IconRefresh,
  IconTrash,
} from "../../components/Icons";
import { usuariosService } from "../../services/usuarios";
import { useAuth } from "../../contexts/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { formatarData } from "../../utils/format";
import type { PerfilUsuario } from "../../types/entities";
import { cn } from "../../utils/cn";

export default function UsuariosListPage() {
  const navigate = useNavigate();
  const { user: usuarioAtual } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const searchDebounced = useDebounce(search, 300);
  const [acaoPendente, setAcaoPendente] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync(
    () =>
      usuariosService.listar({
        page,
        pageSize: 20,
        search: searchDebounced,
      }),
    [page, searchDebounced],
  );

  const handleToggleAtivo = async (u: PerfilUsuario) => {
    const novoStado = !u.ativo;
    const msg = novoStado
      ? `Reativar ${u.nome}?`
      : `Desativar ${u.nome}? O usuário perderá acesso na próxima sessão.`;
    if (!window.confirm(msg)) return;

    setAcaoPendente(u.id);
    try {
      await usuariosService.definirAtivo(u.id, novoStado);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao atualizar status.");
    } finally {
      setAcaoPendente(null);
    }
  };

  const handleResetSenha = async (u: PerfilUsuario) => {
    if (!window.confirm(`Enviar e-mail de redefinição de senha para ${u.email}?`)) return;

    setAcaoPendente(u.id);
    try {
      await usuariosService.enviarResetSenha(u.email);
      alert(`E-mail de redefinição enviado para ${u.email}.`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao enviar e-mail.");
    } finally {
      setAcaoPendente(null);
    }
  };

  const handleExcluir = async (u: PerfilUsuario) => {
    if (u.id === usuarioAtual?.id) {
      alert("Você não pode excluir o próprio perfil.");
      return;
    }
    const confirmacao = window.prompt(
      `Excluir permanentemente o perfil de "${u.nome}"?\n\n` +
        `Isso remove apenas o perfil do CRM. O registro de autenticação em auth.users continua existindo e deve ser removido manualmente pelo painel do Supabase, se necessário.\n\n` +
        `Para confirmar, digite EXCLUIR:`,
    );
    if (confirmacao !== "EXCLUIR") return;

    setAcaoPendente(u.id);
    try {
      await usuariosService.excluirPerfil(u.id);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir perfil.");
    } finally {
      setAcaoPendente(null);
    }
  };

  const columns: Column<PerfilUsuario>[] = [
    {
      key: "nome",
      header: "Nome",
      render: (u) => (
        <div>
          <div className="font-medium text-ink">
            {u.nome || <span className="text-ink-faint">(sem nome)</span>}
          </div>
          <div className="text-xs text-ink-soft">{u.email}</div>
        </div>
      ),
    },
    {
      key: "papel",
      header: "Papel",
      width: "140px",
      render: (u) => (
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset",
            u.papel === "admin"
              ? "bg-brand-50 text-brand-700 ring-brand-100"
              : "bg-surface-subtle text-ink-muted ring-line",
          )}
        >
          {u.papel}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "110px",
      render: (u) => <StatusBadge value={u.ativo ? "ativo" : "inativo"} />,
    },
    {
      key: "criado_em",
      header: "Criado em",
      width: "140px",
      render: (u) => (
        <span className="text-xs text-ink-soft">{formatarData(u.criado_em)}</span>
      ),
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      width: "200px",
      className: "text-right",
      render: (u) => {
        const pendente = acaoPendente === u.id;
        const ehProprio = u.id === usuarioAtual?.id;
        return (
          <div className="flex justify-end gap-1">
            <button
              className="btn-ghost h-8 w-8 p-0"
              title="Enviar reset de senha"
              disabled={pendente}
              onClick={() => handleResetSenha(u)}
            >
              <IconRefresh width={16} height={16} />
            </button>
            <button
              className="btn-ghost h-8 w-8 p-0"
              title="Editar"
              disabled={pendente}
              onClick={() => navigate(`/usuarios/${u.id}/editar`)}
            >
              <IconEdit width={16} height={16} />
            </button>
            <button
              className={cn(
                "btn-ghost h-8 px-2 text-xs",
                u.ativo ? "hover:!text-amber-600" : "hover:!text-emerald-600",
              )}
              title={u.ativo ? "Desativar" : "Ativar"}
              disabled={pendente || ehProprio}
              onClick={() => handleToggleAtivo(u)}
            >
              {u.ativo ? "Desativar" : "Ativar"}
            </button>
            <button
              className="btn-ghost h-8 w-8 p-0 hover:!text-red-600"
              title="Excluir"
              disabled={pendente || ehProprio}
              onClick={() => handleExcluir(u)}
            >
              <IconTrash width={16} height={16} />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title="Usuários"
        breadcrumbs={[{ label: "Sistema" }, { label: "Usuários" }]}
        actions={
          <PrimaryButton
            icon={<IconPlus width={16} height={16} />}
            onClick={() => navigate("/usuarios/novo")}
          >
            Novo usuário
          </PrimaryButton>
        }
      />

      <SectionCard
        noPadding
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <ScrollableListShell
          toolbar={
            <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <SearchInput
                placeholder="Buscar por nome ou e-mail…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                wrapperClassName="w-full sm:max-w-xs"
              />
              <div className="text-xs text-ink-soft">
                {data ? `${data.total.toLocaleString("pt-BR")} usuários` : ""}
              </div>
            </div>
          }
          body={
            error ? (
              <div className="p-5 text-sm text-red-700">Erro: {error.message}</div>
            ) : (
              <DataTable
                columns={columns}
                rows={data?.data ?? []}
                rowKey={(u) => u.id}
                loading={loading}
                emptyTitle="Nenhum usuário encontrado"
                emptyDescription="Clique em 'Novo usuário' para convidar alguém."
              />
            )
          }
          footer={
            data ? (
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={setPage}
              />
            ) : null
          }
        />
      </SectionCard>
    </div>
  );
}
