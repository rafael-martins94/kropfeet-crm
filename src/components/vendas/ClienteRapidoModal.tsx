import { useEffect, useState, type FormEvent } from "react";
import { EnderecoClienteCampos } from "../clientes/EnderecoClienteCampos";
import { enderecoVazio } from "../clientes/EnderecosClienteEditor";
import { FormInput } from "../FormField";
import { Modal } from "../Modal";
import { PrimaryButton, SecondaryButton } from "../PrimaryButton";
import { clientesService } from "../../services/clientes";
import {
  enderecosClienteService,
  type EnderecoClienteForm,
} from "../../services/enderecos-cliente";
import type { TipoRegiao } from "../../types/entities";
import { enderecoTemDados } from "../../utils/endereco";
import { mensagemErro } from "../../utils/errors";

type ClienteNovoForm = {
  nome: string;
  email: string;
  telefone: string;
  pais: string;
};

export type ClienteRapidoCriado = {
  id: string;
  nome: string;
  idEndereco: string | null;
};

type ClienteRapidoModalProps = {
  open: boolean;
  onClose: () => void;
  regiao: TipoRegiao;
  onCriado: (cliente: ClienteRapidoCriado) => void;
};

function paisPorRegiao(regiao: TipoRegiao): string {
  return regiao === "europa" ? "Europa" : "Brasil";
}

function clienteVazio(regiao: TipoRegiao): ClienteNovoForm {
  return {
    nome: "",
    email: "",
    telefone: "",
    pais: paisPorRegiao(regiao),
  };
}

function enderecoInicial(regiao: TipoRegiao): EnderecoClienteForm {
  return {
    ...enderecoVazio(true),
    pais: paisPorRegiao(regiao),
  };
}

function txtOuNulo(s: string): string | null {
  return s.trim() === "" ? null : s.trim();
}

export function ClienteRapidoModal({
  open,
  onClose,
  regiao,
  onCriado,
}: ClienteRapidoModalProps) {
  const [cliente, setCliente] = useState<ClienteNovoForm>(() => clienteVazio(regiao));
  const [endereco, setEndereco] = useState<EnderecoClienteForm>(() => enderecoInicial(regiao));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCliente(clienteVazio(regiao));
    setEndereco(enderecoInicial(regiao));
    setErro(null);
    setSalvando(false);
  }, [open, regiao]);

  const fechar = () => {
    if (salvando) return;
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nome = cliente.nome.trim();
    if (!nome) {
      setErro("Informe o nome do cliente.");
      return;
    }

    const enderecoPreenchido = enderecoTemDados(endereco);
    if (enderecoPreenchido && !endereco.cidade.trim()) {
      setErro("Informe a cidade do endereço, ou deixe o endereço em branco.");
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const criado = await clientesService.criar({
        nome,
        email: txtOuNulo(cliente.email),
        telefone: txtOuNulo(cliente.telefone),
        pais: txtOuNulo(cliente.pais) ?? paisPorRegiao(regiao),
      });

      let idEndereco: string | null = null;
      if (enderecoPreenchido) {
        const enderecoCriado = await enderecosClienteService.criar(criado.id, {
          ...endereco,
          principal: true,
          rotulo: endereco.rotulo.trim() || "Principal",
          pais: endereco.pais.trim() || criado.pais || paisPorRegiao(regiao),
        });
        idEndereco = enderecoCriado.id;
      }

      onCriado({ id: criado.id, nome: criado.nome, idEndereco });
      onClose();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={fechar}
      title="Novo cliente"
      description="O cliente entra neste pedido. O endereço de entrega é opcional."
      size="lg"
      closeOnBackdropClick={!salvando}
      footer={
        <>
          <SecondaryButton type="button" onClick={fechar} disabled={salvando}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton type="submit" form="cliente-rapido-form" loading={salvando}>
            Criar e selecionar
          </PrimaryButton>
        </>
      }
    >
      <form id="cliente-rapido-form" onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormInput
            label="Nome"
            value={cliente.nome}
            onChange={(e) => setCliente((s) => ({ ...s, nome: e.target.value }))}
            required
            autoFocus
            placeholder="Nome completo"
            wrapperClassName="sm:col-span-2"
          />
          <FormInput
            label="E-mail"
            type="email"
            value={cliente.email}
            onChange={(e) => setCliente((s) => ({ ...s, email: e.target.value }))}
            placeholder="email@exemplo.com"
          />
          <FormInput
            label="Telefone"
            value={cliente.telefone}
            onChange={(e) => setCliente((s) => ({ ...s, telefone: e.target.value }))}
            placeholder="+351 ou (11) …"
          />
          <FormInput
            label="País"
            value={cliente.pais}
            onChange={(e) => setCliente((s) => ({ ...s, pais: e.target.value }))}
            wrapperClassName="sm:col-span-2"
          />
        </div>

        <div className="border-t border-line/80 pt-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Endereço de entrega
          </p>
          <p className="mb-4 text-xs text-ink-soft">Opcional. Se preencher, informe a cidade.</p>
          <EnderecoClienteCampos
            value={endereco}
            onChange={(patch) => setEndereco((s) => ({ ...s, ...patch }))}
            idPrefix="endereco-novo-modal"
          />
        </div>

        {erro ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
