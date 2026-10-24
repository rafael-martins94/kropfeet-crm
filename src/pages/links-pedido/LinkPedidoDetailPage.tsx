import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { InlineLoader } from "../../components/LoadingState";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../contexts/ToastContext";
import { linksPedidoService } from "../../services/links-pedido";
import { formatarDataHora, formatarMoeda } from "../../utils/format";
import { mensagemErro } from "../../utils/errors";
import { mensagemDoLink, numeracaoVisivel, prazoDaMensagemLink, rotuloSituacaoLink, situacaoLink, textoValidadeLink, urlDoLink } from "../../utils/linkPedido";

export default function LinkPedidoDetailPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const detalhe = useAsync(() => linksPedidoService.obter(id), [id]);

  if (detalhe.loading) return <InlineLoader label="Carregando o link…" />;
  if (detalhe.error || !detalhe.data) {
    return <p className="p-5 text-sm text-red-700">Erro ao abrir o link: {detalhe.error?.message ?? "Não encontrado."}</p>;
  }

  const link = detalhe.data;
  const situacao = situacaoLink(link.status, link.validade_em);
  const endereco = urlDoLink(link.token);
  const texto =
    mensagem ??
    mensagemDoLink(link.mensagem_compartilhar, {
      nome: link.nome,
      instagram: link.instagram,
      validade: prazoDaMensagemLink(link.validade_horas),
      url: endereco,
    });

  const reativar = async () => {
    if (!window.confirm(`Reativar este link? O prazo de ${link.validade_horas} h volta a contar quando a pessoa abrir. Sem abertura, expira de novo em 7 dias.`)) return;
    try {
      await linksPedidoService.reativar(link.id);
      toast.sucesso("Link reativado.");
      detalhe.reload();
    } catch (erro) {
      toast.erro(mensagemErro(erro));
    }
  };

  const desativar = async () => {
    if (!window.confirm("Desativar este link? Novas compras serão bloqueadas.")) return;
    try {
      await linksPedidoService.desativar(link.id);
      toast.sucesso("Link desativado.");
      detalhe.reload();
    } catch (erro) {
      toast.erro(mensagemErro(erro));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <PageHeader
        title={`@${link.instagram}`}
        titleAccessory={
          <StatusBadge value={situacao} label={rotuloSituacaoLink(situacao)} tom={situacao === "ativo" ? "sucesso" : situacao === "expirado" ? "aviso" : "neutro"} />
        }
        backTo="/links-pedido"
        breadcrumbs={[{ label: "Links de pedido", to: "/links-pedido" }, { label: `@${link.instagram}` }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton type="button" onClick={() => void navigator.clipboard.writeText(endereco).then(() => toast.sucesso("Link copiado."))}>
              Copiar link
            </SecondaryButton>
            <SecondaryButton type="button" onClick={() => void navigator.clipboard.writeText(texto).then(() => toast.sucesso("Mensagem copiada."))}>
              Copiar mensagem
            </SecondaryButton>
            {situacao === "expirado" ? (
              <PrimaryButton type="button" onClick={() => void reativar()}>
                Reativar
              </PrimaryButton>
            ) : null}
            {situacao !== "desativado" ? (
              <SecondaryButton type="button" onClick={() => void desativar()}>
                Desativar
              </SecondaryButton>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <SectionCard title="Tênis do link">
          <ul className="divide-y divide-line">
            {link.itens.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-ink">{item.item?.nome_produto ?? item.id_item_estoque}</p>
                  <p className="text-xs text-ink-soft">
                    {item.item?.sku}
                    {item.item ? ` · ${numeracaoVisivel(item.item)}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Preço original preservado:{" "}
                    {item.preco_original != null ? formatarMoeda(item.preco_original, item.moeda_original ?? link.moeda) : "não havia"}
                    {" · "}estoque agora: {item.item?.status_item ?? "—"}
                  </p>
                </div>
                <p className="font-numeric font-semibold">{formatarMoeda(item.preco, item.moeda)}</p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Situação">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-ink-soft">Criado</dt><dd>{formatarDataHora(link.criado_em)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-soft">Validade</dt><dd className="text-right">{textoValidadeLink(link)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-soft">Aberto em</dt><dd>{link.aberto_em ? formatarDataHora(link.aberto_em) : "Ainda não"}</dd></div>
              {link.aberto_em ? null : (
                <div className="flex justify-between gap-3"><dt className="text-ink-soft">Sem abertura até</dt><dd>{formatarDataHora(link.validade_em)}</dd></div>
              )}
              <div className="flex justify-between gap-3"><dt className="text-ink-soft">Destino</dt><dd>{link.destino === "europa" ? "Europa" : "Brasil"} · {link.moeda}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-soft">Acessos à página</dt><dd>{link.acessos}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-soft">Vendas confirmadas</dt><dd>{link.vendas_confirmadas}</dd></div>
            </dl>
            <div className="mt-4">
              {link.vendas.length === 0 ? (
                <p className="text-sm text-ink-soft">Ainda não houve compra confirmada neste link. Os acessos acima não são vendas.</p>
              ) : (
                <ul className="space-y-2">
                  {link.vendas.map((venda) => (
                    <li key={venda.id}>
                      <Link to={`/vendas/${venda.id}`} className="text-sm font-semibold text-brand-700 hover:underline">
                        {venda.numero || "Ver ordem"} · {formatarMoeda(venda.valor_total, venda.moeda_venda ?? link.moeda)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SectionCard>
          <SectionCard title="Mensagem">
            <textarea className="input-base min-h-32 w-full" value={texto} onChange={(e) => setMensagem(e.target.value)} />
            <a href={endereco} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">
              Abrir a página pública
            </a>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
