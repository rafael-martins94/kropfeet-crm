import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  catalogoKropCafeService,
  type ItemCatalogoKropCafePublico,
} from "../services/catalogo-kropcafe";
import { SalvarSelecaoModal } from "../components/catalogo/SalvarSelecaoModal";
import { cn } from "../utils/cn";
import { mensagemErro } from "../utils/errors";
import { formatarMoeda } from "../utils/format";
import {
  SHOE_SIZE_EQUIVALENCE_TABLE,
  type DisplaySizeSystem,
} from "../utils/sizeConversion";

type RegiaoCatalogo = "brasil" | "europa" | "usa";
type SegmentoCatalogo = "adult" | "adult_w" | "youth" | "kids";
type IdiomaCatalogo = "pt" | "en" | "es" | "fr";

type RegiaoConfig = {
  label: string;
  description: string;
  displaySystem: DisplaySizeSystem;
  segmentos: Array<{ id: SegmentoCatalogo; label: string; description: string; tamanhos: string[] }>;
};

type CatalogoState = {
  itens: ItemCatalogoKropCafePublico[];
  fotos: Record<string, string[]>;
};

const ETAPAS = [1, 2, 3, 4, 5] as const;

type ItemSelecionadoCatalogo = {
  item: ItemCatalogoKropCafePublico;
  fotos: string[];
  numeracaoLabel: string;
};

const REGIOES: Record<RegiaoCatalogo, RegiaoConfig> = {
  usa: {
    label: "USA",
    description: "Numeração americana",
    displaySystem: "us",
    segmentos: [
      {
        id: "adult",
        label: "Adult",
        description: "Numeração adulta americana",
        tamanhos: [
          "3.5",
          "4",
          "4.5",
          "5",
          "5.5",
          "6",
          "6.5",
          "7",
          "7.5",
          "8",
          "8.5",
          "9",
          "9.5",
          "10",
          "10.5",
          "11",
          "11.5",
          "12",
          "12.5",
          "13",
          "14",
          "15",
        ],
      },
      {
        id: "adult_w",
        label: "Adult feminino W",
        description: "Numeração feminina americana",
        tamanhos: [
          "5W",
          "5.5W",
          "6W",
          "6.5W",
          "7W",
          "7.5W",
          "8W",
          "8.5W",
          "9W",
          "9.5W",
          "10W",
          "10.5W",
          "11W",
          "11.5W",
          "12W",
          "12.5W",
          "13W",
          "13.5W",
          "14W",
          "14.5W",
          "15.5W",
          "16.5W",
        ],
      },
      {
        id: "youth",
        label: "Youth",
        description: "Numeração juvenil americana",
        tamanhos: ["3.5Y", "4Y", "4.5Y", "5Y", "5.5Y", "6Y", "6.5Y", "7Y"],
      },
      {
        id: "kids",
        label: "Kids",
        description: "Numeração infantil americana",
        tamanhos: [
          "8.5C",
          "9C",
          "9.5C",
          "10C",
          "10.5C",
          "11C",
          "11.5C",
          "12C",
          "12.5C",
          "13C",
          "13.5C",
          "1Y",
          "1.5Y",
          "2Y",
          "2.5Y",
          "3Y",
        ],
      },
    ],
  },
  brasil: {
    label: "Brasil",
    description: "Numeração brasileira",
    displaySystem: "br",
    segmentos: [
      {
        id: "adult",
        label: "Adult",
        description: "Numeração adulta brasileira",
        tamanhos: [
          "34",
          "34.5",
          "35",
          "35.5",
          "36",
          "37",
          "37.5",
          "38",
          "39",
          "39.5",
          "40",
          "40.5",
          "41",
          "42",
          "42.5",
          "43",
          "43.5",
          "44",
          "45",
          "45.5",
          "46.5",
          "49.5",
          "50.5",
        ],
      },
      {
        id: "youth",
        label: "Youth",
        description: "Numeração juvenil brasileira",
        tamanhos: ["34", "34.5", "35", "35.5", "36", "37", "37.5", "38"],
      },
      {
        id: "kids",
        label: "Kids",
        description: "Numeração infantil brasileira",
        tamanhos: [
          "24.5",
          "25",
          "25.5",
          "26",
          "26.5",
          "27",
          "28",
          "28.5",
          "29",
          "30",
          "30.5",
          "31",
          "32",
          "32.5",
          "33",
          "33.5",
        ],
      },
    ],
  },
  europa: {
    label: "Europa",
    description: "Numeração europeia",
    displaySystem: "eu",
    segmentos: [
      {
        id: "adult",
        label: "Adult",
        description: "Numeração adulta europeia",
        tamanhos: [
          "35.5",
          "36",
          "36.5",
          "37.5",
          "38",
          "38.5",
          "39",
          "40",
          "40.5",
          "41",
          "42",
          "42.5",
          "43",
          "44",
          "44.5",
          "45",
          "45.5",
          "46",
          "47",
        ],
      },
      {
        id: "youth",
        label: "Youth",
        description: "Numeração juvenil europeia",
        tamanhos: ["35.5", "36", "36.6", "37.5", "38", "38.5", "39", "40"],
      },
      {
        id: "kids",
        label: "Kids",
        description: "Numeração infantil europeia",
        tamanhos: [
          "25.5",
          "26",
          "26.5",
          "27",
          "27.5",
          "28",
          "28.5",
          "29.5",
          "30",
          "31",
          "31.5",
          "32",
          "33",
          "33.5",
          "34",
          "35",
        ],
      },
    ],
  },
};

const ORDEM_REGIOES: RegiaoCatalogo[] = ["brasil", "europa", "usa"];

const CORES_REGIAO: Record<
  RegiaoCatalogo,
  { cartao: string; brilho: string; pill: string }
