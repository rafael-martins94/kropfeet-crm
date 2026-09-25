import { useEffect, useId, useMemo, useRef, useState } from "react";
import { catalogoKropCafeService } from "../../services/catalogo-kropcafe";
import { TelefoneComDdi } from "../clientes/TelefoneComDdi";
import { filtrarPaises, listarPaises, resolverPais } from "../../utils/paises";
import { mensagemErro } from "../../utils/errors";
import { cn } from "../../utils/cn";

export type ItemSelecaoGaleria = {
  id: string;
  sku: string;
  numeracao: string;
  preco: string | null;
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
  salvarGerarOrdem: string;
  vendedor: string;
  vendedorAjuda: string;
  vendedorObrigatorio: string;
  escolherVendedor: string;
  voltar: string;
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
};

type SalvarSelecaoModalProps = {
  open: boolean;
  idioma: string;
  itens: ItemSelecaoGaleria[];
  textos: TextosSalvarSelecao;
  onClose: () => void;
  onConcluido: () => void;
};

const campoClasse =
  "h-11 w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#d7b56d] focus:ring-2 focus:ring-[#d7b56d]/25";

export function SalvarSelecaoModal({
  open,
  idioma,
  itens,
  textos,
  onClose,
  onConcluido,
}: SalvarSelecaoModalProps) {
  const tituloId = useId();
  const nomeRef = useRef<HTMLInputElement>(null);
  const vendedorRef = useRef<HTMLButtonElement>(null);
  const listaVendedorRef = useRef<HTMLDivElement>(null);
  const concluirRef = useRef<HTMLButtonElement>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [codigoPais, setCodigoPais] = useState("PT");
  const [email, setEmail] = useState("");
  const [paisBusca, setPaisBusca] = useState("");
  const [paisValor, setPaisValor] = useState("");
  const [paisAberto, setPaisAberto] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [vendedores, setVendedores] = useState<Array<{ id: string; nome: string }>>([]);
  const [carregandoVendedores, setCarregandoVendedores] = useState(false);
  const [listaVendedorAberta, setListaVendedorAberta] = useState(false);
  const [passoVendedor, setPassoVendedor] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [ordem, setOrdem] = useState<{ id: string; numero: string | null } | null>(null);

  const paises = useMemo(() => listarPaises(idioma), [idioma]);
  const paisesFiltrados = useMemo(
    () => filtrarPaises(paises, paisBusca),
    [paises, paisBusca],
  );

  useEffect(() => {
    if (!open) return;
    setNome("");
    setTelefone("");
    setCodigoPais("PT");
    setEmail("");
    const portugal = listarPaises(idioma).find((pais) => pais.codigo === "PT");
    setPaisBusca(portugal?.rotulo ?? "");
    setPaisValor(portugal?.valor ?? "");
    setPaisAberto(false);
    setObservacao("");
    setVendedor("");
    setVendedores([]);
    setCarregandoVendedores(false);
    setListaVendedorAberta(false);
    setPassoVendedor(false);
    setErro(null);
    setSalvando(false);
    setSalvo(false);
    setOrdem(null);
    const foco = window.setTimeout(() => nomeRef.current?.focus(), 0);
    return () => window.clearTimeout(foco);
  }, [open, idioma]);

  useEffect(() => {
    if (!open) return;
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || salvando) return;
      if (listaVendedorAberta) {
        setListaVendedorAberta(false);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [open, salvando, onClose, listaVendedorAberta]);

  useEffect(() => {
    if (!listaVendedorAberta) return;
    const fechar = (event: PointerEvent) => {
      if (!listaVendedorRef.current?.contains(event.target as Node)) setListaVendedorAberta(false);
    };
    window.addEventListener("pointerdown", fechar);
    return () => window.removeEventListener("pointerdown", fechar);
  }, [listaVendedorAberta]);

  useEffect(() => {
    if (!passoVendedor) return;
    const foco = window.setTimeout(() => vendedorRef.current?.focus(), 0);
    let ativo = true;
    setCarregandoVendedores(true);
    catalogoKropCafeService
      .listarVendedores()
      .then((lista) => {
        if (ativo) setVendedores(lista);
      })
      .catch((err) => {
        if (ativo) setErro(mensagemErro(err));
      })
      .finally(() => {
        if (ativo) setCarregandoVendedores(false);
      });
    return () => {
      ativo = false;
      window.clearTimeout(foco);
    };
  }, [passoVendedor]);

  if (!open) return null;

  const vendedorNome = vendedores.find((item) => item.id === vendedor)?.nome;

  const validarCliente = () => {
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

    return { nomeLimpo, telefoneLimpo, emailLimpo, pais };
  };

  const avancarParaVendedor = () => {
    if (!validarCliente()) return;
    setErro(null);
    setPassoVendedor(true);
  };

  const voltarCadastro = () => {
    setErro(null);
    setListaVendedorAberta(false);
    setPassoVendedor(false);
    window.setTimeout(() => nomeRef.current?.focus(), 0);
  };

  const salvar = async (gerarOrdem: boolean) => {
    const cliente = validarCliente();
    if (!cliente) return;

    const vendedorLimpo = vendedor.trim();
    if (gerarOrdem && !vendedorLimpo) {
      setErro(textos.vendedorObrigatorio);
      vendedorRef.current?.focus();
      return;
    }

    const { nomeLimpo, telefoneLimpo, emailLimpo, pais } = cliente;

    setSalvando(true);
    setErro(null);
    try {
      const resultado = await catalogoKropCafeService.salvarSelecao({
        nome: nomeLimpo,
        telefone: telefoneLimpo,
        email: emailLimpo || null,
        pais: pais || null,
        observacao: observacao.trim() || null,
        gerarOrdem,
        vendedor: gerarOrdem ? vendedorLimpo : null,
        itens,
      });
      setOrdem(
        resultado.id_venda ? { id: resultado.id_venda, numero: resultado.numero } : null,
      );
      setSalvo(true);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-stone-950/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
      onClick={() => {
        if (!salvando) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="max-h-[calc(100dvh-2rem-env(safe-area-inset-bottom,0px))] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-stone-950 p-5 text-white shadow-[0_16px_48px_rgba(0,0,0,0.4)]"
        onClick={(event) => event.stopPropagation()}
      >
        {salvo ? (
          <>
            <h2 id={tituloId} className="text-xl font-black tracking-tight">
              {ordem ? textos.ordemCriadaTitulo : textos.selecaoSalvaTitulo}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-white/75">
              <span className="font-black text-white">{nome.trim()}. </span>
              {ordem ? textos.ordemCriadaAviso : textos.selecaoSalvaAviso}
            </p>
            {ordem?.numero ? (
              <p className="mt-4 text-xl font-black tracking-tight text-[#d7b56d]">{ordem.numero}</p>
            ) : null}
            <div className="mt-6 flex flex-col gap-3">
              {ordem ? (
                <a
                  href={`/vendas/${ordem.id}`}
                  className="flex min-h-14 items-center justify-center rounded-full border border-[#d7b56d]/70 px-5 text-base font-black text-[#d7b56d] transition hover:bg-[#d7b56d]/10"
                >
                  {textos.verOrdem}
                </a>
              ) : null}
              <button
                ref={concluirRef}
                type="button"
                onClick={onConcluido}
                className="min-h-14 w-full rounded-full bg-[#d7b56d] px-5 text-base font-black text-stone-950 transition hover:bg-[#e2c688]"
              >
                {textos.novoAtendimento}
              </button>
            </div>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (passoVendedor) void salvar(true);
              else void salvar(false);
            }}
            className="space-y-3"
          >
            {passoVendedor ? (
              <>
                <h2 id={tituloId} className="text-xl font-black tracking-tight">
                  {textos.vendedor}
                </h2>
                <div ref={listaVendedorRef}>
                  <span className="mb-1 block text-xs font-semibold text-white/70">{textos.vendedor}</span>
                  <button
                    ref={vendedorRef}
                    type="button"
                    disabled={carregandoVendedores || vendedores.length === 0}
                    aria-expanded={listaVendedorAberta}
                    aria-haspopup="listbox"
                    onClick={() => setListaVendedorAberta((aberta) => !aberta)}
                    className={cn(campoClasse, "flex items-center justify-between text-left")}
                  >
                    <span className={vendedorNome ? "text-white" : "text-white/45"}>
                      {carregandoVendedores ? "…" : vendedorNome ?? textos.escolherVendedor}
                    </span>
                  </button>
                  {listaVendedorAberta ? (
                    <ul
                      role="listbox"
                      className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-stone-900 py-1"
                    >
                      {vendedores.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={item.id === vendedor}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setVendedor(item.id);
                              setListaVendedorAberta(false);
                            }}
                            className={cn(
                              "flex min-h-9 w-full items-center px-3 text-left text-sm text-white hover:bg-white/10",
                              item.id === vendedor && "bg-white/10 font-semibold text-[#d7b56d]",
                            )}
                          >
                            {item.nome}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <span className="mt-1 block text-[0.7rem] text-white/45">{textos.vendedorAjuda}</span>
                </div>
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
              {passoVendedor ? (
                <>
                  <button
                    type="submit"
                    disabled={salvando}
                    className="h-11 rounded-full bg-[#146c43] px-4 text-sm font-black text-white transition hover:bg-[#1c8a52] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#146c43] disabled:opacity-60"
                  >
                    {textos.salvarGerarOrdem}
                  </button>
                  <button
                    type="button"
                    onClick={voltarCadastro}
                    disabled={salvando}
                    className="h-10 rounded-full border border-[#7eb6e0]/50 bg-[#7eb6e0]/12 px-4 text-sm font-bold text-[#d6ebff] transition hover:border-[#7eb6e0] hover:bg-[#7eb6e0]/22 disabled:opacity-60"
                  >
                    {textos.voltar}
                  </button>
                </>
              ) : (
                <>
              <button
                type="submit"
                disabled={salvando}
                className="h-11 rounded-full bg-[#d7b56d] px-4 text-sm font-black text-stone-950 transition hover:bg-[#e2c688] disabled:opacity-60"
              >
                {textos.salvarCliente}
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={avancarParaVendedor}
                className="h-11 rounded-full bg-[#146c43] px-4 text-sm font-black text-white transition hover:bg-[#1c8a52] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#146c43] disabled:opacity-60"
              >
                {textos.salvarGerarOrdem}
              </button>
              <button
                type="button"
                onClick={onClose}
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
