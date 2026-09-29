import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { MapaColetaGabaritoItem, MapaColetaItem, MapaColetaVitrine } from "../../services/vitrines";
import type { Vitrine } from "../../types/entities";
import { formatarData } from "../../utils/format";
import { resolverSrcImagemPdf } from "../../utils/pdfImagens";
import {
  AVISO_MAPA_RECONSTRUIDO,
  ROTULO_SITUACAO_GABARITO,
  SEM_LOCAL,
  TEXTO_BLOCO_MAPA_COLETA,
  TOM_SITUACAO_GABARITO,
  etiquetaDestino,
  organizarMapaColeta,
  resumoGrupoLocal,
  tituloItemMapaColeta,
  type BlocoMapaColeta,
  type EtiquetaMapaColeta,
} from "./mapaColeta";
import { formatarNumeracoes } from "./VitrineShared";

const BRAND = "#0B3F5C";
const BRAND_LIGHT = "#E8F2F7";
const INK = "#1F2937";
const INK_SOFT = "#6B7280";
const LINE = "#E5E7EB";
const SURFACE = "#F9FAFB";
const AMBER = "#92400E";
const AMBER_LIGHT = "#FFFBEB";

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
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
  },
  pageHeaderLeft: { flex: 1, paddingRight: 16 },
  pageTitle: { fontSize: 20, fontWeight: 700, color: BRAND, letterSpacing: -0.3 },
  pageMeta: { marginTop: 4, fontSize: 8, color: INK_SOFT },
  pageStats: { flexDirection: "row", gap: 4 },
  pageStat: {
    fontSize: 8,
    fontWeight: 700,
    color: BRAND,
    backgroundColor: BRAND_LIGHT,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  aviso: {
    marginBottom: 12,
    fontSize: 8,
    color: AMBER,
    backgroundColor: AMBER_LIGHT,
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  bloco: { marginBottom: 14 },
  blocoTitulo: { fontSize: 12, fontWeight: 700, color: BRAND },
  blocoDescricao: { marginTop: 2, marginBottom: 6, fontSize: 8, color: INK_SOFT },
  lista: { borderWidth: 1, borderColor: LINE, borderRadius: 6, overflow: "hidden" },
  grupo: { marginBottom: 10, borderWidth: 1, borderColor: LINE, borderRadius: 6, overflow: "hidden" },
  grupoSemLocal: { borderColor: "#FCD34D" },
  grupoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  grupoHeaderSemLocal: { backgroundColor: AMBER_LIGHT },
  grupoNome: { fontSize: 10, fontWeight: 700, color: INK },
  grupoResumo: { fontSize: 8, color: INK_SOFT },
  subLista: { paddingTop: 5, fontSize: 7, fontWeight: 700, color: INK_SOFT, letterSpacing: 0.4, paddingHorizontal: 10 },
  linha: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  linhaPrimeira: { borderTopWidth: 0 },
  checkbox: { width: 10, height: 10, borderWidth: 1, borderColor: INK_SOFT, borderRadius: 2, marginRight: 8 },
  fotoWrap: {
    width: 34,
    height: 34,
    marginRight: 8,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: SURFACE,
  },
  foto: { width: 34, height: 34, objectFit: "contain" },
  corpo: { flex: 1 },
  linhaTopo: { flexDirection: "row", gap: 6 },
  sku: { fontSize: 7.5, fontWeight: 700, color: INK_SOFT },
  marca: { fontSize: 7.5, color: INK_SOFT },
  titulo: { marginTop: 1, fontSize: 9.5, fontWeight: 700, color: INK },
  detalhe: { marginTop: 1, fontSize: 7.5, color: INK_SOFT },
  faixaAnterior: {
    marginBottom: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: BRAND_LIGHT,
    borderLeftWidth: 3,
    borderLeftColor: BRAND,
  },
  faixaAnteriorRotulo: { fontSize: 6.5, fontWeight: 700, color: INK_SOFT, letterSpacing: 0.4 },
  faixaAnteriorTexto: { marginTop: 2, fontSize: 9, fontWeight: 700, color: BRAND },
  destino: { width: 110, alignItems: "flex-end", marginRight: 10 },
  destinoRotulo: { fontSize: 6.5, fontWeight: 700, color: INK_SOFT, letterSpacing: 0.4 },
  destinoNome: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: 700,
    color: "#FFFFFF",
    backgroundColor: BRAND,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 3,
  },
  destinoNomeSemRegistro: { color: AMBER, backgroundColor: AMBER_LIGHT },
  destinoNomeNeutro: { color: INK_SOFT, backgroundColor: SURFACE, borderWidth: 1, borderColor: LINE },
  caixa: { width: 64, alignItems: "flex-end" },
  caixaRotulo: { fontSize: 6.5, fontWeight: 700, color: INK_SOFT, letterSpacing: 0.4 },
  caixaNumero: { fontSize: 16, fontWeight: 700, color: BRAND },
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
  footerText: { fontSize: 7, color: INK_SOFT },
});

