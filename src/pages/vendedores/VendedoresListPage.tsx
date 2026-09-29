import { useState } from "react";
import { DataTable, type Column } from "../../components/DataTable";
import { FormInput } from "../../components/FormField";
import { IconEdit, IconPlus } from "../../components/Icons";
import { Modal } from "../../components/Modal";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SearchInput } from "../../components/SearchInput";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { useToast } from "../../contexts/ToastContext";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { vendedoresService } from "../../services/vendedores";
import type { Vendedor } from "../../types/entities";
import { cn } from "../../utils/cn";
import { mensagemErro } from "../../utils/errors";
import { formatarData } from "../../utils/format";

type AbaVendedores = "ativos" | "inativos";

export default function VendedoresListPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [aba, setAba] = useState<AbaVendedores>("ativos");
  const [search, setSearch] = useState("");
  const searchDebounced = useDebounce(search, 300);
  const [editor, setEditor] = useState<{ id: string | null; nome: string } | null>(null);
  const [erroEditor, setErroEditor] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () =>
      vendedoresService.listar({
        page,
        pageSize: 20,
        search: searchDebounced,
        ativo: aba === "ativos",
      }),
    [page, searchDebounced, aba],
  );

  const trocarAba = (proxima: AbaVendedores) => {
    setAba(proxima);
    setPage(1);
  };

  const abrirNovo = () => {
    setErroEditor(null);
    setEditor({ id: null, nome: "" });
  };

  const abrirEdicao = (vendedor: Vendedor) => {
    setErroEditor(null);
    setEditor({ id: vendedor.id, nome: vendedor.nome });
  };

  const salvar = async () => {
    if (!editor) return;
    const nome = editor.nome.trim();
    if (!nome) {
      setErroEditor("Informe o nome do vendedor.");
      return;
    }
    setSalvando(true);
    setErroEditor(null);
    try {
      if (editor.id) await vendedoresService.atualizar(editor.id, { nome });
      else await vendedoresService.criar(nome);
      setEditor(null);
      toast.sucesso(editor.id ? "Vendedor atualizado." : "Vendedor cadastrado.");
      reload();
    } catch (err) {
      const texto = mensagemErro(err);
      setErroEditor(
        texto.toLowerCase().includes("vendedores_nome_unico")
          ? "Já existe um vendedor com esse nome."
          : texto,
      );
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (vendedor: Vendedor) => {
    try {
      await vendedoresService.atualizar(vendedor.id, { ativo: !vendedor.ativo });
      reload();
    } catch (err) {
      toast.erro(mensagemErro(err));
    }
  };

  const columns: Column<Vendedor>[] = [
    {
      key: "nome",
      header: "Nome",
      render: (vendedor) => <span className="font-medium">{vendedor.nome}</span>,
    },
    {
      key: "ativo",
      header: "Situação",
      width: "140px",
      render: (vendedor) => <StatusBadge value={vendedor.ativo ? "ativo" : "inativo"} />,
    },
    {
      key: "criado_em",
      header: "Criado em",
      width: "160px",
      render: (vendedor) => (
        <span className="text-ink-soft">{formatarData(vendedor.criado_em)}</span>
      ),
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      width: "180px",
      className: "text-right",
      render: (vendedor) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            className="btn-ghost h-8 px-2 text-xs"
            onClick={() => void alternarAtivo(vendedor)}
          >
            {vendedor.ativo ? "Desativar" : "Ativar"}
          </button>
          <button
            type="button"
            className="btn-ghost h-8 w-8 p-0"
            title="Editar"
            onClick={() => abrirEdicao(vendedor)}
          >
            <IconEdit width={16} height={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title="Vendedores"
        breadcrumbs={[{ label: "Comercial" }, { label: "Vendedores" }]}
        actions={
          <PrimaryButton icon={<IconPlus width={16} height={16} />} onClick={abrirNovo}>
            Novo vendedor
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div
                  className="inline-flex w-fit rounded-lg border border-line bg-surface-subtle p-0.5"
                  role="tablist"
                  aria-label="Situação dos vendedores"
                >
                  {(
                    [
                      ["ativos", "Ativos"],
                      ["inativos", "Inativos"],
                    ] as const
                  ).map(([valor, rotulo]) => (
                    <button
                      key={valor}
                      type="button"
                      role="tab"
                      aria-selected={aba === valor}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium transition",
                        aba === valor
                          ? "bg-surface text-ink shadow-sm"
                          : "text-ink-soft hover:text-ink",
                      )}
                      onClick={() => trocarAba(valor)}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
                <SearchInput
                  placeholder="Buscar por nome…"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  wrapperClassName="w-full sm:max-w-xs"
                />
              </div>
              <div className="text-xs text-ink-soft">
                {data
                  ? `${data.total.toLocaleString("pt-BR")} ${aba === "ativos" ? "ativo(s)" : "inativo(s)"}`
                  : ""}
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
                rowKey={(vendedor) => vendedor.id}
                loading={loading}
                emptyTitle={aba === "ativos" ? "Nenhum vendedor ativo" : "Nenhum vendedor inativo"}
                emptyDescription={
                  aba === "ativos"
                    ? "Cadastre quem aparece na ordem de venda e no catálogo da galeria."
                    : "Vendedores desativados aparecem nesta aba."
                }
              />
            )
          }
          footer={
            data && data.total > 0 ? (
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

      <Modal
        open={editor !== null}
        onClose={() => {
          if (!salvando) setEditor(null);
        }}
        title={editor?.id ? "Editar vendedor" : "Novo vendedor"}
        description="O nome entra na lista da ordem de venda e do catálogo da galeria."
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn-ghost"
              disabled={salvando}
              onClick={() => setEditor(null)}
            >
              Cancelar
            </button>
            <PrimaryButton loading={salvando} onClick={() => void salvar()}>
              Salvar
            </PrimaryButton>
          </>
        }
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void salvar();
          }}
        >
          <FormInput
            label="Nome"
            value={editor?.nome ?? ""}
            onChange={(event) =>
              setEditor((atual) => (atual ? { ...atual, nome: event.target.value } : atual))
            }
            autoFocus
            required
          />
          {erroEditor ? <p className="mt-2 text-sm text-red-600">{erroEditor}</p> : null}
        </form>
      </Modal>
    </div>
  );
}