> = {
  brasil: {
    cartao:
      "border-[#1f8a52]/40 bg-[#1f8a52]/12 hover:border-[#3dba78] hover:bg-[#1f8a52]/20 hover:shadow-[0_18px_40px_rgba(31,138,82,0.22)]",
    brilho: "bg-[#3dba78]/25 group-hover:bg-[#3dba78]/40",
    pill: "bg-[#146c43] text-white",
  },
  europa: {
    cartao:
      "border-[#d7b56d]/45 bg-[#d7b56d]/12 hover:border-[#e2c688] hover:bg-[#d7b56d]/18 hover:shadow-[0_18px_40px_rgba(215,181,109,0.22)]",
    brilho: "bg-[#d7b56d]/25 group-hover:bg-[#d7b56d]/40",
    pill: "bg-[#d7b56d] text-stone-950",
  },
  usa: {
    cartao:
      "border-[#3d6adf]/45 bg-[#3d6adf]/14 hover:border-[#8eb4ff] hover:bg-[#3d6adf]/22 hover:shadow-[0_18px_40px_rgba(61,106,223,0.24)]",
    brilho: "bg-[#8eb4ff]/25 group-hover:bg-[#8eb4ff]/40",
    pill: "bg-[#2f5ec4] text-white",
  },
};

const CORES_SEGMENTO: Record<SegmentoCatalogo, { cartao: string; pill: string }> = {
  adult: {
    cartao:
      "border-[#d7b56d]/45 bg-[#d7b56d]/12 hover:border-[#e2c688] hover:bg-[#d7b56d]/18 hover:shadow-[0_18px_40px_rgba(215,181,109,0.22)]",
    pill: "bg-[#d7b56d] text-stone-950",
  },
  adult_w: {
    cartao:
      "border-[#d46a8c]/45 bg-[#d46a8c]/12 hover:border-[#f0a0b8] hover:bg-[#d46a8c]/20 hover:shadow-[0_18px_40px_rgba(212,106,140,0.22)]",
    pill: "bg-[#b84368] text-white",
  },
  youth: {
    cartao:
      "border-[#1a9b90]/45 bg-[#1a9b90]/12 hover:border-[#5ee0d4] hover:bg-[#1a9b90]/20 hover:shadow-[0_18px_40px_rgba(26,155,144,0.22)]",
    pill: "bg-[#0f7a72] text-white",
  },
  kids: {
    cartao:
      "border-[#e07a5f]/50 bg-[#e07a5f]/12 hover:border-[#f3b09e] hover:bg-[#e07a5f]/20 hover:shadow-[0_18px_40px_rgba(224,122,95,0.22)]",
    pill: "bg-[#e07a5f] text-stone-950",
  },
};

const btnVoltar =
  "min-h-11 rounded-full border border-[#7eb6e0]/50 bg-[#7eb6e0]/12 px-4 py-2 text-sm font-bold text-[#d6ebff] transition hover:border-[#7eb6e0] hover:bg-[#7eb6e0]/22 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7eb6e0]";
const btnDesfazer =
  "min-h-11 rounded-full border border-[#e07a5f]/55 bg-[#e07a5f]/12 px-4 py-2 text-sm font-bold text-[#f6c7b6] transition hover:border-[#f3b09e] hover:bg-[#e07a5f]/22 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e07a5f]";
const btnOuro =
  "min-h-11 rounded-full bg-[#d7b56d] px-4 py-2 text-sm font-black text-stone-950 transition hover:bg-[#e2c688] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2c688]";

const IDIOMAS: Array<{ id: IdiomaCatalogo; label: string }> = [
  { id: "pt", label: "PT" },
  { id: "en", label: "EN" },
  { id: "es", label: "ES" },
  { id: "fr", label: "FR" },
];

const TEXTOS: Record<
  IdiomaCatalogo,
  {
    catalogo: string;
    titulo: string;
    subtitulo: string;
    idioma: string;
    passo: string;
    regioesTitulo: string;
    regioesAjuda: string;
    segmentosTitulo: string;
    tamanhosTitulo: string;
    aguardando: string;
    carregando: string;
    semFoto: string;
    precoConsulta: string;
    gostei: string;
    selecionado: string;
    escolher: string;
    selecionados: string;
    limparSelecao: string;
    limparSelecaoTitulo: string;
    limparSelecaoAviso: string;
    limparSelecaoConfirmar: string;
    manterSelecao: string;
    verCarrinho: string;
    carrinhoTitulo: string;
    carrinhoVazio: string;
    salvarSelecao: string;
    cadastroTitulo: string;
    nome: string;
    telefone: string;
    email: string;
    pais: string;
    observacao: string;
    buscarPais: string;
    semPais: string;
    salvarCliente: string;
    salvarGerarOrdem: string;
    vendedor: string;
    vendedorAjuda: string;
    vendedorObrigatorio: string;
    escolherVendedor: string;
    cancelar: string;
    nomeObrigatorio: string;
    telefoneObrigatorio: string;
    emailInvalido: string;
    paisInvalido: string;
    selecaoSalvaTitulo: string;
    selecaoSalvaAviso: string;
    ordemCriadaTitulo: string;
    ordemCriadaAviso: string;
    verOrdem: string;
    novoAtendimento: string;
    remover: string;
    voltar: string;
    recomecar: string;
    recomecarTitulo: string;
    recomecarAviso: string;
    recomecarConfirmar: string;
    continuarDaqui: string;
    erroCatalogo: string;
    nenhumItem: string;
    itens: string;
    regionDescriptions: Record<RegiaoCatalogo, string>;
    segmentLabels: Record<SegmentoCatalogo, string>;
    segmentDescriptions: Record<SegmentoCatalogo, string>;
  }
