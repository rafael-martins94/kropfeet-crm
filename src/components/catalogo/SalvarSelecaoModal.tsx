import { useEffect, useId, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { catalogoKropCafeService, type ClienteCatalogoRecuperado } from "../../services/catalogo-kropcafe";
import { criarLinkPagamentoSumup, type ContaSumup, type LinkPagamentoSumup } from "../../services/sumup";
import { TelefoneComDdi } from "../clientes/TelefoneComDdi";
import { filtrarPaises, listarPaises, resolverPais } from "../../utils/paises";
import { mensagemErro } from "../../utils/errors";
import { formatarMoeda } from "../../utils/format";
import { cn } from "../../utils/cn";

export type ItemSelecaoGaleria = {
  id: string;
  sku: string;
  numeracao: string;
  preco: number | null;
  moeda: string | null;
};

export type TextosSalvarSelecao = {
  cadastroTitulo: string;
  nome: string;
  telefone: string;
  email: string;
  pais: string;
  observacao: string;
  buscarPais: string;
  semPais: string;
  salvarCliente: string;
  salvarSelecao: string;
  gerarPagamento: string;
  pagamentoPresencial: string;
  codigoSumup: string;
  codigoSumupAjuda: string;
  codigoInvalido: string;
  confirmarPresencial: string;
  ordemCriadaTitulo: string;
  ordemCriadaAviso: string;
  seguir: string;
  voltar: string;
  cancelar: string;
  nomeObrigatorio: string;
  telefoneObrigatorio: string;
  emailInvalido: string;
  paisInvalido: string;
  selecaoSalvaTitulo: string;
  selecaoSalvaAviso: string;
  novoAtendimento: string;
  sumupBrasil: string;
  sumupEuropa: string;
  usarValorItens: string;
  informarValor: string;
  valorOutraMoeda: string;
  valorInvalido: string;
  linkGeradoTitulo: string;
  linkGeradoAviso: string;
  copiarLink: string;
  linkCopiado: string;
  totalItens: string;
};

type SalvarSelecaoModalProps = {
  open: boolean;
  idioma: string;
  cliente: ClienteCatalogoRecuperado | null;
  itens: ItemSelecaoGaleria[];
  textos: TextosSalvarSelecao;
  onClose: () => void;
  onConcluido: () => void;
};

type Passo = "cadastro" | "acoes" | "conta" | "valor" | "codigo" | "link" | "ordem" | "salvo";
type ModoPagamento = "link" | "presencial";

function codigoSumup(texto: string): string {
  return texto.toUpperCase().match(/T[A-Z0-9]{6,24}/)?.[0] ?? "";
}

const campoClasse =
  "h-11 w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#d7b56d] focus:ring-2 focus:ring-[#d7b56d]/25";

const moedaDaConta: Record<ContaSumup, "BRL" | "EUR"> = {
  br: "BRL",
  pt: "EUR",
};

function totalNaMoeda(itens: ItemSelecaoGaleria[], moeda: string): number | null {
  if (itens.length === 0) return null;
  let soma = 0;
  for (const item of itens) {
    const moedaItem = (item.moeda ?? "").trim().toUpperCase();
    if (moedaItem !== moeda || item.preco == null || !(item.preco > 0)) return null;
    soma += item.preco;
  }
  return Math.round(soma * 100) / 100;
}

function lerValorDigitado(texto: string): number | null {
  const numero = Number(texto.trim().replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(numero) || numero <= 0 || numero > 999_999.99) return null;
  return Math.round(numero * 100) / 100;
}

export function SalvarSelecaoModal({
  open,
  idioma,
  cliente,
  itens,
  textos,
  onClose,
  onConcluido,
}: SalvarSelecaoModalProps) {
  const tituloId = useId();
  const nomeRef = useRef<HTMLInputElement>(null);
  const valorRef = useRef<HTMLInputElement>(null);
  const codigoRef = useRef<HTMLInputElement>(null);
  const fecharRef = useRef<() => void>(() => {});
  const dadosProntos = Boolean(cliente?.nome.trim() && cliente.telefone.trim());
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [codigoPais, setCodigoPais] = useState("PT");
  const [email, setEmail] = useState("");
  const [paisBusca, setPaisBusca] = useState("");
  const [paisValor, setPaisValor] = useState("");
  const [paisAberto, setPaisAberto] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [passo, setPasso] = useState<Passo>("cadastro");
  const [modo, setModo] = useState<ModoPagamento>("link");
  const [contaEscolhida, setContaEscolhida] = useState<ContaSumup>("pt");
  const [valorTexto, setValorTexto] = useState("");
  const [valorConfirmado, setValorConfirmado] = useState<number | null>(null);
  const [codigoTexto, setCodigoTexto] = useState("");
  const [ordemNumero, setOrdemNumero] = useState<string | null>(null);
  const [ordemCodigo, setOrdemCodigo] = useState<string | null>(null);
  const [link, setLink] = useState<LinkPagamentoSumup | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const paises = useMemo(() => listarPaises(idioma), [idioma]);
  const paisesFiltrados = useMemo(() => filtrarPaises(paises, paisBusca), [paises, paisBusca]);
  const totalBrasil = totalNaMoeda(itens, "BRL");
  const totalEuropa = totalNaMoeda(itens, "EUR");

  useEffect(() => {
    if (!open) return;
    const paisInicial = cliente?.pais?.trim() ?? "";
    const paisLista = listarPaises(idioma).find(
      (pais) => pais.valor === paisInicial || pais.rotulo === paisInicial,
    );
    const portugal = listarPaises(idioma).find((pais) => pais.codigo === "PT");
    setNome(cliente?.nome ?? "");
    setTelefone(cliente?.telefone ?? "");
    setCodigoPais(paisLista?.codigo ?? "PT");
    setEmail(cliente?.email ?? "");
    setPaisBusca(paisLista?.rotulo ?? (paisInicial || portugal?.rotulo || ""));
    setPaisValor(paisLista?.valor ?? (paisInicial ? "" : portugal?.valor ?? ""));
    setPaisAberto(false);
    setObservacao(cliente?.observacao ?? "");
    setPasso(cliente?.nome.trim() && cliente.telefone.trim() ? "acoes" : "cadastro");
    setModo("link");
    setContaEscolhida(totalBrasil != null && totalEuropa == null ? "br" : "pt");
    setValorTexto("");
    setValorConfirmado(null);
    setCodigoTexto("");
    setOrdemNumero(null);
    setOrdemCodigo(null);
    setLink(null);
    setQr(null);
    setCopiado(false);
    setErro(null);
    setSalvando(false);
    const foco = window.setTimeout(() => {
      if (!(cliente?.nome.trim() && cliente.telefone.trim())) nomeRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(foco);
  }, [open, idioma, cliente]);

  useEffect(() => {
    if (!open) return;
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !salvando) fecharRef.current();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [open, salvando, onClose]);

  useEffect(() => {
    if (passo !== "valor" && passo !== "codigo") return;
    const foco = window.setTimeout(() => {
      if (passo === "codigo") codigoRef.current?.focus();
      else valorRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(foco);
  }, [passo]);

  useEffect(() => {
    if (!link) {
      setQr(null);
      return;
    }
    let ativo = true;
    QRCode.toDataURL(link.url, { margin: 1, width: 280 })
      .then((dataUrl) => {
        if (ativo) setQr(dataUrl);
      })
      .catch(() => {
        if (ativo) setQr(null);
      });
    return () => {
      ativo = false;
    };
  }, [link]);

  if (!open) return null;

  const clienteAtual = () => {
    if (dadosProntos && cliente) {
      return {
        nomeLimpo: cliente.nome.trim(),
        telefoneLimpo: cliente.telefone.trim(),
        emailLimpo: cliente.email?.trim() ?? "",
        pais: cliente.pais?.trim() || null,
        observacaoLimpa: cliente.observacao?.trim() || null,
      };
    }

    const nomeLimpo = nome.trim();
    const telefoneLimpo = telefone.trim();
    const emailLimpo = email.trim();
    if (!nomeLimpo) {
      setErro(textos.nomeObrigatorio);
      nomeRef.current?.focus();
      return null;
    }
    if (!telefoneLimpo) {
      setErro(textos.telefoneObrigatorio);
      return null;
    }
    if (emailLimpo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
      setErro(textos.emailInvalido);
      return null;
    }
    const pais = resolverPais(paises, paisBusca, paisValor);
    if (pais === "") {
      setErro(textos.paisInvalido);
      return null;
    }
    return {
      nomeLimpo,
      telefoneLimpo,
      emailLimpo,
      pais: pais || null,
      observacaoLimpa: observacao.trim() || null,
    };
  };

  const persistir = async (
    dados: NonNullable<ReturnType<typeof clienteAtual>>,
  ) => {
    await catalogoKropCafeService.salvarSelecao({
      nome: dados.nomeLimpo,
      telefone: dados.telefoneLimpo,
      email: dados.emailLimpo || null,
      pais: dados.pais,
      observacao: dados.observacaoLimpa,
      gerarOrdem: false,
      vendedor: null,
      itens: itens.map((item) => ({
        id: item.id,
        sku: item.sku,
        numeracao: item.numeracao,
        preco: item.preco == null ? null : formatarMoeda(item.preco, item.moeda ?? "EUR"),
      })),
    });
  };

  const fechar = async () => {
    if (salvando) return;
    if (passo === "ordem" || passo === "salvo" || (passo === "link" && link)) {
      onClose();
      return;
    }
    const nomeInformado = (dadosProntos ? cliente?.nome : nome)?.trim() ?? "";
    const telefoneInformado = (dadosProntos ? cliente?.telefone : telefone)?.trim() ?? "";
    if (!nomeInformado || !telefoneInformado) {
      onClose();
      return;
    }
    const dados = clienteAtual();
    if (!dados) return;
    setSalvando(true);
    setErro(null);
    try {
      await persistir(dados);
      onClose();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  };
  fecharRef.current = () => {
    void fechar();
  };

  const avancarPagamento = async (proximo: ModoPagamento) => {
    const dados = clienteAtual();
    if (!dados) return;
    setSalvando(true);
    setErro(null);
    try {
      await persistir(dados);
      setModo(proximo);
      setPasso("conta");
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  };

  const salvar = async () => {
    const dados = clienteAtual();
    if (!dados) return;
    setSalvando(true);
    setErro(null);
    try {
      await persistir(dados);
      setPasso("salvo");
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  };

  const gerarLink = async (conta: ContaSumup, valor: number) => {
    const dados = clienteAtual();
    if (!dados) return;
    setSalvando(true);
    setErro(null);
    try {
      const itensPagamento = itens.map((item) => ({
        id: item.id,
        sku: item.sku,
        numeracao: item.numeracao,
        preco: item.preco == null ? null : formatarMoeda(item.preco, item.moeda ?? "EUR"),
      }));
      const preparo = await catalogoKropCafeService.abrirPagamento({
        nome: dados.nomeLimpo,
        telefone: dados.telefoneLimpo,
        email: dados.emailLimpo || null,
        pais: dados.pais,
        observacao: dados.observacaoLimpa,
        conta,
        valor,
        itens: itensPagamento,
      });
      const descricao = [dados.nomeLimpo, itens.map((item) => item.sku).filter(Boolean).slice(0, 8).join(", ")]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 140);
      if (preparo.link && preparo.link.conta === conta) {
        setLink({
          id: preparo.link.id,
          url: preparo.link.url,
          valor: preparo.link.valor,
          moeda: preparo.link.moeda,
        });
        setCopiado(false);
        setPasso("link");
        return;
      }
      const criado = await criarLinkPagamentoSumup({
        conta,
        valor,
        descricao: descricao || "Galeria KropCafé",
        pedido: {
          nome: dados.nomeLimpo,
          telefone: dados.telefoneLimpo,
          email: dados.emailLimpo || null,
          pais: dados.pais,
          observacao: dados.observacaoLimpa,
          itens: itensPagamento,
          id_cliente: preparo.id_cliente,
          id_vendedor: preparo.id_vendedor,
          id_carrinho: preparo.id_carrinho,
        },
      });
      setLink(criado);
      setCopiado(false);
      setPasso("link");
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  };

  const escolherConta = (conta: ContaSumup) => {
    const total = conta === "br" ? totalBrasil : totalEuropa;
    setErro(null);
    setContaEscolhida(conta);
    if (modo === "presencial") {
      if (total != null) {
        setValorConfirmado(total);
        setCodigoTexto("");
        setPasso("codigo");
        return;
      }
      setValorTexto("");
      setPasso("valor");
      return;
    }
    if (total != null) {
      void gerarLink(conta, total);
      return;
    }
    setValorTexto("");
    setPasso("valor");
  };

  const confirmarValor = () => {
    const valor = lerValorDigitado(valorTexto);
    if (valor == null) {
      setErro(textos.valorInvalido);
      valorRef.current?.focus();
      return;
    }
    if (modo === "presencial") {
      setValorConfirmado(valor);
      setCodigoTexto("");
      setErro(null);
      setPasso("codigo");
      return;
    }
    void gerarLink(contaEscolhida, valor);
  };

  const confirmarPresencial = async () => {
    const dados = clienteAtual();
    const codigo = codigoSumup(codigoTexto);
    if (!dados || valorConfirmado == null) return;
    if (!codigo) {
      setErro(textos.codigoInvalido);
      codigoRef.current?.focus();
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const ordem = await catalogoKropCafeService.confirmarPresencial({
        nome: dados.nomeLimpo,
        telefone: dados.telefoneLimpo,
        email: dados.emailLimpo || null,
        pais: dados.pais,
        observacao: dados.observacaoLimpa,
        conta: contaEscolhida,
        valor: valorConfirmado,
        codigo,
        itens: itens.map((item) => ({
          id: item.id,
          sku: item.sku,
          numeracao: item.numeracao,
          preco: item.preco == null ? null : formatarMoeda(item.preco, item.moeda ?? "EUR"),
        })),
      });
      setOrdemNumero(ordem.numero);
      setOrdemCodigo(ordem.codigo);
      setPasso("ordem");
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  };

  const copiarLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiado(true);
    } catch (err) {
      setErro(mensagemErro(err));
    }
  };

  const moedaEscolhida = moedaDaConta[contaEscolhida];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-stone-950/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
      onClick={() => {
        if (!salvando) void fechar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="max-h-[calc(100dvh-2rem-env(safe-area-inset-bottom,0px))] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-stone-950 p-5 text-white shadow-[0_16px_48px_rgba(0,0,0,0.4)]"
        onClick={(event) => event.stopPropagation()}
      >
        {passo === "salvo" ? (
          <>
            <h2 id={tituloId} className="text-xl font-black tracking-tight">
              {textos.selecaoSalvaTitulo}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-white/75">
              <span className="font-black text-white">{(cliente?.nome || nome).trim()}. </span>
              {textos.selecaoSalvaAviso}
            </p>
            <button
              type="button"
              onClick={onConcluido}
              className="mt-6 min-h-14 w-full rounded-full bg-[#d7b56d] px-5 text-base font-black text-stone-950 transition hover:bg-[#e2c688]"
            >
              {textos.novoAtendimento}
            </button>
          </>
        ) : passo === "ordem" ? (
          <>
            <h2 id={tituloId} className="text-xl font-black tracking-tight">
              {textos.ordemCriadaTitulo}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-white/75">
              <span className="font-black text-white">{(cliente?.nome || nome).trim()}. </span>
              {textos.ordemCriadaAviso}
            </p>
            <p className="mt-4 text-center text-2xl font-black text-[#d7b56d]">{ordemNumero}</p>
            <p className="mt-1 text-center font-numeric text-sm tracking-wide text-white/70">{ordemCodigo}</p>
            <button
              type="button"
              onClick={onConcluido}
              className="mt-6 min-h-14 w-full rounded-full bg-[#d7b56d] px-5 text-base font-black text-stone-950 transition hover:bg-[#e2c688]"
            >
              {textos.novoAtendimento}
            </button>
          </>
        ) : passo === "link" && link ? (
          <>
            <h2 id={tituloId} className="text-center text-xl font-black tracking-tight">
              {textos.linkGeradoTitulo}
            </h2>
            <p className="mt-2 text-center text-sm text-white/70">{textos.linkGeradoAviso}</p>
            <p className="mt-3 text-center text-2xl font-black text-[#d7b56d]">
              {formatarMoeda(link.valor, link.moeda)}
            </p>
            <div className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3">
              {qr ? (
                <img src={qr} alt="QR code do pagamento" className="h-64 w-64" />
              ) : (
                <div className="flex h-64 w-64 items-center justify-center text-sm text-stone-500">…</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => void copiarLink()}
              className="mt-4 h-11 w-full rounded-full border border-[#d7b56d]/70 px-4 text-sm font-black text-[#d7b56d] transition hover:bg-[#d7b56d]/10"
            >
              {copiado ? textos.linkCopiado : textos.copiarLink}
            </button>
            {erro ? <p className="mt-3 text-sm font-bold text-red-200">{erro}</p> : null}
            <button
              type="button"
              onClick={onConcluido}
              className="mt-3 min-h-14 w-full rounded-full bg-[#d7b56d] px-5 text-base font-black text-stone-950 transition hover:bg-[#e2c688]"
            >
              {textos.novoAtendimento}
            </button>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (passo === "valor") confirmarValor();
              else if (passo === "codigo") void confirmarPresencial();
              else void salvar();
            }}
            className="space-y-3"
          >
            {passo === "codigo" ? (
              <>
                <h2 id={tituloId} className="text-xl font-black tracking-tight">
                  {textos.pagamentoPresencial}
                </h2>
                <p className="text-sm leading-relaxed text-white/70">{textos.codigoSumupAjuda}</p>
                {valorConfirmado != null ? (
                  <p className="text-center text-2xl font-black text-[#d7b56d]">
                    {formatarMoeda(valorConfirmado, moedaEscolhida)}
                  </p>
                ) : null}
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-white/70">{textos.codigoSumup}</span>
                  <input
                    ref={codigoRef}
                    value={codigoTexto}
                    onChange={(event) => setCodigoTexto(event.target.value.toUpperCase())}
                    autoCapitalize="characters"
                    autoComplete="off"
                    placeholder="T…"
                    className={cn(campoClasse, "font-numeric uppercase")}
                  />
                </label>
              </>
            ) : passo === "valor" ? (
              <>
                <h2 id={tituloId} className="text-xl font-black tracking-tight">
                  {contaEscolhida === "br" ? textos.sumupBrasil : textos.sumupEuropa}
                </h2>
                <p className="text-sm leading-relaxed text-white/70">{textos.valorOutraMoeda}</p>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-white/70">{moedaEscolhida}</span>
                  <input
                    ref={valorRef}
                    value={valorTexto}
                    onChange={(event) => setValorTexto(event.target.value)}
                    inputMode="decimal"
                    autoComplete="off"
                    className={campoClasse}
                  />
                </label>
              </>
            ) : passo === "conta" ? (
              <>
                <h2 id={tituloId} className="text-xl font-black tracking-tight">
                  {modo === "presencial" ? textos.pagamentoPresencial : textos.gerarPagamento}
                </h2>
                <div className="flex flex-col gap-3">
                  {(totalBrasil != null && totalEuropa == null ? (["br", "pt"] as const) : (["pt", "br"] as const)).map((conta) => {
                    const total = conta === "br" ? totalBrasil : totalEuropa;
                    const principal = total != null;
                    const gerando = salvando && contaEscolhida === conta;
                    return (
                      <button
                        key={conta}
                        type="button"
                        disabled={salvando}
                        onClick={() => escolherConta(conta)}
                        className={cn(
                          "flex min-h-[4.75rem] w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition active:scale-[0.98] disabled:opacity-60",
                          principal
                            ? "bg-[#146c43] text-white shadow-[0_10px_28px_rgba(20,108,67,0.35)] hover:bg-[#1c8a52]"
                            : "border border-white/15 bg-white/[0.04] text-white hover:border-[#d7b56d]/70 hover:bg-white/[0.07]",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block text-base font-black tracking-tight">
                            {conta === "br" ? textos.sumupBrasil : textos.sumupEuropa}
                          </span>
                          <span className={cn("mt-0.5 block text-xs font-semibold", principal ? "text-white/75" : "text-white/50")}>
                            {gerando ? "…" : principal ? textos.usarValorItens : textos.informarValor}
                          </span>
                        </span>
                        <span className={cn("shrink-0 text-right text-lg font-black tabular-nums", principal ? "text-white" : "text-[#d7b56d]")}>
                          {total != null ? formatarMoeda(total, moedaDaConta[conta]) : moedaDaConta[conta]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : passo === "acoes" ? (
              <>
                <h2 id={tituloId} className="text-center text-xl font-black tracking-tight">
                  {cliente?.nome}
                </h2>
                {cliente?.telefone ? (
                  <p className="text-center text-sm text-white/60">{cliente.telefone}</p>
                ) : null}
              </>
            ) : (
              <>
                <h2 id={tituloId} className="text-center text-xl font-black tracking-tight">
                  {textos.cadastroTitulo}
                </h2>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-white/70">{textos.nome}</span>
                  <input
                    ref={nomeRef}
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                    required
                    autoComplete="name"
                    className={campoClasse}
                  />
                </label>
                <div>
                  <span className="mb-1 block text-xs font-semibold text-white/70">{textos.telefone}</span>
                  <TelefoneComDdi
                    valor={telefone}
                    onChange={setTelefone}
                    idioma={idioma}
                    codigoSugerido={codigoPais}
                    onCodigoChange={(codigo) => {
                      const pais = paises.find((item) => item.codigo === codigo);
                      if (!pais) return;
                      setCodigoPais(codigo);
                      setPaisBusca(pais.rotulo);
                      setPaisValor(pais.valor);
                      setPaisAberto(false);
                    }}
                    variante="catalogo"
                    required
                  />
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-white/70">{textos.email}</span>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    className={campoClasse}
                  />
                </label>
                <div>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-white/70">{textos.pais}</span>
                    <input
                      value={paisBusca}
                      onChange={(event) => {
                        setPaisBusca(event.target.value);
                        setPaisValor("");
                        setPaisAberto(true);
                      }}
                      onFocus={() => setPaisAberto(true)}
                      placeholder={textos.buscarPais}
                      autoComplete="off"
                      role="combobox"
                      aria-expanded={paisAberto}
                      className={campoClasse}
                    />
                  </label>
                  {paisAberto ? (
                    <ul className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.04] py-1">
                      <li>
                        <button
                          type="button"
                          onClick={() => {
                            setPaisBusca("");
                            setPaisValor("");
                            setPaisAberto(false);
                          }}
                          className="min-h-9 w-full px-3 text-left text-sm text-white/55 hover:bg-white/10"
                        >
                          {textos.semPais}
                        </button>
                      </li>
                      {paisesFiltrados.map((pais) => (
                        <li key={pais.codigo}>
                          <button
                            type="button"
                            onClick={() => {
                              setPaisBusca(pais.rotulo);
                              setPaisValor(pais.valor);
                              setCodigoPais(pais.codigo);
                              setPaisAberto(false);
                            }}
                            className={cn(
                              "min-h-9 w-full px-3 text-left text-sm hover:bg-white/10",
                              pais.valor === paisValor ? "text-[#d7b56d]" : "text-white",
                            )}
                          >
                            {pais.rotulo}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-white/70">{textos.observacao}</span>
                  <textarea
                    value={observacao}
                    onChange={(event) => setObservacao(event.target.value)}
                    rows={2}
                    className={cn(campoClasse, "h-16 resize-none py-2")}
                  />
                </label>
              </>
            )}

            {erro ? <p className="text-sm font-bold text-red-200">{erro}</p> : null}

            <div className="flex flex-col gap-2 pt-1">
              {passo === "codigo" ? (
                <>
                  <button
                    type="submit"
                    disabled={salvando || !codigoSumup(codigoTexto)}
                    className="h-11 rounded-full bg-[#146c43] px-4 text-sm font-black text-white transition hover:bg-[#1c8a52] disabled:opacity-60"
                  >
                    {textos.confirmarPresencial}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setErro(null);
                      const total = contaEscolhida === "br" ? totalBrasil : totalEuropa;
                      setPasso(total == null ? "valor" : "conta");
                    }}
                    disabled={salvando}
                    className="h-10 rounded-full border border-[#7eb6e0]/50 bg-[#7eb6e0]/12 px-4 text-sm font-bold text-[#d6ebff] transition hover:border-[#7eb6e0] hover:bg-[#7eb6e0]/22 disabled:opacity-60"
                  >
                    {textos.voltar}
                  </button>
                </>
              ) : passo === "valor" ? (
                <>
                  <button
                    type="submit"
                    disabled={salvando}
                    className="h-11 rounded-full bg-[#146c43] px-4 text-sm font-black text-white transition hover:bg-[#1c8a52] disabled:opacity-60"
                  >
                    {modo === "presencial" ? textos.seguir : textos.gerarPagamento}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setErro(null);
                      setPasso("conta");
                    }}
                    disabled={salvando}
                    className="h-10 rounded-full border border-[#7eb6e0]/50 bg-[#7eb6e0]/12 px-4 text-sm font-bold text-[#d6ebff] transition hover:border-[#7eb6e0] hover:bg-[#7eb6e0]/22 disabled:opacity-60"
                  >
                    {textos.voltar}
                  </button>
                </>
              ) : passo === "conta" ? (
                <button
                  type="button"
                  onClick={() => {
                    setErro(null);
                    setPasso(dadosProntos ? "acoes" : "cadastro");
                  }}
                  disabled={salvando}
                  className="h-10 rounded-full border border-[#7eb6e0]/50 bg-[#7eb6e0]/12 px-4 text-sm font-bold text-[#d6ebff] transition hover:border-[#7eb6e0] hover:bg-[#7eb6e0]/22 disabled:opacity-60"
                >
                  {textos.voltar}
                </button>
              ) : (
                <>
                  <button
                    type="submit"
                    disabled={salvando}
                    className="h-11 rounded-full bg-[#d7b56d] px-4 text-sm font-black text-stone-950 transition hover:bg-[#e2c688] disabled:opacity-60"
                  >
                    {dadosProntos ? textos.salvarSelecao : textos.salvarCliente}
                  </button>
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => void avancarPagamento("link")}
                    className="h-11 rounded-full bg-[#146c43] px-4 text-sm font-black text-white transition hover:bg-[#1c8a52] disabled:opacity-60"
                  >
                    {textos.gerarPagamento}
                  </button>
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => void avancarPagamento("presencial")}
                    className="h-11 rounded-full border border-[#d7b56d]/70 px-4 text-sm font-black text-[#d7b56d] transition hover:bg-[#d7b56d]/10 disabled:opacity-60"
                  >
                    {textos.pagamentoPresencial}
                  </button>
                  <button
                    type="button"
                    onClick={() => void fechar()}
                    disabled={salvando}
                    className="h-10 rounded-full border border-white/15 px-4 text-sm font-semibold text-white/75 transition hover:border-white/40 hover:text-white disabled:opacity-60"
                  >
                    {textos.cancelar}
                  </button>
                </>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
