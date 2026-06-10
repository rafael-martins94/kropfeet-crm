type ImagemComUrl = {
  url_origem?: string | null;
  caminho_arquivo?: string | null;
};

export function urlImagemModelo(imagem: ImagemComUrl | null | undefined): string | null {
  if (!imagem) return null;
  return imagem.url_origem ?? imagem.caminho_arquivo ?? null;
}