> = {
  pt: {
    catalogo: "Catálogo de loja",
    titulo: "Escolha sua numeração e navegue pelos pares disponíveis.",
    subtitulo: "Mostramos apenas itens em estoque na Europa, com foto, SKU e valor para facilitar o atendimento.",
    idioma: "Idioma",
    passo: "Passo",
    regioesTitulo: "Escolha a região da sua numeração",
    regioesAjuda: "Primeiro selecione Brasil, Europa ou USA.",
    segmentosTitulo: "Escolha o segmento",
    tamanhosTitulo: "Escolha a numeração",
    aguardando: "Selecione uma numeração para ver os pares disponíveis na loja da Europa.",
    carregando: "Carregando...",
    semFoto: "Sem foto",
    precoConsulta: "Preço sob consulta",
    gostei: "Gostei deste",
    selecionado: "Selecionado",
    escolher: "Escolher",
    selecionados: "Selecionados pelo cliente",
    limparSelecao: "Limpar seleção",
    limparSelecaoTitulo: "Limpar a seleção?",
    limparSelecaoAviso: "Os pares escolhidos pelo cliente serão removidos. Essa ação não pode ser desfeita.",
    limparSelecaoConfirmar: "Sim, limpar",
    manterSelecao: "Manter seleção",
    verCarrinho: "Ver selecionados",
    carrinhoTitulo: "Itens selecionados",
    carrinhoVazio: "Nenhum item selecionado ainda.",
    salvarSelecao: "Salvar seleção",
    cadastroTitulo: "Dados Cliente",
    nome: "Nome",
    telefone: "Telefone",
    email: "E-mail",
    pais: "País",
    observacao: "Observação",
    buscarPais: "Buscar país",
    semPais: "Sem país",
    salvarCliente: "Salvar",
    salvarGerarOrdem: "Salvar e gerar ordem de venda",
    vendedor: "Vendedor",
    vendedorAjuda: "A mesma lista da ordem de venda.",
    vendedorObrigatorio: "Selecione o vendedor.",
    escolherVendedor: "Selecione o vendedor",
    cancelar: "Cancelar",
    nomeObrigatorio: "Informe o nome do cliente.",
    telefoneObrigatorio: "Informe o telefone do cliente.",
    emailInvalido: "E-mail inválido.",
    paisInvalido: "Escolha um país da lista.",
    selecaoSalvaTitulo: "Seleção salva",
    selecaoSalvaAviso: "O cliente foi cadastrado com a tag Galeria e os pares escolhidos.",
    ordemCriadaTitulo: "Ordem de venda criada",
    ordemCriadaAviso: "O cliente foi cadastrado e os pares entraram na ordem.",
    verOrdem: "Ver ordem de venda",
    novoAtendimento: "Novo atendimento",
    remover: "Remover",
    voltar: "Voltar",
    recomecar: "Recomeçar",
    recomecarTitulo: "Recomeçar o atendimento?",
    recomecarAviso: "Região, numeração e os pares escolhidos serão descartados. O catálogo volta ao início.",
    recomecarConfirmar: "Sim, recomeçar",
    continuarDaqui: "Continuar daqui",
    erroCatalogo: "Não foi possível carregar o catálogo",
    nenhumItem: "Nenhum item em estoque na Europa para esta numeração.",
    itens: "item(ns)",
    regionDescriptions: {
      brasil: "Numeração brasileira",
      europa: "Numeração europeia",
      usa: "Numeração americana",
    },
    segmentLabels: {
      adult: "Adult",
      adult_w: "Adult feminino W",
      youth: "Youth",
      kids: "Kids",
    },
    segmentDescriptions: {
      adult: "Numeração adulta",
      adult_w: "Numeração feminina americana",
      youth: "Numeração juvenil",
      kids: "Numeração infantil",
    },
  },
  en: {
    catalogo: "Store catalog",
    titulo: "Choose your size and browse available pairs.",
    subtitulo: "We only show items in stock in Europe, with photo, SKU and price for easier service.",
    idioma: "Language",
    passo: "Step",
    regioesTitulo: "Choose your size region",
    regioesAjuda: "First select Brazil, Europe or USA.",
    segmentosTitulo: "Choose the segment",
    tamanhosTitulo: "Choose the size",
    aguardando: "Choose a size to see the pairs available in the Europe store.",
    carregando: "Loading...",
    semFoto: "No photo",
    precoConsulta: "Price on request",
    gostei: "I like this one",
    selecionado: "Selected",
    escolher: "Choose",
    selecionados: "Customer selections",
    limparSelecao: "Clear selection",
    limparSelecaoTitulo: "Clear the selection?",
    limparSelecaoAviso: "The pairs the customer chose will be removed. This cannot be undone.",
    limparSelecaoConfirmar: "Yes, clear",
    manterSelecao: "Keep selection",
    verCarrinho: "View selections",
    carrinhoTitulo: "Selected items",
    carrinhoVazio: "No items selected yet.",
    salvarSelecao: "Save selection",
    cadastroTitulo: "Client details",
    nome: "Name",
    telefone: "Phone",
    email: "Email",
    pais: "Country",
    observacao: "Note",
    buscarPais: "Search country",
    semPais: "No country",
    salvarCliente: "Save",
    salvarGerarOrdem: "Save and create sales order",
    vendedor: "Seller",
    vendedorAjuda: "The same list used on the sales order.",
    vendedorObrigatorio: "Select the seller.",
    escolherVendedor: "Select the seller",
    cancelar: "Cancel",
    nomeObrigatorio: "Enter the client's name.",
    telefoneObrigatorio: "Enter the client's phone.",
    emailInvalido: "Invalid email.",
    paisInvalido: "Choose a country from the list.",
    selecaoSalvaTitulo: "Selection saved",
    selecaoSalvaAviso: "The client was saved with the Gallery tag and the chosen pairs.",
    ordemCriadaTitulo: "Sales order created",
    ordemCriadaAviso: "The client was saved and the pairs were added to the order.",
    verOrdem: "View sales order",
    novoAtendimento: "New visit",
    remover: "Remove",
    voltar: "Back",
    recomecar: "Start over",
    recomecarTitulo: "Start over?",
    recomecarAviso: "Region, size and the chosen pairs will be discarded. The catalog returns to the start.",
    recomecarConfirmar: "Yes, start over",
    continuarDaqui: "Stay here",
    erroCatalogo: "Could not load the catalog",
    nenhumItem: "No item in stock in Europe for this size.",
    itens: "item(s)",
    regionDescriptions: {
      brasil: "Brazilian size",
      europa: "European size",
      usa: "American size",
    },
    segmentLabels: {
      adult: "Adult",
      adult_w: "Adult W",
      youth: "Youth",
      kids: "Kids",
    },
    segmentDescriptions: {
      adult: "Adult size",
      adult_w: "American women's size",
      youth: "Youth size",
      kids: "Kids size",
    },
  },
  es: {
    catalogo: "Catálogo de tienda",
    titulo: "Elige tu talla y mira los pares disponibles.",
    subtitulo: "Mostramos solo artículos en stock en Europa, con foto, SKU y precio para facilitar la atención.",
    idioma: "Idioma",
    passo: "Paso",
    regioesTitulo: "Elige la región de tu talla",
    regioesAjuda: "Primero selecciona Brasil, Europa o USA.",
    segmentosTitulo: "Elige el segmento",
    tamanhosTitulo: "Elige la talla",
    aguardando: "Selecciona una talla para ver los pares disponibles en la tienda de Europa.",
    carregando: "Cargando...",
    semFoto: "Sin foto",
    precoConsulta: "Precio a consultar",
    gostei: "Me gusta este",
    selecionado: "Seleccionado",
    escolher: "Elegir",
    selecionados: "Seleccionados por el cliente",
    limparSelecao: "Limpiar selección",
    limparSelecaoTitulo: "¿Limpiar la selección?",
    limparSelecaoAviso: "Los pares elegidos por el cliente se quitarán. Esta acción no se puede deshacer.",
    limparSelecaoConfirmar: "Sí, limpiar",
    manterSelecao: "Mantener selección",
    verCarrinho: "Ver seleccionados",
    carrinhoTitulo: "Artículos seleccionados",
    carrinhoVazio: "Aún no hay artículos seleccionados.",
    salvarSelecao: "Guardar selección",
    cadastroTitulo: "Datos del cliente",
    nome: "Nombre",
    telefone: "Teléfono",
    email: "Correo",
    pais: "País",
    observacao: "Observación",
    buscarPais: "Buscar país",
    semPais: "Sin país",
    salvarCliente: "Guardar",
    salvarGerarOrdem: "Guardar y generar orden de venta",
    vendedor: "Vendedor",
    vendedorAjuda: "La misma lista de la orden de venta.",
    vendedorObrigatorio: "Selecciona el vendedor.",
    escolherVendedor: "Selecciona el vendedor",
    cancelar: "Cancelar",
    nomeObrigatorio: "Indica el nombre del cliente.",
    telefoneObrigatorio: "Indica el teléfono del cliente.",
    emailInvalido: "Correo no válido.",
    paisInvalido: "Elige un país de la lista.",
    selecaoSalvaTitulo: "Selección guardada",
    selecaoSalvaAviso: "El cliente quedó registrado con la etiqueta Galería y los pares elegidos.",
    ordemCriadaTitulo: "Orden de venta creada",
    ordemCriadaAviso: "El cliente quedó registrado y los pares entraron en la orden.",
    verOrdem: "Ver orden de venta",
    novoAtendimento: "Nueva atención",
    remover: "Quitar",
    voltar: "Volver",
    recomecar: "Empezar de nuevo",
    recomecarTitulo: "¿Empezar de nuevo?",
    recomecarAviso: "Se descartarán la región, la talla y los pares elegidos. El catálogo vuelve al inicio.",
    recomecarConfirmar: "Sí, empezar de nuevo",
    continuarDaqui: "Seguir aquí",
    erroCatalogo: "No fue posible cargar el catálogo",
    nenhumItem: "No hay artículos en stock en Europa para esta talla.",
    itens: "artículo(s)",
    regionDescriptions: {
      brasil: "Talla brasileña",
      europa: "Talla europea",
      usa: "Talla americana",
    },
    segmentLabels: {
      adult: "Adult",
      adult_w: "Adult femenino W",
      youth: "Youth",
      kids: "Kids",
    },
    segmentDescriptions: {
      adult: "Talla adulta",
      adult_w: "Talla femenina americana",
      youth: "Talla juvenil",
      kids: "Talla infantil",
    },
  },
  fr: {
    catalogo: "Catalogue boutique",
    titulo: "Choisissez votre pointure et parcourez les paires disponibles.",
    subtitulo: "Nous affichons uniquement les articles en stock en Europe, avec photo, SKU et prix.",
    idioma: "Langue",
    passo: "Étape",
    regioesTitulo: "Choisissez la région de pointure",
    regioesAjuda: "Sélectionnez d'abord Brésil, Europe ou USA.",
    segmentosTitulo: "Choisissez le segment",
    tamanhosTitulo: "Choisissez la pointure",
    aguardando: "Choisissez une pointure pour voir les paires disponibles dans la boutique Europe.",
    carregando: "Chargement...",
    semFoto: "Sans photo",
    precoConsulta: "Prix sur demande",
    gostei: "J'aime celui-ci",
    selecionado: "Sélectionné",
    escolher: "Choisir",
    selecionados: "Sélections du client",
    limparSelecao: "Effacer la sélection",
    limparSelecaoTitulo: "Effacer la sélection ?",
    limparSelecaoAviso: "Les paires choisies par le client seront retirées. Cette action est irréversible.",
    limparSelecaoConfirmar: "Oui, effacer",
    manterSelecao: "Garder la sélection",
    verCarrinho: "Voir la sélection",
    carrinhoTitulo: "Articles sélectionnés",
    carrinhoVazio: "Aucun article sélectionné pour le moment.",
    salvarSelecao: "Enregistrer la sélection",
    cadastroTitulo: "Données client",
    nome: "Nom",
    telefone: "Téléphone",
    email: "E-mail",
    pais: "Pays",
    observacao: "Observation",
    buscarPais: "Rechercher un pays",
    semPais: "Sans pays",
    salvarCliente: "Enregistrer",
    salvarGerarOrdem: "Enregistrer et créer la commande",
    vendedor: "Vendeur",
    vendedorAjuda: "La même liste que la commande.",
    vendedorObrigatorio: "Sélectionnez le vendeur.",
    escolherVendedor: "Sélectionnez le vendeur",
    cancelar: "Annuler",
    nomeObrigatorio: "Indiquez le nom du client.",
    telefoneObrigatorio: "Indiquez le téléphone du client.",
    emailInvalido: "E-mail invalide.",
    paisInvalido: "Choisissez un pays dans la liste.",
    selecaoSalvaTitulo: "Sélection enregistrée",
    selecaoSalvaAviso: "Le client a été enregistré avec l'étiquette Galerie et les paires choisies.",
    ordemCriadaTitulo: "Commande créée",
    ordemCriadaAviso: "Le client a été enregistré et les paires ont été ajoutées à la commande.",
    verOrdem: "Voir la commande",
    novoAtendimento: "Nouvel accueil",
    remover: "Retirer",
    voltar: "Retour",
    recomecar: "Recommencer",
    recomecarTitulo: "Recommencer ?",
    recomecarAviso: "La région, la pointure et les paires choisies seront écartées. Le catalogue revient au début.",
    recomecarConfirmar: "Oui, recommencer",
    continuarDaqui: "Rester ici",
    erroCatalogo: "Impossible de charger le catalogue",
    nenhumItem: "Aucun article en stock en Europe pour cette pointure.",
    itens: "article(s)",
    regionDescriptions: {
      brasil: "Pointure brésilienne",
      europa: "Pointure européenne",
      usa: "Pointure américaine",
    },
    segmentLabels: {
      adult: "Adulte",
      adult_w: "Adulte femme W",
      youth: "Youth",
      kids: "Kids",
    },
    segmentDescriptions: {
      adult: "Pointure adulte",
      adult_w: "Pointure américaine femme",
      youth: "Pointure jeune",
      kids: "Pointure enfant",
    },
  },
};

