import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { SecondaryButton } from "../PrimaryButton";
import { IconChevronLeft, IconChevronRight, IconImage, IconTrash } from "../Icons";
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
  ordemExibicao?: number;
};

type ModeloImagensFormProps = {
  idModelo?: string;
  pendentes: ImagemPendente[];
  onPendentesChange: (next: ImagemPendente[]) => void;
  indicePrincipalPendente: number;
  onIndicePrincipalPendenteChange: (index: number) => void;
  onImagensSalvasChange?: () => void;
};

type ItemGrade =
  | { id: string; tipo: "pendente"; pendente: ImagemPendente }
  | { id: string; tipo: "salva"; imagem: ImagemModeloProduto };

const TIPOS_ACEITOS = "image/jpeg,image/png,image/webp,image/gif";

function revogarPreviews(lista: ImagemPendente[]) {
  for (const item of lista) URL.revokeObjectURL(item.previewUrl);
}

function ordenarSalvas(lista: ImagemModeloProduto[]) {
  return [...lista].sort((a, b) => {
    if (a.ordem_exibicao !== b.ordem_exibicao) return a.ordem_exibicao - b.ordem_exibicao;
    if (a.imagem_principal !== b.imagem_principal) return a.imagem_principal ? -1 : 1;
    return a.criado_em.localeCompare(b.criado_em);
  });
}

