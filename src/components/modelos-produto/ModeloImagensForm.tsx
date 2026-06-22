import { useRef, useState } from "react";
import { SecondaryButton } from "../PrimaryButton";
import { IconImage, IconTrash } from "../Icons";
import { imagensModeloProdutoService } from "../../services/imagens-modelo-produto";
import { modelosProdutoService } from "../../services/modelos-produto";
import { useAsync } from "../../hooks/useAsync";
import { cn } from "../../utils/cn";
import { urlImagemModelo } from "../../utils/imagemModelo";
import type { ImagemModeloProduto } from "../../types/entities";

export type ImagemPendente = {
  id: string;
  file: File;
  previewUrl: string;
};

type ModeloImagensFormProps = {
  idModelo?: string;
  pendentes: ImagemPendente[];
  onPendentesChange: (next: ImagemPendente[]) => void;
  indicePrincipalPendente: number;
  onIndicePrincipalPendenteChange: (index: number) => void;
  onImagensSalvasChange?: () => void;
};

const TIPOS_ACEITOS = "image/jpeg,image/png,image/webp,image/gif";

function revogarPreviews(lista: ImagemPendente[]) {
  for (const item of lista) URL.revokeObjectURL(item.previewUrl);
}

export function ModeloImagensForm({
  idModelo,
  pendentes,
  onPendentesChange,
  indicePrincipalPendente,
  onIndicePrincipalPendenteChange,
  onImagensSalvasChange,
}: ModeloImagensFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  const salvas = useAsync(
    () => (idModelo ? modelosProdutoService.obterImagens(idModelo) : Promise.resolve([])),
    [idModelo],
  );

  const adicionarArquivos = (files: FileList | File[]) => {
    setErro(null);
    const novos: ImagemPendente[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      novos.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    if (novos.length === 0) {
      setErro("Selecione arquivos de imagem (JPG, PNG, WebP ou GIF).");
      return;
    }
    onPendentesChange([...pendentes, ...novos]);
  };

  const removerPendente = (id: string) => {
    const alvo = pendentes.find((p) => p.id === id);
    if (alvo) URL.revokeObjectURL(alvo.previewUrl);
    const next = pendentes.filter((p) => p.id !== id);
    onPendentesChange(next);
    if (indicePrincipalPendente >= next.length) {
      onIndicePrincipalPendenteChange(Math.max(0, next.length - 1));
    }
  };

  const definirPrincipalSalva = async (img: ImagemModeloProduto) => {
    if (!idModelo) return;
    setProcessando(true);
    setErro(null);
    try {
      await imagensModeloProdutoService.definirPrincipal(idModelo, img.id);
      onImagensSalvasChange?.();
      salvas.reload();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao definir foto principal.");
    } finally {
      setProcessando(false);
    }
  };

  const removerSalva = async (img: ImagemModeloProduto) => {
    if (!idModelo) return;
    if (!window.confirm("Remover esta foto do modelo?")) return;
    setProcessando(true);
    setErro(null);
    try {
      await imagensModeloProdutoService.remover(img);
      onImagensSalvasChange?.();
      salvas.reload();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao remover foto.");
    } finally {
      setProcessando(false);
    }
  };

  const totalPendentes = pendentes.length;
  const totalSalvas = salvas.data?.length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-ink">Fotos do modelo</p>
        <p className="mt-1 text-xs text-ink-soft">
          Envie imagens do produto. A foto principal aparece nas listas e seletores.
        </p>
      </div>

      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-line bg-surface-subtle/40 px-4 py-8 text-center transition",
          "hover:border-brand-400 hover:bg-brand-50/30",
        )}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (processando) return;
          adicionarArquivos(e.dataTransfer.files);
        }}
      >
        <IconImage width={28} height={28} className="text-ink-faint" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-ink">Arraste fotos aqui</p>
          <p className="text-xs text-ink-soft">JPG, PNG, WebP ou GIF</p>
        </div>
        <SecondaryButton
          type="button"
          disabled={processando}
          onClick={() => inputRef.current?.click()}
        >
          Escolher arquivos
        </SecondaryButton>
        <input
          ref={inputRef}
          type="file"
          accept={TIPOS_ACEITOS}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) adicionarArquivos(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {totalPendentes > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Aguardando envio ({totalPendentes})
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {pendentes.map((item, index) => (
              <MiniaturaImagem
                key={item.id}
                src={item.previewUrl}
                principal={index === indicePrincipalPendente}
                onPrincipal={() => onIndicePrincipalPendenteChange(index)}
                onRemover={() => removerPendente(item.id)}
                disabled={processando}
              />
            ))}
          </div>
        </div>
      ) : null}

      {idModelo && salvas.loading ? (
        <p className="text-sm text-ink-soft">Carregando fotos salvas…</p>
      ) : null}

      {idModelo && totalSalvas > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Fotos salvas ({totalSalvas})
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(salvas.data ?? []).map((img) => {
              const src = urlImagemModelo(img);
              return (
                <MiniaturaImagem
                  key={img.id}
                  src={src}
                  principal={img.imagem_principal}
                  onPrincipal={() => void definirPrincipalSalva(img)}
                  onRemover={() => void removerSalva(img)}
                  disabled={processando}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
    </div>
  );
}

function MiniaturaImagem({
  src,
  principal,
  onPrincipal,
  onRemover,
  disabled,
}: {
  src: string | null;
  principal: boolean;
  onPrincipal: () => void;
  onRemover: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative aspect-square overflow-hidden rounded-lg border bg-surface-subtle",
        principal ? "border-brand-500 ring-2 ring-brand-500/25" : "border-line",
      )}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-contain" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-ink-faint">
          <IconImage width={20} height={20} />
        </div>
      )}

      {principal ? (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-brand-900/85 px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wide text-white">
          Principal
        </span>
      ) : null}

      <div className="absolute inset-x-1 bottom-1 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
        {!principal ? (
          <button
            type="button"
            disabled={disabled}
            className="flex-1 rounded-md bg-surface/95 px-1 py-1 text-[0.62rem] font-medium text-ink shadow-sm hover:bg-brand-50"
            onClick={onPrincipal}
          >
            Principal
          </button>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          className="rounded-md bg-surface/95 p-1 text-ink shadow-sm hover:text-red-600"
          aria-label="Remover foto"
          onClick={onRemover}
        >
          <IconTrash width={14} height={14} />
        </button>
      </div>
    </div>
  );
}

export function limparImagensPendentes(pendentes: ImagemPendente[]) {
  revogarPreviews(pendentes);
}
