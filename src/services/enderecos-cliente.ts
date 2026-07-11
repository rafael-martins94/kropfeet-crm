import { supabase } from "../lib/supabase";
import type {
  EnderecoCliente,
  EnderecoClienteInsert,
  EnderecoClienteUpdate,
} from "../types/entities";
import { chaveEndereco, enderecoTemDados, type DadosEndereco } from "../utils/endereco";

export type EnderecoClienteForm = {
  id?: string;
  rotulo: string;
  principal: boolean;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  pais: string;
};

function limparCampo(s: string): string | null {
  const t = s.trim();
  return t === "" ? null : t;
}

function paraInsert(
  idCliente: string,
  e: EnderecoClienteForm,
): EnderecoClienteInsert {
  return {
    id_cliente: idCliente,
    rotulo: limparCampo(e.rotulo),
    principal: e.principal,
    cep: limparCampo(e.cep),
    endereco: limparCampo(e.endereco),
    numero: limparCampo(e.numero),
    complemento: limparCampo(e.complemento),
    bairro: limparCampo(e.bairro),
    cidade: limparCampo(e.cidade),
    uf: limparCampo(e.uf),
    pais: limparCampo(e.pais) ?? "Brasil",
  };
}

export const enderecosClienteService = {
  listarPorCliente: async (idCliente: string): Promise<EnderecoCliente[]> => {
    const { data, error } = await supabase
      .from("enderecos_cliente")
      .select("*")
      .eq("id_cliente", idCliente)
      .order("principal", { ascending: false })
      .order("criado_em", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  obterPrincipal: async (idCliente: string): Promise<EnderecoCliente | null> => {
    const { data, error } = await supabase
      .from("enderecos_cliente")
      .select("*")
      .eq("id_cliente", idCliente)
      .eq("principal", true)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  salvarTodos: async (idCliente: string, enderecos: EnderecoClienteForm[]) => {
    const validos = enderecos.filter((e) => enderecoTemDados(e));
    const comPrincipal =
      validos.some((e) => e.principal) || validos.length === 0
        ? validos
        : validos.map((e, i) => ({ ...e, principal: i === 0 }));

    const existentes = await enderecosClienteService.listarPorCliente(idCliente);
    const idsMantidos = new Set(
      comPrincipal.map((e) => e.id).filter((v): v is string => Boolean(v)),
    );

    const paraRemover = existentes.filter((e) => !idsMantidos.has(e.id));
    if (paraRemover.length > 0) {
      const { error } = await supabase
        .from("enderecos_cliente")
        .delete()
        .in(
          "id",
          paraRemover.map((e) => e.id),
        );
      if (error) throw error;
    }

    for (const endereco of comPrincipal) {
      const payload = paraInsert(idCliente, endereco);
      if (endereco.id) {
        const { error } = await supabase
          .from("enderecos_cliente")
          .update(payload as EnderecoClienteUpdate)
          .eq("id", endereco.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("enderecos_cliente").insert(payload);
        if (error) throw error;
      }
    }
  },

  obterOuCriarPorDados: async (
    idCliente: string,
    dados: DadosEndereco,
    rotulo = "Entrega",
  ): Promise<string | null> => {
    if (!enderecoTemDados(dados)) return null;

    const existentes = await enderecosClienteService.listarPorCliente(idCliente);
    const chave = chaveEndereco(dados);
    const match = existentes.find((e) => chaveEndereco(e) === chave);
    if (match) return match.id;

    const principal = existentes.length === 0;
    const { data, error } = await supabase
      .from("enderecos_cliente")
      .insert({
        id_cliente: idCliente,
        rotulo,
        principal,
        cep: dados.cep?.trim() || null,
        endereco: dados.endereco?.trim() || null,
        numero: dados.numero?.trim() || null,
        complemento: dados.complemento?.trim() || null,
        bairro: dados.bairro?.trim() || null,
        cidade: dados.cidade?.trim() || null,
        uf: dados.uf?.trim() || null,
        pais: dados.pais?.trim() || "Brasil",
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  },
};
