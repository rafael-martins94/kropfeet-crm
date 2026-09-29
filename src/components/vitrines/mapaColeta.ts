import type { MapaColetaGabaritoItem, MapaColetaItem, MapaColetaVitrine } from "../../services/vitrines";

export const SEM_LOCAL = "__sem_local__";

export interface GrupoLocalMapaColeta {
  chave: string;
  nome: string;
  itens: MapaColetaItem[];
}

export type BlocoMapaColeta = "tirar" | "roteiro" | "trocar" | "gabarito";

export interface MapaColetaOrganizado {
  grupos: GrupoLocalMapaColeta[];
  blocos: BlocoMapaColeta[];
  semMudancas: boolean;
}

function agruparEntradasPorLocal(entradas: MapaColetaItem[]): GrupoLocalMapaColeta[] {
  const grupos = new Map<string, GrupoLocalMapaColeta>();
  for (const item of entradas) {
    const chave = item.id_local ?? SEM_LOCAL;
    const atual = grupos.get(chave);
    if (atual) atual.itens.push(item);
    else grupos.set(chave, { chave, nome: item.local_nome ?? "Local de origem não registrado", itens: [item] });
  }

  return [...grupos.values()].sort((a, b) => {
    if (a.chave === SEM_LOCAL) return 1;
    if (b.chave === SEM_LOCAL) return -1;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

export function organizarMapaColeta(
  mapa: MapaColetaVitrine,
  gabarito: MapaColetaGabaritoItem[],
): MapaColetaOrganizado {
  const grupos = agruparEntradasPorLocal(mapa.entradas);
  const semMudancas = mapa.saidas.length === 0 && mapa.entradas.length === 0 && mapa.trocas_caixa.length === 0;
  const blocos = [
    mapa.saidas.length > 0 ? "tirar" : null,
    grupos.length > 0 ? "roteiro" : null,
    mapa.trocas_caixa.length > 0 ? "trocar" : null,
    gabarito.length > 0 ? "gabarito" : null,
  ].filter((bloco): bloco is BlocoMapaColeta => bloco != null);

  return { grupos, blocos, semMudancas };
}

export function resumoGrupoLocal(grupo: GrupoLocalMapaColeta): string {
  return `pegar ${grupo.itens.length}`;
}

export function destinoItemMapaColeta(item: MapaColetaItem): string {
  return item.local_nome ?? "Destino não registrado";
}

export function tituloItemMapaColeta(item: MapaColetaItem): string {
  return item.nome_modelo?.trim() || item.nome?.trim() || "Item";
}

export const ROTULO_SITUACAO_GABARITO: Record<MapaColetaGabaritoItem["situacao"], string> = {
  nova: "Entra agora",
  mudou_caixa: "Mudou de caixa",
  continua: "Continua",
  vendida: "Vendido · caixa vazia",
};

export interface EtiquetaMapaColeta {
  rotulo?: string;
  texto: string;
  tom: "destaque" | "aviso" | "neutro";
}

export const TOM_SITUACAO_GABARITO: Record<MapaColetaGabaritoItem["situacao"], EtiquetaMapaColeta["tom"]> = {
  nova: "destaque",
  mudou_caixa: "destaque",
  continua: "neutro",
  vendida: "aviso",
};

export function etiquetaDestino(item: MapaColetaItem): EtiquetaMapaColeta {
  return { rotulo: "Vai para", texto: destinoItemMapaColeta(item), tom: item.local_nome ? "destaque" : "aviso" };
}

export const TEXTO_BLOCO_MAPA_COLETA: Record<BlocoMapaColeta, { titulo: string; descricao: string }> = {
  tirar: {
    titulo: "Tirar da vitrine anterior",
    descricao:
      "Estes pares estavam expostos na vitrine anterior e saem para dar lugar à vitrine atual. Esvazie as caixas e leve cada par para o local indicado.",
  },
  roteiro: {
    titulo: "Roteiro por local · vitrine atual",
    descricao:
      "Pares que vão entrar na vitrine atual, agrupados pelo local onde estão. Em cada local, pegue todos os pares do cartão.",
  },
  trocar: {
    titulo: "Mudar de caixa",
    descricao: "Pares que continuam na vitrine, mas em outra caixa.",
  },
  gabarito: {
    titulo: "Gabarito",
    descricao: "Como cada uma das caixas deve ficar na vitrine atual. Use para conferir no final.",
  },
};

export const AVISO_MAPA_RECONSTRUIDO =
  "Vitrine publicada antes do mapa existir. O local de origem dos pares que entraram não foi registrado.";
