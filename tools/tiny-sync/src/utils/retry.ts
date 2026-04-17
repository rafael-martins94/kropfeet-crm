import { logger } from "./logger.js";

export function dormir(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface OpcoesRetry {
  tentativas: number;
  delayInicialMs: number;
  fatorBackoff: number;
  deveTentarNovamente?: (erro: unknown) => boolean;
  rotulo?: string;
}

export async function comRetry<T>(
  operacao: () => Promise<T>,
  opcoes: OpcoesRetry,
): Promise<T> {
  const { tentativas, delayInicialMs, fatorBackoff, deveTentarNovamente, rotulo } = opcoes;
  let ultimoErro: unknown;
  let atraso = delayInicialMs;

  for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
    try {
      return await operacao();
    } catch (erro) {
      ultimoErro = erro;
      const podeRetentar = deveTentarNovamente ? deveTentarNovamente(erro) : true;
      const ultima = tentativa === tentativas;
      logger.warn(
        `Falha na operacao${rotulo ? ` [${rotulo}]` : ""} (tentativa ${tentativa}/${tentativas})`,
        { erro: erro instanceof Error ? erro.message : String(erro) },
      );
      if (ultima || !podeRetentar) break;
      await dormir(atraso);
      atraso = Math.round(atraso * fatorBackoff);
    }
  }
  throw ultimoErro;
}
