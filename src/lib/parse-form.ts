/**
 * Leitura declarativa de `FormData` para as Server Actions.
 *
 * Antes cada action tinha o seu `parseFormData`: 15 blocos com o mesmo
 * `String(formData.get(x) ?? "").trim()`, as mesmas checagens de faixa e as
 * mesmas mensagens escritas de novo com pontuação um pouco diferente. Aqui o
 * formato vira um objeto e o resultado sai tipado.
 *
 * A convenção de retorno é a mesma de antes — o valor pronto ou uma `string`
 * com a mensagem de erro — pra que as actions continuem fazendo
 * `if (typeof parsed === "string") return { error: parsed }`.
 *
 * Não usa zod de propósito: o projeto não tem dependência de validação e o
 * que se valida aqui são sete formatos fechados (texto, dinheiro, inteiro com
 * faixa, data, booleano, enum e id cru). Uma lib traria mais superfície do que
 * as ~60 linhas que ela economizaria.
 */

import { parseBRLInput } from "@/lib/format";

export type ResultadoCampo<T> = { valor: T } | { erro: string };

export type Campo<T> = {
  ler(formData: FormData, nome: string): ResultadoCampo<T>;
};

function texto(formData: FormData, nome: string): string {
  return String(formData.get(nome) ?? "").trim();
}

/** Faz o campo aceitar vazio, devolvendo `null` em vez de erro. */
export function opcional<T>(base: Campo<T>): Campo<T | null> {
  return {
    ler(formData, nome) {
      if (!texto(formData, nome)) return { valor: null };
      return base.ler(formData, nome);
    },
  };
}

export const campo = {
  /** Texto obrigatório, já trimado. */
  texto(rotulo: string, opcoes?: { max?: number }): Campo<string> {
    return {
      ler(formData, nome) {
        const valor = texto(formData, nome);
        // "não pode ficar em branco" em vez de "é obrigatório/a": os rótulos
        // deste campo vão de "Nome" a "Descrição", e a frase neutra evita ter
        // que declarar o gênero de cada um só pra concordar.
        if (!valor) return { erro: `${rotulo} não pode ficar em branco.` };
        if (opcoes?.max && valor.length > opcoes.max) {
          return { erro: `${rotulo} deve ter no máximo ${opcoes.max} caracteres.` };
        }
        return { valor };
      },
    };
  },

  /**
   * Id vindo de um `<Select>` que ainda vai passar por `resolverCategoria` /
   * `resolverQuemGastou`. Não valida nada aqui de propósito: quem resolve é
   * que sabe o que é sentinela ("__nenhuma__") e o que é uuid.
   */
  cru(): Campo<string> {
    return {
      ler(formData, nome) {
        return { valor: texto(formData, nome) };
      },
    };
  },

  /** Valor em reais digitado pelo usuário ("1.234,56"). */
  dinheiro(
    rotulo: string,
    opcoes?: { min?: number; permiteZero?: boolean },
  ): Campo<number> {
    const min = opcoes?.min ?? (opcoes?.permiteZero ? 0 : undefined);
    return {
      ler(formData, nome) {
        const bruto = texto(formData, nome);
        if (!bruto) return { erro: `${rotulo} é obrigatório.` };
        const valor = parseBRLInput(bruto);
        if (valor === null) {
          return { erro: `${rotulo} inválido. Use o formato 1.234,56.` };
        }
        if (min !== undefined && valor < min) {
          return {
            erro:
              min === 0
                ? `${rotulo} não pode ser negativo.`
                : `${rotulo} deve ser maior que zero.`,
          };
        }
        if (min === undefined && valor <= 0) {
          return { erro: `${rotulo} deve ser maior que zero.` };
        }
        return { valor };
      },
    };
  },

  /** Inteiro com faixa fechada — dia do mês, parcelas, dia de fechamento… */
  inteiro(
    rotulo: string,
    opcoes: { min: number; max: number },
  ): Campo<number> {
    return {
      ler(formData, nome) {
        const bruto = texto(formData, nome);
        if (!bruto) return { erro: `${rotulo} é obrigatório.` };
        const valor = Number(bruto);
        if (
          !Number.isInteger(valor) ||
          valor < opcoes.min ||
          valor > opcoes.max
        ) {
          return {
            erro: `${rotulo} deve ser um número entre ${opcoes.min} e ${opcoes.max}.`,
          };
        }
        return { valor };
      },
    };
  },

  /** Data no formato do `<input type="date">`. */
  data(rotulo: string): Campo<string> {
    return {
      ler(formData, nome) {
        const valor = texto(formData, nome);
        if (!valor) return { erro: `${rotulo} é obrigatória.` };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
          return { erro: `${rotulo} inválida.` };
        }
        return { valor };
      },
    };
  },

  /**
   * Checkbox. Um checkbox desmarcado não aparece no `FormData`, então a
   * ausência é `false` — nunca erro.
   */
  booleano(): Campo<boolean> {
    return {
      ler(formData, nome) {
        const bruto = formData.get(nome);
        return { valor: bruto === "on" || bruto === "true" };
      },
    };
  },

  /** Enum fechado. O tipo do retorno é a união dos valores aceitos. */
  umDe<const T extends readonly string[]>(
    rotulo: string,
    valores: T,
  ): Campo<T[number]> {
    return {
      ler(formData, nome) {
        const valor = texto(formData, nome);
        if (!(valores as readonly string[]).includes(valor)) {
          return { erro: `${rotulo} inválida.` };
        }
        return { valor: valor as T[number] };
      },
    };
  },

  /** Igual a `umDe`, mas convertendo pra número (quinzena 15/30). */
  umDeNumero<const T extends readonly number[]>(
    rotulo: string,
    valores: T,
  ): Campo<T[number]> {
    return {
      ler(formData, nome) {
        const valor = Number(texto(formData, nome));
        if (!(valores as readonly number[]).includes(valor)) {
          return { erro: `${rotulo} inválida.` };
        }
        return { valor: valor as T[number] };
      },
    };
  },

  /** URL http(s). Rejeita `javascript:` e afins. */
  url(rotulo: string): Campo<string> {
    return {
      ler(formData, nome) {
        const valor = texto(formData, nome);
        if (!valor) return { erro: `${rotulo} é obrigatório.` };
        let parsed: URL;
        try {
          parsed = new URL(valor);
        } catch {
          return { erro: `${rotulo} inválido.` };
        }
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return { erro: `${rotulo} deve começar com http:// ou https://.` };
        }
        return { valor };
      },
    };
  },

  /** Escapatória pra regra que só existe em um formulário. */
  customizado<T>(
    ler: (bruto: string) => ResultadoCampo<T>,
  ): Campo<T> {
    return {
      ler(formData, nome) {
        return ler(texto(formData, nome));
      },
    };
  },
};

type Valores<E> = {
  [K in keyof E]: E[K] extends Campo<infer T> ? T : never;
};

/**
 * Lê o formulário inteiro. Devolve o objeto tipado ou a primeira mensagem de
 * erro encontrada — na ordem em que os campos foram declarados, que é a ordem
 * em que eles aparecem na tela.
 */
export function parseForm<E extends Record<string, Campo<unknown>>>(
  formData: FormData,
  esquema: E,
): Valores<E> | string {
  const saida: Record<string, unknown> = {};
  for (const [nome, campoDoEsquema] of Object.entries(esquema)) {
    const resultado = campoDoEsquema.ler(formData, nome);
    if ("erro" in resultado) return resultado.erro;
    saida[nome] = resultado.valor;
  }
  return saida as Valores<E>;
}
