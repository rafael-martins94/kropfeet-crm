import { formatarErroDesconhecido } from "./erro.js";
import { logger } from "./logger.js";

export function dormir(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface OpcoesRetry {
  tentativas: number;
  delayInicialMs: number;
  fatorBackoff: number;
  deveTentarNovamente?: (erro: unknown) => boolean;
  /**
   * Quando retorna um número > 0, esse valor (ms) é usado como espera antes da próxima tentativa
   * em vez do backoff exponencial padrão (útil para API bloqueada / rate limit).
   */
  esperaAposErro?: (erro: unknown, tentativa: number) => number | undefined | null;
  rotulo?: string;
}

export async function comRetry<T>(
  operacao: () => Promise<T>,
  opcoes: OpcoesRetry,
): Promise<T> {
  const {
    tentativas,
    delayInicialMs,
    fatorBackoff,
    deveTentarNovamente,
    esperaAposErro,
    rotulo,
  } = opcoes;
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
        { erro: formatarErroDesconhecido(erro) },
      );
      if (ultima || !podeRetentar) break;
      const esperaCustom = esperaAposErro?.(erro, tentativa);
      const msAguardar =
        typeof esperaCustom === "number" && esperaCustom > 0 ? esperaCustom : atraso;
      await dormir(msAguardar);
      if (typeof esperaCustom === "number" && esperaCustom > 0) {
        atraso = Math.min(300_000, Math.round(esperaCustom * 1.5));
      } else {
        atraso = Math.round(atraso * fatorBackoff);
      }
    }
  }
  throw ultimoErro;
}
