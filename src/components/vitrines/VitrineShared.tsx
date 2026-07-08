import { Link } from "react-router-dom";
import { PrecoVendaItem } from "../itens-estoque/PrecoVendaItem";
import { PrecoVendaEditavel } from "../itens-estoque/PrecoVendaEditavel";
import { FotoThumbnailHover } from "../FotoThumbnailHover";
import { StatusBadge } from "../StatusBadge";
import { formatarData, formatarMoeda } from "../../utils/format";
import { cn } from "../../utils/cn";
import type { VitrineComItens, VitrineItemDetalhado, VitrineItemSnapshot } from "../../services/vitrines";

export const TOTAL_CAIXAS_VITRINE = 22;

export function formatarNumeracoes(
  item:
    | Pick<VitrineItemSnapshot, "numeracao_br" | "numeracao_eu" | "numeracao_us">
    | {
        numeracao_br: number | null;
        numeracao_eu: number | null;
        numeracao_us: string | null;
      }
    | null
    | undefined,
): string {
  if (!item) return "—";
  const partes = [
    item.numeracao_br != null ? `BR ${item.numeracao_br}` : null,
    item.numeracao_eu != null ? `EU ${item.numeracao_eu}` : null,
    item.numeracao_us ? `US ${item.numeracao_us}` : null,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : "—";
}

export function snapshotDoItem(item: VitrineItemDetalhado): VitrineItemSnapshot | null {
  return item.snapshot ?? null;
}

export function nomeItemVitrine(item: VitrineItemDetalhado): string {
  const snapshot = snapshotDoItem(item);
  return (
    item.nome_exibicao?.trim() ||
    snapshot?.nome_exibicao ||
    snapshot?.nome_modelo ||
    item.item?.modelo?.nome_modelo ||
    "Item"
  );
}

export function nomeModeloItemEstoque(
  item: { modelo?: { nome_modelo: string } | null },
): string {
  return item.modelo?.nome_modelo ?? "—";
}

export function fotoItemVitrine(
  item: VitrineItemDetalhado,
  thumbs?: Record<string, string> | null,
): string | null {
  const snapshot = snapshotDoItem(item);
  return snapshot?.foto_url ?? (item.item?.id_modelo_produto ? thumbs?.[item.item.id_modelo_produto] ?? null : null);
}

/** Foto para PDF — ignora URLs externas (Tiny/S3) do snapshot e usa thumb do storage. */
export function fotoItemVitrinePdf(
  item: VitrineItemDetalhado,
  thumbs?: Record<string, string> | null,
): string | null {
  const modeloId = item.item?.id_modelo_produto ?? snapshotDoItem(item)?.id_modelo_produto;
  if (modeloId && thumbs?.[modeloId]) return thumbs[modeloId];

  const snapshot = snapshotDoItem(item);
  const fotoSnapshot = snapshot?.foto_url;
  if (fotoSnapshot && (fotoSnapshot.startsWith("data:") || fotoSnapshot.includes(".supabase.co/storage/"))) {
    return fotoSnapshot;
  }
  if (fotoSnapshot && !fotoSnapshot.startsWith("http")) return fotoSnapshot;

  return null;
}

export function VitrineStatusBadge({ status }: { status: string }) {
  const label =
    status === "rascunho" ? "Rascunho" : status === "publicada" ? "Atual" : "Encerrada";
  const tom = status === "rascunho" ? "aviso" : status === "publicada" ? "sucesso" : "neutro";
  return <StatusBadge value={status} label={label} tom={tom} />;
}

export function ContadorSelecao({ total }: { total: number }) {
  const delta = TOTAL_CAIXAS_VITRINE - total;
  const texto =
    delta === 0
      ? "22 itens selecionados. Você pode continuar."
      : delta > 0
        ? `Selecione mais ${delta} ${delta === 1 ? "item" : "itens"} para continuar.`
        : `Remova ${Math.abs(delta)} ${Math.abs(delta) === 1 ? "item" : "itens"} para continuar.`;
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm font-medium",
        delta === 0
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-amber-200 bg-amber-50 text-amber-900",
      )}
    >
      {texto}
    </div>
  );
}

