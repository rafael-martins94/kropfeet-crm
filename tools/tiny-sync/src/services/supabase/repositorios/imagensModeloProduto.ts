import { env } from "../../../config/env.js";
import type { ImagemParseada } from "../../tiny/tinyParser.js";
import { logger } from "../../../utils/logger.js";
import { comRetry } from "../../../utils/retry.js";
import type { SupabaseAppClient } from "../clienteSupabase.js";
import {
  baixarEArmazenarImagemDoModelo,
  ImagemDownloadError,
} from "../storageImagens.js";

export interface ResultadoSyncImagens {
  recebidas: number;
  criadas: number;
  atualizadas: number;
  ignoradas: number;
  falhas: number;
}

interface LinhaImagemExistente {
  id: string;
  url_origem: string | null;
  hash_arquivo: string | null;
  caminho_arquivo: string | null;
  imagem_principal: boolean;
}

function indexarExistentes(linhas: LinhaImagemExistente[]): {
  porUrl: Map<string, LinhaImagemExistente>;
  porHash: Map<string, LinhaImagemExistente>;
  possuiPrincipal: boolean;
} {
  const porUrl = new Map<string, LinhaImagemExistente>();
  const porHash = new Map<string, LinhaImagemExistente>();
  let possuiPrincipal = false;

  for (const l of linhas) {
    if (l.url_origem) porUrl.set(l.url_origem, l);
    if (l.hash_arquivo) porHash.set(l.hash_arquivo, l);
    if (l.imagem_principal) possuiPrincipal = true;
  }
  return { porUrl, porHash, possuiPrincipal };
}

async function registrarImagemSomenteUrl(
  supabase: SupabaseAppClient,
  idModelo: string,
  img: ImagemParseada,
  ordem: number,
  imagemPrincipal: boolean,
): Promise<"criada" | "falha"> {
  const ins = await supabase.from("imagens_modelo_produto").insert({
    id_modelo_produto: idModelo,
    tipo_origem: "tiny",
    url_origem: img.url,
    ordem_exibicao: ordem,
    imagem_principal: imagemPrincipal,
  });
  if (ins.error) {
    logger.warn("Falha ao inserir registro de imagem (modo URL)", {
      idModelo,
      url: img.url,
      erro: ins.error.message,
    });
    return "falha";
  }
  return "criada";
}

export async function sincronizarImagensDoModelo(
  supabase: SupabaseAppClient,
  idModelo: string,
  imagens: ImagemParseada[],
): Promise<ResultadoSyncImagens> {
  const stats: ResultadoSyncImagens = {
    recebidas: imagens.length,
    criadas: 0,
    atualizadas: 0,
    ignoradas: 0,
    falhas: 0,
  };
  if (imagens.length === 0) return stats;

  const resp = await supabase
    .from("imagens_modelo_produto")
    .select("id, url_origem, hash_arquivo, caminho_arquivo, imagem_principal")
    .eq("id_modelo_produto", idModelo)
    .eq("tipo_origem", "tiny");

  if (resp.error) throw resp.error;

  const { porUrl, porHash, possuiPrincipal } = indexarExistentes(resp.data ?? []);
  let precisaDefinirPrincipal = !possuiPrincipal;

  for (let i = 0; i < imagens.length; i += 1) {
    const img = imagens[i];
    if (!img) continue;

    if (!env.imagens.habilitado) {
      if (porUrl.has(img.url)) {
        stats.ignoradas += 1;
        continue;
      }
      const r = await registrarImagemSomenteUrl(
        supabase,
        idModelo,
        img,
        i,
        precisaDefinirPrincipal,
      );
      if (r === "criada") {
        stats.criadas += 1;
        precisaDefinirPrincipal = false;
      } else {
        stats.falhas += 1;
      }
      continue;
    }

    try {
      const arquivo = await comRetry(
        () => baixarEArmazenarImagemDoModelo(supabase, img.url, idModelo),
        {
          tentativas: env.imagens.maxRetries,
          delayInicialMs: 1000,
          fatorBackoff: 2,
          deveTentarNovamente: (erro) =>
            erro instanceof ImagemDownloadError ? erro.temporario : true,
          rotulo: `imagem ${img.url}`,
        },
      );

      const existente = porHash.get(arquivo.hashArquivo) ?? porUrl.get(img.url);

      if (existente) {
        const precisaAtualizar =
          existente.caminho_arquivo !== arquivo.caminhoArquivo ||
          existente.hash_arquivo !== arquivo.hashArquivo ||
          existente.url_origem !== img.url;

        if (!precisaAtualizar) {
          stats.ignoradas += 1;
          continue;
        }

        const upd = await supabase
          .from("imagens_modelo_produto")
          .update({
            caminho_arquivo: arquivo.caminhoArquivo,
            hash_arquivo: arquivo.hashArquivo,
            url_origem: img.url,
          })
          .eq("id", existente.id);

        if (upd.error) {
          logger.warn("Falha ao atualizar registro de imagem", {
            idModelo,
            idImagem: existente.id,
            erro: upd.error.message,
          });
          stats.falhas += 1;
          continue;
        }
        stats.atualizadas += 1;
      } else {
        const ins = await supabase
          .from("imagens_modelo_produto")
          .insert({
            id_modelo_produto: idModelo,
            tipo_origem: "tiny",
            url_origem: img.url,
            caminho_arquivo: arquivo.caminhoArquivo,
            hash_arquivo: arquivo.hashArquivo,
            ordem_exibicao: i,
            imagem_principal: precisaDefinirPrincipal,
          });

        if (ins.error) {
          logger.warn("Falha ao inserir registro de imagem", {
            idModelo,
            url: img.url,
            erro: ins.error.message,
          });
          stats.falhas += 1;
          continue;
        }
        stats.criadas += 1;
        porHash.set(arquivo.hashArquivo, {
          id: "pendente",
          url_origem: img.url,
          hash_arquivo: arquivo.hashArquivo,
          caminho_arquivo: arquivo.caminhoArquivo,
          imagem_principal: precisaDefinirPrincipal,
        });
        precisaDefinirPrincipal = false;
      }
    } catch (erro) {
      stats.falhas += 1;
      logger.warn("Falha ao processar imagem", {
        idModelo,
        url: img.url,
        erro: erro instanceof Error ? erro.message : String(erro),
      });
    }
  }

  return stats;
}
