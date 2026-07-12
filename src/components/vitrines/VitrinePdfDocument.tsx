import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type {
  VitrineComItens,
  VitrineCorrespondenciaSnapshot,
  VitrineItemDetalhado,
} from "../../services/vitrines";
import { formatarData, formatarMoeda } from "../../utils/format";
import { resolverSrcImagemPdf } from "../../utils/pdfImagens";
import { deduplicarCorrespondenciasPorNumeracao } from "../../utils/vitrineCorrespondencias";
import { formatarNumeracoes, fotoItemVitrinePdf, snapshotDoItem } from "./VitrineShared";

const BRAND = "#0B3F5C";
const BRAND_LIGHT = "#E8F2F7";
const INK = "#1F2937";
const INK_SOFT = "#6B7280";
const LINE = "#E5E7EB";
const SURFACE = "#F9FAFB";

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 36,
    paddingHorizontal: 28,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: INK,
    backgroundColor: "#FFFFFF",
  },
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
  },
  pageHeaderLeft: {
    flex: 1,
    paddingRight: 16,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: BRAND,
    letterSpacing: -0.3,
  },
  pageMeta: {
    marginTop: 4,
    fontSize: 8,
    color: INK_SOFT,
  },
  pageHeaderRight: {
    alignItems: "flex-end",
  },
  pageStat: {
    fontSize: 8,
    fontWeight: 700,
    color: BRAND,
    backgroundColor: BRAND_LIGHT,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  card: {
    flexDirection: "row",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  cardAccent: {
    width: 3,
    backgroundColor: BRAND,
  },
  cardInner: {
    flex: 1,
    flexDirection: "row",
    padding: 10,
  },
  fotoWrap: {
    width: 64,
    height: 64,
    marginRight: 12,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
  },
  foto: {
    width: 64,
    height: 64,
    objectFit: "contain",
  },
  fotoPlaceholder: {
    width: 64,
    height: 64,
    backgroundColor: SURFACE,
  },
  cardBody: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  cardTopLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  caixaBadge: {
    fontSize: 8,
    fontWeight: 700,
    color: "#FFFFFF",
    backgroundColor: BRAND,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 3,
  },
  skuBadge: {
    fontSize: 8,
    fontWeight: 700,
    color: INK_SOFT,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: LINE,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 3,
  },
  precoPrincipal: {
    fontSize: 12,
    fontWeight: 700,
    color: BRAND,
    textAlign: "right",
  },
  nomeExibicao: {
    fontSize: 11,
    fontWeight: 700,
    color: INK,
    marginBottom: 5,
    lineHeight: 1.3,
  },
  numeracaoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 2,
  },
  numeracaoChip: {
    fontSize: 7.5,
    color: INK,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: LINE,
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 3,
  },
  unicoBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    fontSize: 7,
    fontWeight: 700,
    color: "#92400E",
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
  },
  tabelaWrap: {
    marginTop: 8,
  },
  tabelaLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: INK_SOFT,
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  tabela: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 4,
  },
  tabelaHeader: {
    flexDirection: "row",
    backgroundColor: BRAND,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tabelaHeaderCell: {
    fontSize: 7.5,
    fontWeight: 700,
    color: "#FFFFFF",
  },
  tabelaRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    backgroundColor: "#FFFFFF",
  },
  tabelaRowAlt: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    backgroundColor: SURFACE,
  },
  tabelaRowLast: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#FFFFFF",
  },
  tabelaRowLastAlt: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: SURFACE,
  },
  colSku: { width: 56 },
  colNumeracao: { flex: 1, paddingHorizontal: 6 },
  colValor: { width: 72, textAlign: "right" },
  cellText: { fontSize: 7.5, color: INK },
  cellSku: { fontSize: 7.5, color: INK_SOFT, fontWeight: 700 },
  cellValor: { fontSize: 7.5, color: BRAND, fontWeight: 700, textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7,
    color: INK_SOFT,
  },
});

function nomeExibicaoPdf(item: VitrineItemDetalhado): string {
  const snapshot = snapshotDoItem(item);
  return (
    item.nome_exibicao?.trim() ||
    snapshot?.nome_exibicao?.trim() ||
    snapshot?.nome_modelo ||
    item.item?.modelo?.nome_modelo ||
    item.item?.nome_produto ||
    "—"
  );
}

function skuPdf(item: VitrineItemDetalhado): string {
  const snapshot = snapshotDoItem(item);
  return snapshot?.sku ?? item.item?.sku ?? "—";
}

function formatarPrecoPdf(preco: number | null | undefined, moeda: string | null | undefined): string {
  return preco != null ? formatarMoeda(preco, moeda ?? "EUR") : "—";
}

function precoPdf(
  item: VitrineItemDetalhado,
  snapshot: ReturnType<typeof snapshotDoItem>,
): string {
  const preco = snapshot?.preco ?? item.item?.preco_venda;
  const moeda = snapshot?.moeda ?? item.item?.moeda_venda;
  return formatarPrecoPdf(preco, moeda);
}

function fotoPdf(
  item: VitrineItemDetalhado,
  thumbs: Record<string, string> | null | undefined,
  imageDataUrls: Record<string, string>,
): string | null {
  return resolverSrcImagemPdf(fotoItemVitrinePdf(item, thumbs), imageDataUrls);
}