export function CaixaResumoCard({
  item,
  thumbs,
  numeroCaixa,
  compact,
  destaquePreco,
  editarPreco,
}: {
  item: VitrineItemDetalhado;
  thumbs?: Record<string, string> | null;
  numeroCaixa?: number | null;
  compact?: boolean;
  destaquePreco?: boolean;
  editarPreco?: {
    idItemEstoque: string;
    onSalvo: (preco: number, moeda: string | null) => Promise<void>;
    disabled?: boolean;
  };
}) {
  const snapshot = snapshotDoItem(item);
  const foto = fotoItemVitrine(item, thumbs);
  const numeracoes = snapshot ? formatarNumeracoes(snapshot) : formatarNumeracoes(item.item);
  const modelo = snapshot?.nome_modelo ?? item.item?.modelo?.nome_modelo ?? "—";
  const nomeExibicao = item.nome_exibicao?.trim() || snapshot?.nome_exibicao?.trim();
  const sku = snapshot?.sku ?? item.item?.sku ?? "—";
  const titulo = nomeExibicao || modelo;
  const mostrarModelo =
    Boolean(nomeExibicao) &&
    modelo !== "—" &&
    nomeExibicao!.localeCompare(modelo, undefined, { sensitivity: "accent" }) !== 0;
  const precoClassName = destaquePreco
    ? "mt-2 font-numeric text-lg font-bold tabular-nums text-brand-800"
    : "mt-1 text-xs font-semibold text-ink";

  return (
    <div className={cn("flex min-w-0 gap-3", compact ? "items-center" : "items-start")}>
      <FotoThumbnailHover url={foto} alt={modelo} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {numeroCaixa ? (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
              Caixa {numeroCaixa}
            </span>
          ) : null}
          <span className="font-numeric text-xs font-semibold text-ink-muted">SKU {sku}</span>
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-ink">{titulo}</p>
        {mostrarModelo ? <p className="truncate text-xs text-ink-soft">{modelo}</p> : null}
        <p className="mt-1 text-xs text-ink-muted">{numeracoes}</p>
        {editarPreco ? (
          <PrecoVendaEditavel
            idItemEstoque={editarPreco.idItemEstoque}
            preco_venda={item.item?.preco_venda ?? snapshot?.preco}
            moeda_venda={item.item?.moeda_venda ?? snapshot?.moeda}
            tipoRegiaoLocal={item.item?.local?.tipo_regiao}
            className={destaquePreco ? "mt-2" : "mt-1"}
            destaque={destaquePreco}
            disabled={editarPreco.disabled}
            onSalvo={editarPreco.onSalvo}
          />
        ) : snapshot?.preco != null ? (
          <p className={precoClassName}>
            {formatarMoeda(snapshot.preco, snapshot.moeda ?? "EUR")}
          </p>
        ) : item.item ? (
          <PrecoVendaItem
            preco_venda={item.item.preco_venda}
            moeda_venda={item.item.moeda_venda}
            local={item.item.local}
            className={precoClassName}
          />
        ) : null}
      </div>
    </div>
  );
}

export function VitrineMeta({ vitrine }: { vitrine: VitrineComItens | null }) {
  if (!vitrine) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
      <VitrineStatusBadge status={vitrine.status} />
      <span>{vitrine.nomeUsuario ?? "Responsável não informado"}</span>
      <span>·</span>
      <span>{vitrine.publicado_em ? `Publicada em ${formatarData(vitrine.publicado_em)}` : `Criada em ${formatarData(vitrine.criado_em)}`}</span>
      {vitrine.encerrado_em ? (
        <>
          <span>·</span>
          <span>Encerrada em {formatarData(vitrine.encerrado_em)}</span>
        </>
      ) : null}
    </div>
  );
}

export function LinkPdfVitrine({ id }: { id: string }) {
  return (
    <Link
      to={`/vitrines/${id}/pdf`}
      className="inline-flex items-center rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-muted transition hover:border-brand-400 hover:text-brand-700"
    >
      PDF
    </Link>
  );
}
