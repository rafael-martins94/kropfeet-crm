import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { BrandLogo } from "../../components/BrandLogo";
import { EnderecoClienteCampos } from "../../components/clientes/EnderecoClienteCampos";
import { TelefoneComDdi } from "../../components/clientes/TelefoneComDdi";
import { FormInput } from "../../components/FormField";
import { IconCheck } from "../../components/Icons";
import { FotosTenisCarrossel } from "../../components/links-pedido/FotosTenisCarrossel";
import { InlineLoader } from "../../components/LoadingState";
import { useAsync } from "../../hooks/useAsync";
import {
  abrirLinkPublico,
  consultarPagamentoLink,
  iniciarPagamentoLink,
  type ItemPublico,
} from "../../services/links-pedido";
import type { EnderecoClienteForm } from "../../services/enderecos-cliente";
import { formatarCpf } from "../../utils/documento";
import { formatarDataHora, formatarMoeda } from "../../utils/format";
import { mensagemErro } from "../../utils/errors";
import { numeracaoVisivel } from "../../utils/linkPedido";
import { cn } from "../../utils/cn";

function enderecoInicial(pais: string): EnderecoClienteForm {
  return {
    rotulo: "",
    principal: true,
    cep: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    pais,
  };
}

function chaveCheckout(token: string) {
  return `kf:link-checkout:${token}`;
}