function formatarTamanho(regiao: RegiaoCatalogo, tamanho: string): string {
  if (regiao === "brasil") return `BR ${tamanho.replace(".", ",")}`;
  if (regiao === "europa") return `EU ${tamanho.replace(".", ",")}`;
  return `US ${tamanho.replace(".", ",")}`;
}

function compactarTamanho(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toString();
}

function tamanhosPorEquivalencia(
  regiao: RegiaoCatalogo,
  segmento: SegmentoCatalogo,
): string[] {
  const valores: string[] = [];

  for (const row of SHOE_SIZE_EQUIVALENCE_TABLE) {
    const isKids = row.us_y !== null && (row.us_y_suffix === "C" || row.us_y < 3.5);
    const isYouth = row.us_y !== null && row.us_y_suffix === "Y" && row.us_y >= 3.5;
    const isAdult = !isKids;

    if (segmento === "kids" && !isKids) continue;
    if (segmento === "youth" && !isYouth) continue;
    if ((segmento === "adult" || segmento === "adult_w") && !isAdult) continue;

    if (regiao === "brasil" && row.br !== null) {
      valores.push(compactarTamanho(row.br));
    } else if (regiao === "europa" && row.eu !== null) {
      valores.push(compactarTamanho(row.eu));
    } else if (regiao === "usa") {
      if (segmento === "adult_w" && row.us_w !== null) {
        valores.push(`${compactarTamanho(row.us_w)}W`);
      } else if (segmento === "adult" && row.us_m !== null) {
        valores.push(compactarTamanho(row.us_m));
      } else if ((segmento === "youth" || segmento === "kids") && row.us_y !== null) {
        valores.push(`${compactarTamanho(row.us_y)}${row.us_y_suffix ?? "Y"}`);
      }
    }
  }

  return [...new Set(valores)];
}

