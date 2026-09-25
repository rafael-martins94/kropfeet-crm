import { supabase } from "../lib/supabase";
import type { ImagemModeloProduto } from "../types/entities";
import {
  extensaoPorMime,
  hashArquivoSha256Hex,
  montarCaminhoArquivoModelo,
  urlPublicaStorage,
} from "../utils/storageImagens";
import { env } from "../lib/env";

const BUCKET = env.supabase.bucketImagens;

export const imagensModeloProdutoService = {
  uploadArquivo: async (
    idModelo: string,
    file: File,
    opts?: { ordem?: number; imagemPrincipal?: boolean },
  ): Promise<ImagemModeloProduto> => {
    const buffer = await file.arrayBuffer();
    const hash = await hashArquivoSha256Hex(buffer);
    const mimeType = file.type || `image/${extensaoPorMime(file.name.split(".").pop() ?? "bin")}`;
    const caminhoArquivo = montarCaminhoArquivoModelo(idModelo, hash, mimeType);

    const upload = await supabase.storage.from(BUCKET).upload(caminhoArquivo, buffer, {
      contentType: mimeType,
      upsert: false,
      cacheControl: "31536000",
    });

    if (upload.error && !/already exists|duplicate|resource already exists/i.test(upload.error.message)) {
      throw upload.error;
    }

    const urlPublica = urlPublicaStorage(caminhoArquivo);

    const { data, error } = await supabase
      .from("imagens_modelo_produto")
      .insert({
        id_modelo_produto: idModelo,
        tipo_origem: "upload_manual",
        caminho_arquivo: caminhoArquivo,
        hash_arquivo: hash,
        url_origem: urlPublica,
        ordem_exibicao: opts?.ordem ?? 0,
        imagem_principal: opts?.imagemPrincipal ?? false,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },

  adicionarUrlExterna: async (
    idModelo: string,
    url: string,
    opts?: { ordem?: number; imagemPrincipal?: boolean },
  ): Promise<ImagemModeloProduto> => {
    const urlLimpa = url.trim();
    const { data, error } = await supabase
      .from("imagens_modelo_produto")
      .insert({
        id_modelo_produto: idModelo,
        tipo_origem: "url_externa",
        url_origem: urlLimpa,
        ordem_exibicao: opts?.ordem ?? 0,
        imagem_principal: opts?.imagemPrincipal ?? false,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },

  definirPrincipal: async (idModelo: string, idImagem: string): Promise<void> => {
    const { error: limparError } = await supabase
      .from("imagens_modelo_produto")
      .update({ imagem_principal: false })
      .eq("id_modelo_produto", idModelo);

    if (limparError) throw limparError;

    const { error } = await supabase
      .from("imagens_modelo_produto")
      .update({ imagem_principal: true })
      .eq("id", idImagem)
      .eq("id_modelo_produto", idModelo);

    if (error) throw error;
  },

  remover: async (imagem: Pick<ImagemModeloProduto, "id" | "caminho_arquivo">): Promise<void> => {
    const { error } = await supabase.from("imagens_modelo_produto").delete().eq("id", imagem.id);
    if (error) throw error;

    if (imagem.caminho_arquivo && !imagem.caminho_arquivo.startsWith("http")) {
      await supabase.storage.from(BUCKET).remove([imagem.caminho_arquivo]);
    }
  },

  reordenar: async (ordens: { id: string; ordem: number }[]): Promise<void> => {
    await Promise.all(
      ordens.map(async ({ id, ordem }) => {
        const { error } = await supabase
          .from("imagens_modelo_produto")
          .update({ ordem_exibicao: ordem })
          .eq("id", id);
        if (error) throw error;
      }),
    );
  },

  sincronizarPendentes: async (
    idModelo: string,
    itens: { file: File; ordem: number; principal: boolean }[],
  ): Promise<void> => {
    let idPrincipal: string | null = null;

    for (const item of itens) {
      const criada = await imagensModeloProdutoService.uploadArquivo(idModelo, item.file, {
        ordem: item.ordem,
        imagemPrincipal: false,
      });
      if (item.principal) idPrincipal = criada.id;
    }

    if (idPrincipal) {
      await imagensModeloProdutoService.definirPrincipal(idModelo, idPrincipal);
    }
  },
};