export default function LinkPedidoPublicoPage() {
  const { token = "" } = useParams();
  const pagina = useAsync(() => abrirLinkPublico(token), [token]);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [etapa, setEtapa] = useState<"vitrine" | "conferir" | "dados" | "retorno">("vitrine");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [endereco, setEndereco] = useState<EnderecoClienteForm>(enderecoInicial("Brasil"));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [retorno, setRetorno] = useState<string | null>(null);

  const link = pagina.data;
  const brasil = link?.destino !== "europa";

  useEffect(() => {
    if (!link?.destino) return;
    setEndereco((atual) => ({ ...atual, pais: link.destino === "europa" ? "Portugal" : "Brasil" }));
  }, [link?.destino]);

  useEffect(() => {
    const guardado = sessionStorage.getItem(chaveCheckout(token));
    if (!guardado) return;
    setEtapa("retorno");
    let parado = false;
    let timer = 0;
    const consultar = async () => {
      try {
        const status = await consultarPagamentoLink(token, guardado);
        if (parado) return;
        if (status.situacao === "confirmado") {
          setRetorno("Pagamento confirmado. A ordem de venda foi registrada.");
          sessionStorage.removeItem(chaveCheckout(token));
          window.clearInterval(timer);
          return;
        }
        if (status.situacao === "recusado" || status.situacao === "cancelado" || status.situacao === "expirado") {
          setRetorno("O pagamento não foi confirmado. Você pode escolher os pares de novo.");
          sessionStorage.removeItem(chaveCheckout(token));
          window.clearInterval(timer);
          return;
        }
        setRetorno(status.confirmacao || "Pagamento em processamento. Esta página atualiza sozinha.");
      } catch (falha) {
        if (!parado) setRetorno(mensagemErro(falha));
      }
    };
    void consultar();
    timer = window.setInterval(() => void consultar(), 4000);
    return () => {
      parado = true;
      window.clearInterval(timer);
    };
  }, [token]);

  const itens = link?.itens ?? [];
  const carrinho = useMemo(
    () => itens.filter((item) => escolhidos.includes(item.id) && item.disponivel),
    [itens, escolhidos],
  );
  const total = carrinho.reduce((soma, item) => soma + Number(item.preco), 0);

  const alternar = (item: ItemPublico) => {
    if (!item.disponivel || link?.situacao !== "ativo") return;
    setEscolhidos((atual) => (atual.includes(item.id) ? atual.filter((id) => id !== item.id) : [...atual, item.id]));
  };

  const revisaoPedido = (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {carrinho.map((item) => {
        return (
          <li key={item.id} className="overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-line">
            <FotosTenisCarrossel fotos={item.fotos} fotoPrincipal={item.foto} />
            <div className="space-y-2 p-4">
              <h2 className="font-numeric text-base font-semibold">{item.sku}</h2>
              <p className="text-sm text-ink-soft">{numeracaoVisivel(item) || "Sem numeração"}</p>
              <div className="flex items-center justify-between gap-3">
                <span className="font-numeric text-lg font-semibold">{formatarMoeda(Number(item.preco), item.moeda)}</span>
                <button type="button" className="btn-secondary" onClick={() => alternar(item)}>
                  Remover
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );

  const pagar = async () => {
    setErro(null);
    setEnviando(true);
    try {
      const resultado = await iniciarPagamentoLink({
        token,
        itens: carrinho.map((item) => item.id),
        nome,
        email,
        telefone,
        cpf: brasil ? cpf : null,
        nascimento: brasil ? nascimento : null,
        endereco: {
          cep: endereco.cep,
          endereco: endereco.endereco,
          numero: endereco.numero,
          complemento: endereco.complemento,
          bairro: endereco.bairro,
          cidade: endereco.cidade,
          uf: endereco.uf,
          pais: endereco.pais,
        },
      });
      sessionStorage.setItem(chaveCheckout(token), resultado.id);
      window.location.assign(resultado.url);
    } catch (falha) {
      setErro(mensagemErro(falha));
      setEnviando(false);
    }
  };

  return (
    <main className="min-h-screen bg-surface-muted pb-28 text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <BrandLogo size="md" />
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Pedido</span>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-6">
        {pagina.loading ? <InlineLoader label="Abrindo o link…" /> : null}
        {!pagina.loading && pagina.error ? <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{pagina.error.message}</p> : null}
        {!pagina.loading && link && !link.encontrado ? (
          <p className="rounded-xl bg-surface p-6 text-sm text-ink-muted">Este link não existe.</p>
        ) : null}
        {!pagina.loading && link?.encontrado ? (
          <div className="space-y-6">
            {etapa === "vitrine" || etapa === "retorno" ? (
            <section className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line">
              <p className="text-sm text-ink-soft">Olá, {link.tratamento}</p>
              <h1 className="mt-1 font-display text-2xl font-semibold text-brand-700 sm:text-3xl">Seus tênis</h1>
              {link.mensagem ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink">{link.mensagem}</p> : null}
              <p className="mt-3 text-xs font-medium text-ink-soft">
                Válido até {formatarDataHora(link.validade_em)} · {link.destino === "europa" ? "Europa" : "Brasil"} · {link.moeda}
              </p>
              {link.situacao !== "ativo" ? (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {link.situacao === "expirado" ? "Este link expirou. Não é possível comprar." : "Este link foi desativado. Não é possível comprar."}
                </p>
              ) : null}
            </section>
            ) : null}

            {retorno ? (
              <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">{retorno}</p>
            ) : null}

            {etapa === "vitrine" ? (
              <>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {itens.map((item) => {
                    const ativo = escolhidos.includes(item.id);
                    return (
                      <li
                        key={item.id}
                        className={cn(
                          "overflow-hidden rounded-2xl shadow-sm transition-colors duration-200",
                          ativo ? "bg-brand-50 ring-2 ring-brand-600" : "bg-surface ring-1 ring-line",
                        )}
                      >
                        <FotosTenisCarrossel fotos={item.fotos} fotoPrincipal={item.foto}>
                          {ativo ? (
                            <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-brand-700 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                              <IconCheck width={14} height={14} />
                              No carrinho
                            </span>
                          ) : null}
                        </FotosTenisCarrossel>
                        <div className="space-y-2 p-4">
                          <h2 className="font-numeric text-base font-semibold">{item.sku}</h2>
                          <p className="text-sm text-ink-soft">{numeracaoVisivel(item)}</p>
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-numeric text-lg font-semibold">{formatarMoeda(Number(item.preco), item.moeda)}</span>
                            <button
                              type="button"
                              disabled={!item.disponivel || link.situacao !== "ativo"}
                              onClick={() => alternar(item)}
                              className={cn(ativo ? "btn-secondary" : "btn-primary", "disabled:opacity-50")}
                            >
                              {!item.disponivel ? "Indisponível" : ativo ? "Remover" : "Adicionar"}
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-brand-700 px-4 py-3 text-white shadow-lg">
                  <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-numeric text-lg font-semibold">{formatarMoeda(total, link.moeda ?? "BRL")}</p>
                      <p className="text-xs text-white/80">
                        {carrinho.length === 0
                          ? "Nenhum item"
                          : `${carrinho.length} ${carrinho.length === 1 ? "item" : "itens"} no pedido`}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary !bg-white"
                      disabled={carrinho.length === 0}
                      onClick={() => {
                        setEtapa("conferir");
                        window.scrollTo({ top: 0 });
                      }}
                    >
                      Revisar pedido
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            {etapa === "conferir" ? (
              <>
                <div>
                  <h1 className="font-display text-2xl font-semibold text-brand-700 sm:text-3xl">Revise seus tênis</h1>
                  <p className="mt-1 text-sm text-ink-soft">Confira os pares e as numerações antes de finalizar.</p>
                </div>
                {carrinho.length === 0 ? (
                  <p className="rounded-2xl bg-surface p-6 text-sm text-ink-soft shadow-sm ring-1 ring-line">
                    Nenhum tênis no pedido. Volte e escolha os pares.
                  </p>
                ) : (
                  revisaoPedido
                )}
                <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-brand-700 px-4 py-3 text-white shadow-lg">
                  <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-numeric text-lg font-semibold">{formatarMoeda(total, link.moeda ?? "BRL")}</p>
                      <p className="text-xs text-white/80">
                        {carrinho.length} {carrinho.length === 1 ? "item" : "itens"} no pedido
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        className="btn border border-white bg-transparent font-semibold text-white hover:bg-white/15"
                        onClick={() => {
                          setEtapa("vitrine");
                          window.scrollTo({ top: 0 });
                        }}
                      >
                        Escolher mais
                      </button>
                      <button
                        type="button"
                        className="btn-secondary !bg-white"
                        disabled={carrinho.length === 0}
                        onClick={() => {
                          setEtapa("dados");
                          window.scrollTo({ top: 0 });
                        }}
                      >
                        Finalizar
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {etapa === "dados" ? (
              <section className="space-y-4 rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line">
                <div className="flex items-end justify-between gap-3">
                  <h2 className="text-lg font-semibold">Seus dados</h2>
                  <p className="text-sm text-ink-soft">
                    {carrinho.length} {carrinho.length === 1 ? "item" : "itens"} ·{" "}
                    <span className="font-numeric font-semibold text-ink">{formatarMoeda(total, link.moeda ?? "BRL")}</span>
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormInput label="Nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
                  <FormInput label="E-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  <div className="sm:col-span-2">
                    <span className="label-base mb-1 block">Telefone</span>
                    <TelefoneComDdi valor={telefone} onChange={setTelefone} codigoSugerido={brasil ? "BR" : "PT"} required />
                  </div>
                  {brasil ? (
                    <>
                      <FormInput label="CPF" required value={cpf} onChange={(e) => setCpf(formatarCpf(e.target.value))} inputMode="numeric" />
                      <FormInput label="Data de nascimento" type="date" required value={nascimento} onChange={(e) => setNascimento(e.target.value)} />
                    </>
                  ) : null}
                </div>
                <EnderecoClienteCampos value={endereco} onChange={(parte) => setEndereco((atual) => ({ ...atual, ...parte }))} />
                {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
                <div className="flex flex-wrap justify-between gap-3">
                  <button type="button" className="btn-secondary" onClick={() => setEtapa("conferir")}>Voltar</button>
                  <button type="button" className="btn-primary" disabled={enviando || carrinho.length === 0} onClick={() => void pagar()}>
                    {enviando ? "Abrindo pagamento…" : `Pagar ${formatarMoeda(total, link.moeda ?? "BRL")}`}
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