function NumeracaoChips({
  item,
}: {
  item: Pick<VitrineItemDetalhado, "item"> & { snapshot?: ReturnType<typeof snapshotDoItem> };
}) {
  const snapshot = item.snapshot;
  const numeracao = snapshot
    ? { br: snapshot.numeracao_br, eu: snapshot.numeracao_eu, us: snapshot.numeracao_us }
    : {
        br: item.item?.numeracao_br ?? null,
        eu: item.item?.numeracao_eu ?? null,
        us: item.item?.numeracao_us ?? null,
      };

  const chips = [
    numeracao.br != null ? `BR ${numeracao.br}` : null,
    numeracao.eu != null ? `EU ${numeracao.eu}` : null,
    numeracao.us ? `US ${numeracao.us}` : null,
  ].filter(Boolean) as string[];

  if (chips.length === 0) {
    return <Text style={styles.numeracaoChip}>—</Text>;
  }

  return (
    <View style={styles.numeracaoRow}>
      {chips.map((chip) => (
        <Text key={chip} style={styles.numeracaoChip}>
          {chip}
        </Text>
      ))}
    </View>
  );
}

function TabelaCorrespondencias({ linhas }: { linhas: VitrineCorrespondenciaSnapshot[] }) {
  if (linhas.length === 0) return null;

  return (
    <View style={styles.tabelaWrap}>
      <Text style={styles.tabelaLabel}>OUTRAS NUMERAÇÕES</Text>
      <View style={styles.tabela}>
        <View style={styles.tabelaHeader}>
          <Text style={[styles.colSku, styles.tabelaHeaderCell]}>SKU</Text>
          <Text style={[styles.colNumeracao, styles.tabelaHeaderCell]}>Numeração</Text>
          <Text style={[styles.colValor, styles.tabelaHeaderCell]}>Valor</Text>
        </View>
        {linhas.map((corr, index) => {
          const isLast = index === linhas.length - 1;
          const isAlt = index % 2 === 1;
          const rowStyle = isLast
            ? isAlt
              ? styles.tabelaRowLastAlt
              : styles.tabelaRowLast
            : isAlt
              ? styles.tabelaRowAlt
              : styles.tabelaRow;

          return (
            <View key={corr.id_item_estoque ?? corr.sku} style={rowStyle}>
              <Text style={[styles.colSku, styles.cellSku]}>{corr.sku}</Text>
              <Text style={[styles.colNumeracao, styles.cellText]}>{formatarNumeracoes(corr)}</Text>
              <Text style={[styles.colValor, styles.cellValor]}>{formatarPrecoPdf(corr.preco, corr.moeda)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function VitrinePdfItem({
  item,
  thumbs,
  imageDataUrls,
}: {
  item: VitrineItemDetalhado;
  thumbs?: Record<string, string> | null;
  imageDataUrls: Record<string, string>;
}) {
  const snapshot = snapshotDoItem(item);
  const foto = fotoPdf(item, thumbs, imageDataUrls);
  const correspondencias = deduplicarCorrespondenciasPorNumeracao(snapshot?.correspondencias ?? []);

  return (
    <View style={styles.card} wrap={false}>
      <View style={styles.cardAccent} />
      <View style={styles.cardInner}>
        <View style={styles.fotoWrap}>
          {foto ? <Image src={foto} style={styles.foto} /> : <View style={styles.fotoPlaceholder} />}
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <View style={styles.cardTopLeft}>
              <Text style={styles.caixaBadge}>Caixa {item.numero_caixa}</Text>
              <Text style={styles.skuBadge}>SKU {skuPdf(item)}</Text>
              {item.estado_caixa === "vendida" ? (
                <Text style={styles.unicoBadge}>Vendido</Text>
              ) : null}
            </View>
            <Text style={styles.precoPrincipal}>{precoPdf(item, snapshot)}</Text>
          </View>
          <Text style={styles.nomeExibicao}>{nomeExibicaoPdf(item)}</Text>
          <NumeracaoChips item={{ item: item.item, snapshot }} />
          {item.estado_caixa === "vendida" ? (
            <Text style={styles.unicoBadge}>Caixa vazia — substituir na vitrine atual</Text>
          ) : correspondencias.length === 0 ? (
            <Text style={styles.unicoBadge}>Único</Text>
          ) : (
            <TabelaCorrespondencias linhas={correspondencias} />
          )}
        </View>
      </View>
    </View>
  );
}

function PageFooter({ titulo }: { titulo: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>KropFeet · {titulo}</Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  );
}

export function VitrinePdfDocument({
  vitrine,
  thumbs,
  imageDataUrls = {},
}: {
  vitrine: VitrineComItens;
  thumbs?: Record<string, string> | null;
  imageDataUrls?: Record<string, string>;
}) {
  const itens = [...vitrine.itens].sort((a, b) => (a.numero_caixa ?? 999) - (b.numero_caixa ?? 999));
  const dataPublicacao = formatarData(vitrine.publicado_em ?? vitrine.criado_em);

  return (
    <Document title={vitrine.titulo}>
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHeader} fixed>
          <View style={styles.pageHeaderLeft}>
            <Text style={styles.pageTitle}>{vitrine.titulo}</Text>
            <Text style={styles.pageMeta}>Publicada em {dataPublicacao}</Text>
          </View>
          <View style={styles.pageHeaderRight}>
            <Text style={styles.pageStat}>{itens.length} caixas</Text>
          </View>
        </View>

        {itens.map((item) => (
          <VitrinePdfItem key={item.id} item={item} thumbs={thumbs} imageDataUrls={imageDataUrls} />
        ))}

        <PageFooter titulo={vitrine.titulo} />
      </Page>
    </Document>
  );
}