export function fotoItemMapaColetaPdf(
  item: MapaColetaItem,
  thumbs: Record<string, string> | null | undefined,
): string | null {
  const modelo = item.id_modelo_produto;
  if (modelo && thumbs?.[modelo]) return thumbs[modelo];
  return item.foto_url;
}

function LinhaPdf({
  item,
  primeira,
  caixa,
  rotuloCaixa = "CAIXA",
  detalhe,
  etiqueta,
  thumbs,
  imageDataUrls,
}: {
  item: MapaColetaItem;
  primeira: boolean;
  caixa: number | null;
  rotuloCaixa?: string;
  detalhe?: string;
  etiqueta?: EtiquetaMapaColeta;
  thumbs?: Record<string, string> | null;
  imageDataUrls: Record<string, string>;
}) {
  const foto = resolverSrcImagemPdf(fotoItemMapaColetaPdf(item, thumbs), imageDataUrls);
  const numeracoes = formatarNumeracoes(item);

  return (
    <View style={primeira ? [styles.linha, styles.linhaPrimeira] : styles.linha} wrap={false}>
      <View style={styles.checkbox} />
      <View style={styles.fotoWrap}>{foto ? <Image src={foto} style={styles.foto} /> : null}</View>
      <View style={styles.corpo}>
        <View style={styles.linhaTopo}>
          <Text style={styles.sku}>SKU {item.sku ?? "—"}</Text>
          {item.marca ? <Text style={styles.marca}>{item.marca}</Text> : null}
        </View>
        <Text style={styles.titulo}>{tituloItemMapaColeta(item)}</Text>
        <Text style={styles.detalhe}>{detalhe ? `${numeracoes} · ${detalhe}` : numeracoes}</Text>
      </View>
      {etiqueta ? (
        <View style={styles.destino}>
          {etiqueta.rotulo ? <Text style={styles.destinoRotulo}>{etiqueta.rotulo.toUpperCase()}</Text> : null}
          <Text
            style={
              etiqueta.tom === "aviso"
                ? [styles.destinoNome, styles.destinoNomeSemRegistro]
                : etiqueta.tom === "neutro"
                  ? [styles.destinoNome, styles.destinoNomeNeutro]
                  : styles.destinoNome
            }
          >
            {etiqueta.texto}
          </Text>
        </View>
      ) : null}
      {caixa != null ? (
        <View style={styles.caixa}>
          <Text style={styles.caixaRotulo}>{rotuloCaixa}</Text>
          <Text style={styles.caixaNumero}>{caixa}</Text>
        </View>
      ) : null}
    </View>
  );
}

function CabecalhoBloco({ numero, bloco }: { numero: number; bloco: BlocoMapaColeta }) {
  const texto = TEXTO_BLOCO_MAPA_COLETA[bloco];
  return (
    <View wrap={false}>
      <Text style={styles.blocoTitulo}>
        {numero}. {texto.titulo}
      </Text>
      <Text style={styles.blocoDescricao}>{texto.descricao}</Text>
    </View>
  );
}