function AreaRolavel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-1 [scrollbar-width:thin] [scrollbar-color:#d7b56d_rgba(255,255,255,0.12)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function ProdutoGaleria({
  fotos,
  sku,
  semFoto,
  prioridade,
}: {
  fotos: string[];
  sku: string;
  semFoto: string;
  prioridade?: boolean;
}) {
  const [indice, setIndice] = useState(0);
  const [erros, setErros] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    setIndice(0);
    setErros(new Set());
  }, [fotos]);

  const fotoAtual = fotos[indice];
  const mostrarFoto = Boolean(fotoAtual) && !erros.has(indice);
  const total = fotos.length;

  const anterior = () => setIndice((i) => (i - 1 + total) % total);
  const proxima = () => setIndice((i) => (i + 1) % total);

  return (
    <div className="bg-[#f7f2ea]">
      <div className="relative aspect-square w-full">
        {mostrarFoto ? (
          <img
            src={fotoAtual}
            alt={`SKU ${sku}`}
            className="absolute inset-0 h-full w-full object-contain p-3"
            loading={prioridade && indice === 0 ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
            onError={() => setErros((prev) => new Set(prev).add(indice))}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs font-semibold text-stone-400">
            {semFoto}
          </div>
        )}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                anterior();
              }}
              className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-stone-950/75 text-white backdrop-blur"
              aria-label="Foto anterior"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                proxima();
              }}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-stone-950/75 text-white backdrop-blur"
              aria-label="Próxima foto"
            >
              ›
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-stone-950/75 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
              {indice + 1}/{total}
            </span>
          </>
        )}
      </div>
      {total > 1 && (
        <div className="flex gap-2 overflow-x-auto border-t border-stone-200/80 p-2 [scrollbar-width:thin]">
          {fotos.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => setIndice(i)}
              className={cn(
                "h-10 w-10 shrink-0 overflow-hidden rounded-lg border-2 bg-white transition sm:h-12 sm:w-12",
                i === indice ? "border-[#d7b56d]" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <img src={url} alt="" className="h-full w-full object-contain p-0.5" loading="lazy" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function precoCatalogoEuro(item: { preco_venda: number | null }): string | null {
  if (item.preco_venda == null) return null;
  return formatarMoeda(item.preco_venda, "EUR");
}

function ProdutoCard({
  item,
  fotos,
  selecionado,
  onToggle,
  labels,
  prioridadeImagem,
  numeracaoLabel,
  acao = "escolher",
}: {
  item: ItemCatalogoKropCafePublico;
  fotos: string[];
  selecionado: boolean;
  onToggle: () => void;
  prioridadeImagem?: boolean;
  numeracaoLabel?: string | null;
  acao?: "escolher" | "remover";
  labels: {
    semFoto: string;
    precoConsulta: string;
    gostei: string;
    selecionado: string;
  };
}) {
  const preco = precoCatalogoEuro(item) ?? labels.precoConsulta;

  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_12px_40px_rgba(0,0,0,0.14)] transition",
        selecionado && acao === "escolher"
          ? "border-[#146c43] ring-2 ring-[#146c43]/30"
          : "border-stone-200",
      )}
    >
      <ProdutoGaleria
        fotos={fotos}
        sku={item.sku}
        semFoto={labels.semFoto}
        prioridade={prioridadeImagem}
      />
      <div className="flex flex-1 flex-col justify-between gap-1.5 border-t border-stone-100 p-2.5 sm:gap-2 sm:p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-stone-400 sm:text-[9px] sm:tracking-[0.24em]">SKU</p>
            <p className="truncate text-base font-black tracking-tight text-stone-950 sm:text-lg">
              {item.sku}
              {numeracaoLabel ? (
                <span className="font-bold text-stone-500"> · {numeracaoLabel}</span>
              ) : null}
            </p>
          </div>
          <p className="shrink-0 rounded-full bg-stone-950 px-2 py-0.5 text-[10px] font-bold text-white sm:px-2.5 sm:py-1 sm:text-xs">{preco}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "w-full rounded-lg px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-xs sm:tracking-[0.14em]",
            acao === "remover"
              ? "bg-[#e07a5f] text-stone-950 hover:bg-[#f09a84] focus-visible:outline-[#e07a5f]"
              : selecionado
                ? "bg-[#146c43] text-white focus-visible:outline-[#146c43]"
                : "bg-[#d7b56d] text-stone-950 hover:bg-[#e2c688] focus-visible:outline-[#d7b56d]",
          )}
        >
          {selecionado ? labels.selecionado : labels.gostei}
        </button>
      </div>
    </article>
  );
}

