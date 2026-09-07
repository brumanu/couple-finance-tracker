/**
 * Fila de mudanças não-enviadas da lista de mercado.
 *
 * A tela do corredor não pode esperar o servidor a cada toque — dentro do
 * mercado o sinal é ruim e marcar 30 itens viraria 30 esperas. Então cada
 * toque altera o estado local na hora e cai aqui; um flush com debounce leva
 * a fila inteira de uma vez.
 *
 * O `localStorage` é o que faz a fila sobreviver a fechar a aba, travar o
 * navegador ou ficar 20 minutos sem rede. Todo acesso é protegido: em aba
 * anônima ou com a cota estourada o próprio getter pode lançar, e nesse caso
 * a fila degrada pra memória em vez de derrubar a tela.
 */

import type { FilaMercado, MudancaItem } from "@/lib/mercado";

const PREFIXO = "mercado:fila:";

function chave(listaId: string): string {
  return `${PREFIXO}${listaId}`;
}

/**
 * `localStorage` pode lançar só de ser acessado (Safari em navegação
 * privada, políticas de site bloqueando armazenamento). Uma função em vez de
 * uma constante porque a disponibilidade pode mudar durante a sessão.
 */
function armazenamento(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const s = window.localStorage;
    // Toque de leitura: em alguns navegadores o objeto existe e só o acesso
    // real é que estoura.
    s.getItem(PREFIXO);
    return s;
  } catch {
    return null;
  }
}

/**
 * Referência estável pra "não há nada guardado".
 *
 * `useSyncExternalStore` compara snapshots por identidade e lança se o
 * getter devolver objeto novo a cada chamada — por isso o vazio precisa ser
 * sempre o mesmo objeto.
 */
export const FILA_VAZIA: FilaMercado = {};

const cacheDeLeitura = new Map<string, FilaMercado>();

/**
 * Lê a fila guardada devolvendo sempre a mesma referência pra mesma lista.
 *
 * Existe pra alimentar `useSyncExternalStore`: o `localStorage` é um sistema
 * externo, e essa é a API que o React oferece pra ler um sem quebrar a
 * hidratação — no servidor o snapshot é vazio, e depois de hidratar a tela
 * recebe o que estava guardado no aparelho.
 */
export function lerFilaCacheada(listaId: string): FilaMercado {
  const emCache = cacheDeLeitura.get(listaId);
  if (emCache) return emCache;

  const lida = lerFila(listaId);
  const valor = Object.keys(lida).length === 0 ? FILA_VAZIA : lida;
  cacheDeLeitura.set(listaId, valor);
  return valor;
}

/**
 * `subscribe` exigido por `useSyncExternalStore`. Não há nada pra assinar: o
 * que interessa é a leitura única depois da hidratação, e daí em diante a
 * dona da fila é a própria tela.
 */
export function assinarFilaGuardada(): () => void {
  return () => {};
}

export function lerFila(listaId: string): FilaMercado {
  const s = armazenamento();
  if (!s) return {};
  try {
    const bruto = s.getItem(chave(listaId));
    if (!bruto) return {};
    const parsed: unknown = JSON.parse(bruto);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as FilaMercado;
  } catch {
    // JSON corrompido não pode travar a tela: a lista do servidor ainda
    // serve, o que se perde é o que não tinha subido.
    return {};
  }
}

/** Devolve `false` quando não deu pra persistir — a tela avisa o usuário. */
export function salvarFila(listaId: string, fila: FilaMercado): boolean {
  // O cache de leitura precisa acompanhar, senão uma remontagem da tela
  // restauraria uma fila mais velha do que a que está no aparelho.
  cacheDeLeitura.set(listaId, fila);

  const s = armazenamento();
  if (!s) return false;
  try {
    if (Object.keys(fila).length === 0) {
      s.removeItem(chave(listaId));
    } else {
      s.setItem(chave(listaId), JSON.stringify(fila));
    }
    return true;
  } catch {
    return false;
  }
}

export function descartarFila(listaId: string): void {
  cacheDeLeitura.set(listaId, FILA_VAZIA);

  const s = armazenamento();
  if (!s) return;
  try {
    s.removeItem(chave(listaId));
  } catch {
    // Nada a fazer: a fila em memória já foi zerada por quem chamou.
  }
}

/**
 * Acumula uma mudança na fila.
 *
 * Mudanças do mesmo item se fundem: marcar no carrinho e depois anotar o
 * preço vira uma entrada só, e o servidor recebe um upsert em vez de dois.
 *
 * Duas regras que não são óbvias:
 *
 * - `novo` é grudento. Um item criado offline e editado três vezes continua
 *   sendo um insert, nunca vira update de linha que o servidor não tem.
 * - Remover um item que ainda não subiu apaga a entrada inteira em vez de
 *   marcar `removido`: não existe nada no servidor pra apagar, e mandar o
 *   delete de um id inexistente só gasta viagem.
 */
export function mesclarMudanca(
  fila: FilaMercado,
  id: string,
  mudanca: MudancaItem,
): FilaMercado {
  const anterior = fila[id];

  if (mudanca.removido && anterior?.novo) {
    const copia = { ...fila };
    delete copia[id];
    return copia;
  }

  return {
    ...fila,
    [id]: {
      ...anterior,
      ...mudanca,
      ...(anterior?.novo ? { novo: true } : {}),
    },
  };
}

/**
 * Remove da fila o que acabou de subir com sucesso.
 *
 * Compara com o que foi efetivamente enviado em vez de limpar tudo: entre o
 * disparo da requisição e a resposta o usuário continuou tocando na tela, e
 * limpar às cegas jogaria fora as mudanças feitas nesse intervalo. Entrada
 * que mudou no meio do voo fica pra próxima rodada.
 */
export function removerEnviados(
  atual: FilaMercado,
  enviado: FilaMercado,
): FilaMercado {
  const restante: FilaMercado = {};
  for (const [id, mudanca] of Object.entries(atual)) {
    const subiu = enviado[id];
    if (subiu && JSON.stringify(subiu) === JSON.stringify(mudanca)) continue;
    restante[id] = mudanca;
  }
  return restante;
}

/**
 * Separa a fila nos dois grupos que o servidor trata de forma diferente.
 *
 * O que sobe não é o delta por campo, e sim o item inteiro: assim inserção e
 * atualização viram um `upsert` só, e um flush de 30 itens é uma requisição
 * em vez de trinta. O preço é que "a última escrita vence" passa a valer por
 * linha, não por campo — que é a mesma limitação que já existe quando os dois
 * celulares mexem na mesma lista.
 */
export function separarFila(fila: FilaMercado): {
  paraSalvar: string[];
  paraRemover: string[];
} {
  const paraSalvar: string[] = [];
  const paraRemover: string[] = [];

  for (const [id, mudanca] of Object.entries(fila)) {
    if (mudanca.removido) paraRemover.push(id);
    else paraSalvar.push(id);
  }

  return { paraSalvar, paraRemover };
}