export function MapaColetaPdfDocument({
  vitrine,
  mapa,
  tituloVitrineAnterior,
  gabarito,
  thumbs,
  imageDataUrls = {},
}: {
  vitrine: Vitrine;
  mapa: MapaColetaVitrine;
  tituloVitrineAnterior?: string | null;
  gabarito: MapaColetaGabaritoItem[];
  thumbs?: Record<string, string> | null;
  imageDataUrls?: Record<string, string>;
}) {
  const { grupos, blocos, semMudancas } = organizarMapaColeta(mapa, gabarito);
  const numero = (bloco: BlocoMapaColeta) => blocos.indexOf(bloco) + 1;
  const novaPagina = (bloco: BlocoMapaColeta) => blocos.indexOf(bloco) > 0;
  const linha = { thumbs, imageDataUrls };

  return (
    <Document title={`Mapa de coleta — ${vitrine.titulo}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHeader} fixed>
          <View style={styles.pageHeaderLeft}>
            <Text style={styles.pageTitle}>Mapa de coleta</Text>
            <Text style={styles.pageMeta}>
              {vitrine.titulo}
              {vitrine.publicado_em ? ` · Publicada em ${formatarData(vitrine.publicado_em)}` : ""}
            </Text>
          </View>
          <View style={styles.pageStats}>
            <Text style={styles.pageStat}>{mapa.saidas.length} saindo</Text>
            <Text style={styles.pageStat}>{mapa.entradas.length} entrando</Text>
            {mapa.trocas_caixa.length > 0 ? (
              <Text style={styles.pageStat}>{mapa.trocas_caixa.length} mudando de caixa</Text>
            ) : null}
          </View>
        </View>

        {mapa.reconstruido ? <Text style={styles.aviso}>{AVISO_MAPA_RECONSTRUIDO}</Text> : null}
        {semMudancas ? (
          <Text style={styles.detalhe}>Nenhum par entra, sai ou muda de caixa nesta vitrine.</Text>
        ) : null}

        {blocos.includes("tirar") ? (
          <View style={styles.bloco} break={novaPagina("tirar")}>
            <CabecalhoBloco numero={numero("tirar")} bloco="tirar" />
            <View style={styles.faixaAnterior} wrap={false}>
              <Text style={styles.faixaAnteriorRotulo}>SAEM DA VITRINE ANTERIOR PARA MONTAR A VITRINE ATUAL</Text>
              <Text style={styles.faixaAnteriorTexto}>
                {tituloVitrineAnterior ?? "Vitrine anterior"} → {vitrine.titulo}
              </Text>
            </View>
            <View style={styles.lista}>
              {mapa.saidas.map((item, index) => (
                <LinhaPdf
                  key={item.id_item_estoque}
                  item={item}
                  primeira={index === 0}
                  caixa={item.caixa_origem}
                  rotuloCaixa="SAI DA CAIXA"
                  etiqueta={etiquetaDestino(item)}
                  {...linha}
                />
              ))}
            </View>
          </View>
        ) : null}

        {blocos.includes("roteiro") ? (
          <View style={styles.bloco} break={novaPagina("roteiro")}>
            <CabecalhoBloco numero={numero("roteiro")} bloco="roteiro" />
            {grupos.map((grupo, indiceGrupo) => {
              const semLocal = grupo.chave === SEM_LOCAL;
              return (
                <View
                  key={grupo.chave}
                  style={semLocal ? [styles.grupo, styles.grupoSemLocal] : styles.grupo}
                  break={indiceGrupo > 0}
                >
                  <View
                    style={semLocal ? [styles.grupoHeader, styles.grupoHeaderSemLocal] : styles.grupoHeader}
                    wrap={false}
                  >
                    <Text style={styles.grupoNome}>{grupo.nome}</Text>
                    <Text style={styles.grupoResumo}>{resumoGrupoLocal(grupo)}</Text>
                  </View>
                  <Text style={styles.subLista}>PEGAR AQUI</Text>
                  {grupo.itens.map((item, index) => (
                    <LinhaPdf
                      key={item.id_item_estoque}
                      item={item}
                      primeira={index === 0}
                      caixa={item.caixa_destino}
                      rotuloCaixa="VAI PARA A CAIXA"
                      {...linha}
                    />
                  ))}
                </View>
              );
            })}
          </View>
        ) : null}

        {blocos.includes("trocar") ? (
          <View style={styles.bloco} break={novaPagina("trocar")}>
            <CabecalhoBloco numero={numero("trocar")} bloco="trocar" />
            <View style={styles.lista}>
              {mapa.trocas_caixa.map((item, index) => (
                <LinhaPdf
                  key={item.id_item_estoque}
                  item={item}
                  primeira={index === 0}
                  caixa={item.caixa_destino}
                  detalhe={`Da caixa ${item.caixa_origem ?? "—"} para a caixa ${item.caixa_destino ?? "—"}`}
                  {...linha}
                />
              ))}
            </View>
          </View>
        ) : null}

        {blocos.includes("gabarito") ? (
          <View style={styles.bloco} break={novaPagina("gabarito")}>
            <CabecalhoBloco numero={numero("gabarito")} bloco="gabarito" />
            <View style={styles.lista}>
              {gabarito.map((item, index) => (
                <LinhaPdf
                  key={item.id_item_estoque}
                  item={item}
                  primeira={index === 0}
                  caixa={item.caixa_destino}
                  etiqueta={{
                    texto: ROTULO_SITUACAO_GABARITO[item.situacao],
                    tom: TOM_SITUACAO_GABARITO[item.situacao],
                  }}
                  {...linha}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>KropFeet · Mapa de coleta · {vitrine.titulo}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