export default function CatalogoKropCafePage() {
  const [idioma, setIdioma] = useState<IdiomaCatalogo>("pt");
  const [regiao, setRegiao] = useState<RegiaoCatalogo | null>(null);
  const [segmento, setSegmento] = useState<SegmentoCatalogo | null>(null);
  const [tamanho, setTamanho] = useState<string | null>(null);
  const [catalogo, setCatalogo] = useState<CatalogoState>({ itens: [], fotos: {} });
  const [sacola, setSacola] = useState<Record<string, ItemSelecionadoCatalogo>>({});
  const [verCarrinho, setVerCarrinho] = useState(false);
  const [confirmacao, setConfirmacao] = useState<"limpar" | "recomecar" | null>(null);
  const [salvarAberto, setSalvarAberto] = useState(false);
  const manterSelecaoRef = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const t = TEXTOS[idioma];
  const regiaoConfig = regiao ? REGIOES[regiao] : null;
  const segmentoConfig = regiaoConfig?.segmentos.find((s) => s.id === segmento) ?? null;
  const etapaAtual = verCarrinho
    ? 5
    : !regiao
      ? 1
      : !segmento
        ? 2
        : !tamanho
          ? 3
          : 4;
  const tamanhoOpcoes = useMemo(
    () => (regiao && segmento ? tamanhosPorEquivalencia(regiao, segmento) : []),
    [regiao, segmento],
  );
  const itensSelecionados = useMemo(() => Object.values(sacola), [sacola]);
  const qtdSelecionados = itensSelecionados.length;
  const numeracaoAtualLabel =
    regiao && tamanho ? formatarTamanho(regiao, tamanho) : "";

  const selecionarRegiao = (id: RegiaoCatalogo) => {
    setIdioma(id === "usa" ? "en" : "pt");
    setRegiao(id);
  };

  useEffect(() => {
    setSegmento(null);
    setTamanho(null);
    setCatalogo({ itens: [], fotos: {} });
    setSacola({});
    setVerCarrinho(false);
    setErro(null);
  }, [regiao]);

  useEffect(() => {
    setTamanho(null);
    setCatalogo({ itens: [], fotos: {} });
    setVerCarrinho(false);
    setErro(null);
  }, [segmento]);

  useEffect(() => {
    let cancelado = false;

    async function carregarCatalogo() {
      if (!regiaoConfig || !tamanho) {
        setCatalogo({ itens: [], fotos: {} });
        return;
      }

      setLoading(true);
      setErro(null);
      setVerCarrinho(false);

      try {
        const itens = await catalogoKropCafeService.buscar({
          displaySizeSystem: regiaoConfig.displaySystem,
          numeracao: tamanho,
        });
        const idsModelo = [...new Set(itens.map((item) => item.id_modelo_produto))];
        const fotosMap = await catalogoKropCafeService.listarGaleriaUrlsPorModelos(idsModelo);

        if (!cancelado) setCatalogo({ itens, fotos: fotosMap });
      } catch (e) {
        if (!cancelado) {
          setCatalogo({ itens: [], fotos: {} });
          setErro(mensagemErro(e));
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    }

    carregarCatalogo();
    return () => {
      cancelado = true;
    };
  }, [regiaoConfig, tamanho]);

  const alternarSelecionado = (
    item: ItemCatalogoKropCafePublico,
    fotos: string[],
    numeracaoLabel: string,
  ) => {
    setSacola((prev) => {
      const next = { ...prev };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = { item, fotos, numeracaoLabel };
      return next;
    });
  };

  const limparSacola = () => {
    setSacola({});
    setVerCarrinho(false);
    setConfirmacao(null);
  };

  useEffect(() => {
    if (!confirmacao) return;
    manterSelecaoRef.current?.focus();
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmacao(null);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [confirmacao]);

  const recomecar = () => {
    setRegiao(null);
    setSegmento(null);
    setTamanho(null);
    setCatalogo({ itens: [], fotos: {} });
    setSacola({});
    setVerCarrinho(false);
    setErro(null);
    setConfirmacao(null);
  };

  const voltar = () => {
    if (verCarrinho) {
      setVerCarrinho(false);
      return;
    }
    if (tamanho) {
      setTamanho(null);
      setCatalogo({ itens: [], fotos: {} });
      return;
    }
    if (segmento) {
      setSegmento(null);
      return;
    }
    if (regiao) {
      setRegiao(null);
    }
  };

  const mostrandoPares = Boolean(tamanho) && !verCarrinho;
  const tituloEtapa = verCarrinho
    ? t.carrinhoTitulo
    : !regiao
      ? t.regioesTitulo
      : !segmento
        ? t.segmentosTitulo
        : t.tamanhosTitulo;

  return (
    <main className="h-screen overflow-hidden bg-[#050505] text-white">
      <section className="mx-auto flex h-screen w-full max-w-7xl flex-col px-3 py-2 sm:px-6 sm:py-3 lg:px-8">
        <header className="flex shrink-0 items-center justify-between gap-2 pb-2 sm:gap-3 sm:pb-3">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <img
              src="/kropcafe-logo-white-glow.png?v=2"
              alt="KropCafé"
              className="h-auto w-24 shrink-0 object-contain sm:w-32 md:w-44"
              draggable={false}
            />
            <div className="hidden items-center gap-2 sm:flex">
              {ETAPAS.map((etapa) => (
                <span
                  key={etapa}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border text-sm font-black transition",
                    etapaAtual === etapa
                      ? "border-[#d7b56d] bg-[#d7b56d] text-stone-950"
                      : etapaAtual > etapa
                        ? "border-[#146c43] bg-[#146c43] text-white"
                        : "border-white/10 bg-white/[0.04] text-white/35",
                  )}
                >
                  {etapa}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            {qtdSelecionados > 0 && !verCarrinho ? (
              <button
                type="button"
                onClick={() => setVerCarrinho(true)}
                className="relative rounded-full border border-[#d7b56d]/50 bg-[#d7b56d]/15 px-3 py-1.5 text-[10px] font-bold text-[#d7b56d] transition hover:bg-[#d7b56d] hover:text-stone-950 sm:px-4 sm:py-2 sm:text-xs"
              >
                {t.verCarrinho}
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#d7b56d] px-1 text-[10px] font-black text-stone-950">
                  {qtdSelecionados}
                </span>
              </button>
            ) : null}
            <div className="rounded-full border border-white/10 bg-white/[0.06] p-1">
              <span className="sr-only">{t.idioma}</span>
              <div className="flex flex-wrap justify-end gap-1">
                {IDIOMAS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIdioma(item.id)}
                    className={cn(
                      "rounded-full px-2 py-1.5 text-[10px] font-bold transition sm:px-3 sm:py-2 sm:text-xs",
                      idioma === item.id
                        ? "bg-[#d7b56d] text-stone-950"
                        : "text-white/70 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(215,181,109,0.14),rgba(255,255,255,0.055)_34%,rgba(255,255,255,0.035))] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur sm:rounded-[2rem] sm:p-4">
          <div className={cn("shrink-0", mostrandoPares || verCarrinho ? "mb-2" : "mb-3 sm:mb-4")}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
              <div className="flex items-center gap-2">
                {(regiao || segmento || tamanho || verCarrinho) ? (
                  <>
                    {regiao || verCarrinho ? (
                      <button
                        type="button"
                        onClick={voltar}
                        className={btnVoltar}
                      >
                        {t.voltar}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setConfirmacao("recomecar")}
                      className={btnDesfazer}
                    >
                      {t.recomecar}
                    </button>
                  </>
                ) : null}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d7b56d] sm:text-xs sm:tracking-[0.24em]">
                {t.passo} {etapaAtual}
              </p>
              <span />
            </div>
            {mostrandoPares || verCarrinho ? null : (
              <h2 className="mt-2 text-center text-xl font-black tracking-tight sm:mt-3 sm:text-2xl md:text-3xl lg:text-4xl">
                {tituloEtapa}
              </h2>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {verCarrinho ? (
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className="mb-2 grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2 sm:mb-3 sm:rounded-2xl sm:px-4 sm:py-3">
                <div>
                  {qtdSelecionados > 0 ? (
                    <button
                      type="button"
                      onClick={() => setConfirmacao("limpar")}
                      className={btnDesfazer}
                    >
                      {t.limparSelecao}
                    </button>
                  ) : null}
                </div>
                <p className="text-center text-sm font-black sm:text-lg">
                  {qtdSelecionados} {t.itens}
                </p>
                <div className="justify-self-end">
                  {qtdSelecionados > 0 ? (
                    <button
                      type="button"
                      onClick={() => setSalvarAberto(true)}
                      className={btnOuro}
                    >
                      {t.salvarSelecao}
                    </button>
                  ) : null}
                </div>
              </div>

              {qtdSelecionados === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-[1.5rem] border border-dashed border-white/20 bg-white/[0.04] p-8 text-center">
                  <p className="max-w-md text-lg font-semibold text-white/60">{t.carrinhoVazio}</p>
                </div>
              ) : (
                <AreaRolavel className="[scrollbar-color:#111827_rgba(0,0,0,0.08)]">
                  <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-3 pb-4 md:grid-cols-2 md:gap-4">
                    {itensSelecionados.map(({ item, fotos, numeracaoLabel }, index) => (
                      <ProdutoCard
                        key={item.id}
                        item={item}
                        fotos={fotos}
                        selecionado
                        numeracaoLabel={numeracaoLabel}
                        acao="remover"
                        onToggle={() => alternarSelecionado(item, fotos, numeracaoLabel)}
                        prioridadeImagem={index < 4}
                        labels={{
                          semFoto: t.semFoto,
                          precoConsulta: t.precoConsulta,
                          gostei: t.remover,
                          selecionado: t.remover,
                        }}
                      />
                    ))}
                  </div>
                </AreaRolavel>
              )}
            </div>
          ) : !regiao ? (
            <AreaRolavel className="mx-auto w-full max-w-xl">
              <div className="flex flex-col gap-3 py-2">
              {ORDEM_REGIOES.map((id) => {
                const config = REGIOES[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selecionarRegiao(id)}
                    className={cn(
                      "group relative overflow-hidden rounded-2xl border p-3 text-left transition hover:-translate-y-1 sm:rounded-3xl sm:p-4",
                      CORES_REGIAO[id].cartao,
                    )}
                  >
                    <span className={cn("absolute -right-8 -top-8 h-24 w-24 rounded-full transition", CORES_REGIAO[id].brilho)} />
                    <span className="relative block text-2xl font-black tracking-tight sm:text-3xl">{config.label}</span>
                    <span className="relative mt-1.5 block text-xs font-medium text-white/75 sm:mt-2 sm:text-sm">{t.regionDescriptions[id]}</span>
                    <span className={cn("relative mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold sm:mt-4 sm:px-3 sm:py-1.5 sm:text-xs", CORES_REGIAO[id].pill)}>
                      {t.escolher}
                    </span>
                  </button>
                );
              })}
              </div>
            </AreaRolavel>
          ) : !segmento && regiaoConfig ? (
            <AreaRolavel className="mx-auto w-full max-w-xl">
              <div className="flex flex-col gap-3 py-2">
              {regiaoConfig.segmentos.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSegmento(item.id)}
                  className={cn(
                    "group rounded-2xl border p-3 text-left transition hover:-translate-y-1 sm:rounded-3xl sm:p-4",
                    CORES_SEGMENTO[item.id].cartao,
                  )}
                >
                  <span className="block text-2xl font-black tracking-tight sm:text-3xl">{t.segmentLabels[item.id]}</span>
                  <span className="mt-1.5 block text-xs font-medium text-white/75 sm:mt-2 sm:text-sm">{t.segmentDescriptions[item.id]}</span>
                  <span className={cn("mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold sm:mt-4 sm:px-3 sm:py-1.5 sm:text-xs", CORES_SEGMENTO[item.id].pill)}>
                    {t.escolher}
                  </span>
                </button>
              ))}
              </div>
            </AreaRolavel>
          ) : regiao && segmentoConfig && !tamanho ? (
            <AreaRolavel className="flex items-start justify-center">
              <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:rounded-[2rem] sm:p-5">
                <label htmlFor="catalogo-tamanho" className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-[#d7b56d] sm:mb-3 sm:text-sm sm:tracking-[0.24em]">
                  {t.tamanhosTitulo}
                </label>
                <select
                  id="catalogo-tamanho"
                  value=""
                  onChange={(event) => {
                    if (event.target.value) setTamanho(event.target.value);
                  }}
                  className="w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3.5 text-lg font-black text-white outline-none transition focus:border-[#d7b56d] focus:ring-4 focus:ring-[#d7b56d]/20 sm:rounded-2xl sm:px-5 sm:py-5 sm:text-2xl"
                >
                  <option value="">{t.tamanhosTitulo}</option>
                  {tamanhoOpcoes.map((valor) => (
                    <option key={valor} value={valor}>
                      {formatarTamanho(regiao, valor)}
                    </option>
                  ))}
                </select>
              </div>
            </AreaRolavel>
          ) : (
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className="mb-2 grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2 sm:mb-3 sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3">
                <span />
                <p className="text-center text-sm font-black sm:text-lg">
                  {tamanho && regiao ? formatarTamanho(regiao, tamanho) : t.aguardando}
                </p>
                {tamanho ? (
                  <p className="justify-self-end rounded-full bg-[#d7b56d] px-2 py-1 text-[10px] font-black text-stone-950 sm:px-3 sm:py-1.5 sm:text-xs">
                    {loading ? t.carregando : `${catalogo.itens.length} ${t.itens}`}
                  </p>
                ) : (
                  <span />
                )}
              </div>

              {loading ? (
                <AreaRolavel className="[scrollbar-color:#111827_rgba(0,0,0,0.08)]">
                  <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-3 pb-4 md:grid-cols-2 md:gap-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="aspect-square animate-pulse rounded-2xl bg-white/70" />
                    ))}
                  </div>
                </AreaRolavel>
              ) : erro ? (
                <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-6 text-red-700">
                  {t.erroCatalogo}: {erro}
                </div>
              ) : catalogo.itens.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-[1.5rem] border border-dashed border-white/20 bg-white/[0.04] p-8 text-center">
                  <p className="max-w-md text-lg font-semibold text-white/60">{t.nenhumItem}</p>
                </div>
              ) : (
                <AreaRolavel className="[scrollbar-color:#111827_rgba(0,0,0,0.08)]">
                  <div
                    className={cn(
                      "mx-auto grid w-full max-w-5xl grid-cols-1 gap-3 md:grid-cols-2 md:gap-4",
                      qtdSelecionados > 0 ? "pb-28" : "pb-4",
                    )}
                  >
                    {catalogo.itens.map((item, index) => {
                      const fotos = catalogo.fotos[item.id_modelo_produto] ?? [];
                      const naSacola = sacola[item.id];
                      return (
                      <ProdutoCard
                        key={item.id}
                        item={item}
                        fotos={fotos}
                        selecionado={Boolean(naSacola)}
                        numeracaoLabel={naSacola?.numeracaoLabel ?? numeracaoAtualLabel}
                        onToggle={() =>
                          alternarSelecionado(
                            item,
                            fotos,
                            naSacola?.numeracaoLabel ?? numeracaoAtualLabel,
                          )
                        }
                        prioridadeImagem={index < 4}
                        labels={{
                          semFoto: t.semFoto,
                          precoConsulta: t.precoConsulta,
                          gostei: t.gostei,
                          selecionado: t.selecionado,
                        }}
                      />
                      );
                    })}
                  </div>
                </AreaRolavel>
              )}

              {qtdSelecionados > 0 && (
                <div className="absolute inset-x-0 bottom-0 z-10 rounded-xl border border-[#d7b56d]/40 bg-stone-950/95 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur sm:rounded-[1.5rem] sm:p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d7b56d] sm:text-xs sm:tracking-[0.2em]">
                        {t.selecionados}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-black sm:mt-1 sm:text-base">
                        {qtdSelecionados} {t.itens}:{" "}
                        {itensSelecionados
                          .map(({ item, numeracaoLabel }) => `${item.sku} (${numeracaoLabel})`)
                          .join(", ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmacao("limpar")}
                        className={btnDesfazer}
                      >
                        {t.limparSelecao}
                      </button>
                      <button
                        type="button"
                        onClick={() => setVerCarrinho(true)}
                        className="rounded-full bg-[#d7b56d] px-3 py-1.5 text-xs font-black text-stone-950 transition hover:bg-[#e2c688] sm:px-4 sm:py-2 sm:text-sm"
                      >
                        {t.verCarrinho}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </section>
      </section>

      <SalvarSelecaoModal
        open={salvarAberto}
        idioma={idioma}
        itens={itensSelecionados.map(({ item, numeracaoLabel }) => ({
          id: item.id,
          sku: item.sku,
          numeracao: numeracaoLabel,
          preco: precoCatalogoEuro(item),
        }))}
        textos={t}
        onClose={() => setSalvarAberto(false)}
        onConcluido={() => {
          setSalvarAberto(false);
          recomecar();
        }}
      />

      {confirmacao ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
          onClick={() => setConfirmacao(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmacao-catalogo-titulo"
            className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-stone-950 p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="confirmacao-catalogo-titulo" className="text-2xl font-black tracking-tight sm:text-3xl">
              {confirmacao === "recomecar" ? t.recomecarTitulo : t.limparSelecaoTitulo}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-white/75">
              {qtdSelecionados > 0 ? (
                <span className="font-black text-white">
                  {qtdSelecionados} {t.itens}.{" "}
                </span>
              ) : null}
              {confirmacao === "recomecar" ? t.recomecarAviso : t.limparSelecaoAviso}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                ref={manterSelecaoRef}
                type="button"
                onClick={() => setConfirmacao(null)}
                className="min-h-14 rounded-full bg-[#d7b56d] px-5 text-base font-black text-stone-950 transition hover:bg-[#e2c688] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d7b56d]"
              >
                {confirmacao === "recomecar" ? t.continuarDaqui : t.manterSelecao}
              </button>
              <button
                type="button"
                onClick={confirmacao === "recomecar" ? recomecar : limparSacola}
                className="min-h-14 rounded-full border border-red-400/50 px-5 text-base font-bold text-red-200 transition hover:border-red-300 hover:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
              >
                {confirmacao === "recomecar" ? t.recomecarConfirmar : t.limparSelecaoConfirmar}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