function pendentesNaOrdem(ids: string[], lista: ImagemPendente[]) {
  const porId = new Map(lista.map((item) => [item.id, item]));
  const ordenados: ImagemPendente[] = [];
  ids.forEach((id, ordem) => {
    const item = porId.get(id);
    if (!item) return;
    ordenados.push({ ...item, ordemExibicao: ordem });
  });
  for (const item of lista) {
    if (ids.includes(item.id)) continue;
    ordenados.push({ ...item, ordemExibicao: ordenados.length });
  }
  return ordenados;
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
  const [ordemIds, setOrdemIds] = useState<string[]>([]);

  const salvas = useAsync(
    () => (idModelo ? modelosProdutoService.obterImagens(idModelo) : Promise.resolve([])),
    [idModelo],
  );

  const salvasLista = salvas.data ?? [];
  const idsSalvas = salvasLista.map((img) => img.id).join("|");
  const idsPendentes = pendentes.map((item) => item.id).join("|");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (idModelo && salvas.loading && !salvas.data) return;
    const idsSalvasArr = salvasLista.map((img) => img.id);
    const idsPendArr = pendentes.map((item) => item.id);
    const validos = new Set([...idsSalvasArr, ...idsPendArr]);
    setOrdemIds((atual) => {
      const base =
        atual.length === 0
          ? [...ordenarSalvas(salvasLista).map((img) => img.id), ...idsPendArr]
          : [
              ...atual.filter((id) => validos.has(id)),
              ...[...idsSalvasArr, ...idsPendArr].filter((id) => !atual.includes(id)),
            ];
      if (base.length === atual.length && base.every((id, index) => id === atual[index])) return atual;
      return base;
    });
  }, [idModelo, idsSalvas, idsPendentes, salvas.loading, salvas.data, salvasLista, pendentes]);

  useEffect(() => {
    const ordenados = pendentes.length > 0 ? pendentesNaOrdem(ordemIds, pendentes) : [];
    const indiceFinal = ordemIds[0] ? ordenados.findIndex((item) => item.id === ordemIds[0]) : -1;
    const mesmaLista =
      pendentes.length === 0 ||
      (ordenados.length === pendentes.length &&
        ordenados.every(
          (item, index) =>
            item.id === pendentes[index]?.id && item.ordemExibicao === pendentes[index]?.ordemExibicao,
        ));

    if (!mesmaLista) onPendentesChange(ordenados);
    if (indiceFinal !== indicePrincipalPendente) onIndicePrincipalPendenteChange(indiceFinal);
  }, [
    ordemIds,
    pendentes,
    indicePrincipalPendente,
    onPendentesChange,
    onIndicePrincipalPendenteChange,
  ]);

  const aplicarOrdem = async (nextIds: string[]) => {
    setOrdemIds(nextIds);
    if (!idModelo) return;

    const porId = new Map(salvasLista.map((img) => [img.id, img]));
    const updates = nextIds.flatMap((id, ordem) => {
      const img = porId.get(id);
      if (!img || img.ordem_exibicao === ordem) return [];
      return [{ id, ordem }];
    });
    const primeira = porId.get(nextIds[0] ?? "");
    const marcarPrincipal = Boolean(primeira && !primeira.imagem_principal);
    if (updates.length === 0 && !marcarPrincipal) return;

    setProcessando(true);
    setErro(null);
    try {
      if (updates.length > 0) await imagensModeloProdutoService.reordenar(updates);
      if (marcarPrincipal && primeira) {
        await imagensModeloProdutoService.definirPrincipal(idModelo, primeira.id);
      }
      onImagensSalvasChange?.();
      salvas.reload();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao reordenar fotos.");
    } finally {
      setProcessando(false);
    }
  };

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
    const alvo = pendentes.find((item) => item.id === id);
    if (alvo) URL.revokeObjectURL(alvo.previewUrl);
    onPendentesChange(pendentes.filter((item) => item.id !== id));
  };

  const removerSalva = async (img: ImagemModeloProduto) => {
    if (!idModelo || processando) return;
    if (!window.confirm("Remover esta foto do modelo?")) return;
    setProcessando(true);
    setErro(null);
    try {
      await imagensModeloProdutoService.remover(img);
      const restantes = ordemIds.filter((id) => id !== img.id);
      setOrdemIds(restantes);
      const novaPrimeira = salvasLista.find((item) => item.id === restantes[0]);
      if (novaPrimeira && !novaPrimeira.imagem_principal) {
        await imagensModeloProdutoService.definirPrincipal(idModelo, novaPrimeira.id);
      }
      onImagensSalvasChange?.();
      salvas.reload();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao remover foto.");
    } finally {
      setProcessando(false);
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    if (processando) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const origem = ordemIds.indexOf(String(active.id));
    const destino = ordemIds.indexOf(String(over.id));
    if (origem < 0 || destino < 0) return;
    void aplicarOrdem(arrayMove(ordemIds, origem, destino));
  };

  const mover = (id: string, delta: number) => {
    if (processando) return;
    const origem = ordemIds.indexOf(id);
    const destino = origem + delta;
    if (origem < 0 || destino < 0 || destino >= ordemIds.length) return;
    void aplicarOrdem(arrayMove(ordemIds, origem, destino));
  };

  const porSalva = new Map(salvasLista.map((img) => [img.id, img]));
  const porPendente = new Map(pendentes.map((item) => [item.id, item]));
  const itens: ItemGrade[] = ordemIds.flatMap((id): ItemGrade[] => {
    const imagem = porSalva.get(id);
    if (imagem) return [{ id, tipo: "salva" as const, imagem }];
    const pendente = porPendente.get(id);
    if (pendente) return [{ id, tipo: "pendente" as const, pendente }];
    return [];
  });
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-ink">Fotos do modelo</p>
        <p className="mt-1 text-xs text-ink-soft">
          Envie imagens do produto. Arraste qualquer parte da foto, ou use as setas, para mudar a
          ordem. A primeira foto é sempre a principal e aparece nas listas.
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
          if (e.dataTransfer.files?.length) adicionarArquivos(e.dataTransfer.files);
        }}
      >
        <IconImage width={28} height={28} className="text-ink-faint" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-ink">Solte fotos aqui para enviar</p>
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

      {idModelo && salvas.loading && !salvas.data ? (
        <p className="text-sm text-ink-soft">Carregando fotos salvas…</p>
      ) : null}

      {itens.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={itens.map((item) => item.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {itens.map((item, index) => {
                const principal = index === 0;
                if (item.tipo === "pendente") {
                  return (
                    <MiniaturaImagem
                      key={item.id}
                      id={item.id}
                      src={item.pendente.previewUrl}
                      posicao={index + 1}
                      principal={principal}
                      nova={!principal}
                      podeMover={itens.length > 1}
                      primeira={principal}
                      ultima={index === itens.length - 1}
                      disabled={processando}
                      onMover={(delta) => mover(item.id, delta)}
                      onRemover={() => removerPendente(item.id)}
                    />
                  );
                }

                const src = urlImagemModelo(item.imagem);
                return (
                  <MiniaturaImagem
                    key={item.id}
                    id={item.id}
                    src={src}
                    posicao={index + 1}
                    principal={principal}
                    podeMover={itens.length > 1}
                    primeira={principal}
                    ultima={index === itens.length - 1}
                    disabled={processando}
                    onMover={(delta) => mover(item.id, delta)}
                    onRemover={() => void removerSalva(item.imagem)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      ) : null}

      {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
    </div>
  );
}

function MiniaturaImagem({
  id,
  src,
  posicao,
  principal,
  nova = false,
  podeMover,
  primeira,
  ultima,
  onMover,
  onRemover,
  disabled,
}: {
  id: string;
  src: string | null;
  posicao: number;
  principal: boolean;
  nova?: boolean;
  podeMover: boolean;
  primeira: boolean;
  ultima: boolean;
  onMover: (delta: number) => void;
  onRemover: () => void;
  disabled?: boolean;
}) {
  const arrastavel = podeMover && !disabled;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !arrastavel,
  });
  const impedirArraste = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.65 : 1,
        zIndex: isDragging ? 2 : undefined,
      }}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-lg border bg-surface-subtle",
        principal ? "border-brand-500 ring-2 ring-brand-500/25" : "border-line",
        arrastavel && "cursor-grab touch-none active:cursor-grabbing",
      )}
      {...(arrastavel
        ? {
            ...attributes,
            ...listeners,
            "aria-label": `Foto ${posicao}. Arraste para mudar a posição.`,
          }
        : {})}
    >
      {src ? (
        <img
          src={src}
          alt=""
          draggable={false}
          className="pointer-events-none h-full w-full object-contain"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-ink-faint">
          <IconImage width={20} height={20} />
        </div>
      )}

      <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ink/80 px-1 text-[0.65rem] font-semibold text-white">
          {posicao}
        </span>
        {principal ? (
          <span className="rounded-full bg-brand-900/85 px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wide text-white">
            Principal
          </span>
        ) : nova ? (
          <span className="rounded-full bg-ink/70 px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wide text-white">
            Nova
          </span>
        ) : null}
      </div>

      <div className="absolute inset-x-1 bottom-1 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
        {podeMover ? (
          <button
            type="button"
            disabled={disabled || primeira}
            className="rounded-md bg-surface/95 p-1 text-ink shadow-sm hover:bg-brand-50 disabled:opacity-40"
            aria-label={`Mover foto ${posicao} para a posição anterior`}
            onPointerDown={impedirArraste}
            onClick={() => onMover(-1)}
          >
            <IconChevronLeft width={14} height={14} />
          </button>
        ) : null}
        <span className="flex-1" />
        {podeMover ? (
          <button
            type="button"
            disabled={disabled || ultima}
            className="rounded-md bg-surface/95 p-1 text-ink shadow-sm hover:bg-brand-50 disabled:opacity-40"
            aria-label={`Mover foto ${posicao} para a próxima posição`}
            onPointerDown={impedirArraste}
            onClick={() => onMover(1)}
          >
            <IconChevronRight width={14} height={14} />
          </button>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          className="rounded-md bg-surface/95 p-1 text-ink shadow-sm hover:text-red-600"
          aria-label="Remover foto"
          onPointerDown={impedirArraste}
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
