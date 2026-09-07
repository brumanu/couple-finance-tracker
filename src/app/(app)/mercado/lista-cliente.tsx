"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2Icon,
  CloudOffIcon,
  LoaderCircleIcon,
  ShoppingBasketIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CartaoOpcao } from "@/lib/cartoes-selection";
import type { CategoriaOpcao } from "@/lib/categorias";
import type { MembroOpcao } from "@/lib/membros";
import {
  aplicarFilaLocal,
  contarProgresso,
  normalizarNome,
  type FilaMercado,
  type ItemMercado,
  type ItemParseado,
  type MudancaItem,
} from "@/lib/mercado";
import {
  assinarFilaGuardada,
  descartarFila,
  FILA_VAZIA,
  lerFilaCacheada,
  mesclarMudanca,
  removerEnviados,
  salvarFila,
  separarFila,
} from "@/lib/mercado-fila";
import { sincronizarItens, type ItemParaSalvar } from "./actions";
import { ItemLinha } from "./item-linha";
import { ItemDetalheSheet } from "./item-detalhe-sheet";
import { CampoAdicionarItem } from "./campo-adicionar-item";
import { BlocoDeItens } from "./bloco-de-itens";
import { FinalizarDialog, type PadroesDoFechamento } from "./finalizar-dialog";

/** Espera depois do último toque antes de mandar a fila. */
const DEBOUNCE_MS = 1500;

/** Nova tentativa periódica enquanto sobrar coisa na fila. */
const RETENTATIVA_MS = 20_000;

type EstadoSync = "salvo" | "salvando" | "pendente";

type Props = {
  listaId: string;
  itensIniciais: ItemMercado[];
  historico: string[];
  cartoes: CartaoOpcao[];
  categorias: CategoriaOpcao[];
  membros: MembroOpcao[];
  padroes: PadroesDoFechamento;
};

/**
 * A tela do corredor.
 *
 * O estado dos itens vive aqui, não no servidor. Cada toque altera a tela na
 * hora e empilha a mudança numa fila espelhada no `localStorage`; um flush
 * com debounce leva tudo de uma vez. É o que torna a tela usável dentro do
 * mercado, onde o sinal é ruim e esperar o servidor a cada item marcado
 * tornaria a lista inútil.
 *
 * Os ids são gerados no cliente, então reenviar a fila depois de uma falha
 * atualiza as mesmas linhas em vez de duplicar itens — a retentativa é segura
 * por construção.
 */
export function ListaCliente({
  listaId,
  itensIniciais,
  historico,
  cartoes,
  categorias,
  membros,
  padroes,
}: Props) {
  const router = useRouter();

  const [itens, setItensState] = useState<ItemMercado[]>(itensIniciais);
  const [fila, setFilaState] = useState<FilaMercado>({});
  const [estado, setEstado] = useState<EstadoSync>("salvo");
  const [semArmazenamento, setSemArmazenamento] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [destacadoId, setDestacadoId] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [abrindoFechamento, setAbrindoFechamento] = useState(false);

  // Refs espelham o estado pros listeners e o debounce lerem o valor atual
  // sem recriar timer a cada toque. Os handlers escrevem no ref na mesma
  // linha do setState (dois toques rápidos no mesmo tick precisam enxergar o
  // primeiro); os efeitos abaixo garantem que o ref também acompanhe o que
  // vem de fora, como dados novos do servidor.
  const itensRef = useRef(itens);
  const filaRef = useRef(fila);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    itensRef.current = itens;
  }, [itens]);

  useEffect(() => {
    filaRef.current = fila;
  }, [fila]);

  const setItens = useCallback((proximos: ItemMercado[]) => {
    itensRef.current = proximos;
    setItensState(proximos);
  }, []);

  const setFila = useCallback(
    (proxima: FilaMercado) => {
      filaRef.current = proxima;
      setFilaState(proxima);
      if (!salvarFila(listaId, proxima)) setSemArmazenamento(true);
    },
    [listaId],
  );

  // ------------------------------------------------------------------
  // Sincronização
  // ------------------------------------------------------------------

  const flush = useCallback(async (): Promise<{ error?: string }> => {
    const snapshot = filaRef.current;
    const { paraSalvar, paraRemover } = separarFila(snapshot);
    if (paraSalvar.length === 0 && paraRemover.length === 0) return {};

    const porId = new Map(itensRef.current.map((i) => [i.id, i]));
    const linhas: ItemParaSalvar[] = [];
    for (const id of paraSalvar) {
      const item = porId.get(id);
      // Item que saiu da tela mas ficou na fila não tem o que salvar.
      if (item) linhas.push(item);
    }

    setEstado("salvando");
    const resultado = await sincronizarItens(listaId, linhas, paraRemover);

    if (resultado.error) {
      setEstado("pendente");
      return { error: resultado.error };
    }

    // Compara com o que foi enviado em vez de limpar tudo: entre o disparo e
    // a resposta o usuário continuou tocando, e limpar às cegas jogaria fora
    // o que mudou no meio do voo.
    const restante = removerEnviados(filaRef.current, snapshot);
    setFila(restante);
    setEstado(Object.keys(restante).length > 0 ? "pendente" : "salvo");
    return {};
  }, [listaId, setFila]);

  const agendarFlush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void flush();
    }, DEBOUNCE_MS);
  }, [flush]);

  // Fila guardada de uma sessão anterior: aba fechada sem rede, navegador
  // derrubado, celular que dormiu no meio da compra.
  //
  // `useSyncExternalStore` é a API certa aqui — o `localStorage` é um sistema
  // externo, e ela resolve a hidratação sozinha: no servidor o snapshot é
  // vazio (o mesmo HTML dos dois lados), e depois de hidratar a tela recebe o
  // que estava no aparelho.
  const filaGuardada = useSyncExternalStore(
    assinarFilaGuardada,
    () => lerFilaCacheada(listaId),
    () => FILA_VAZIA,
  );

  // Adota a fila guardada uma vez. Daqui pra frente quem manda é o estado —
  // ajuste durante o render, sem o efeito em cascata.
  const [filaAdotada, setFilaAdotada] = useState(false);
  if (!filaAdotada && filaGuardada !== FILA_VAZIA) {
    setFilaAdotada(true);
    setFilaState(filaGuardada);
    setItensState(aplicarFilaLocal(itensIniciais, filaGuardada));
    setEstado("pendente");
  }

  // E sobe o que ficou pra trás. Depende de `filaAdotada`, não da fila: preso
  // à fila, este efeito dispararia um flush a cada toque e atropelaria o
  // debounce que existe justamente pra agrupar os toques.
  useEffect(() => {
    if (filaAdotada) void flush();
  }, [filaAdotada, flush]);

  // Retentativa periódica e ao voltar pro foco. O `router.refresh()` com a
  // fila vazia é a mitigação do caso "os dois celulares na mesma lista":
  // quando a aba volta, ela busca o que o outro marcou.
  useEffect(() => {
    const intervalo = setInterval(() => {
      if (Object.keys(filaRef.current).length > 0) void flush();
    }, RETENTATIVA_MS);

    function aoVoltar() {
      if (document.visibilityState !== "visible") return;
      if (Object.keys(filaRef.current).length > 0) void flush();
      else router.refresh();
    }

    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [flush, router]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // O servidor mandou dados novos (navegação, refresh no foco, fechamento).
  // A fila local ganha nos itens que ela toca — é intenção ainda não enviada.
  //
  // Ajuste durante o render, o padrão do React pra estado derivado de prop.
  // Usa `fila` (estado) e não `filaRef`: no render é o estado que garante o
  // re-render correto; o ref é ferramenta dos handlers.
  const [ultimoDoServidor, setUltimoDoServidor] = useState(itensIniciais);
  if (itensIniciais !== ultimoDoServidor) {
    setUltimoDoServidor(itensIniciais);
    setItensState(aplicarFilaLocal(itensIniciais, fila));
  }

  // ------------------------------------------------------------------
  // Mutações
  // ------------------------------------------------------------------

  const enfileirar = useCallback(
    (id: string, mudanca: MudancaItem) => {
      setFila(mesclarMudanca(filaRef.current, id, mudanca));
      setEstado("pendente");
      agendarFlush();
    },
    [agendarFlush, setFila],
  );

  const alterarItem = useCallback(
    (id: string, patch: Partial<ItemMercado>) => {
      setItens(
        itensRef.current.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      );
      enfileirar(id, patch as MudancaItem);
    },
    [enfileirar, setItens],
  );

  const alternarCarrinho = useCallback(
    (item: ItemMercado) => {
      alterarItem(item.id, {
        status: item.status === "carrinho" ? "pendente" : "carrinho",
      });
    },
    [alterarItem],
  );

  const alternarNaoEncontrado = useCallback(
    (item: ItemMercado) => {
      const anterior = item.status;
      const proximo =
        anterior === "nao_encontrado" ? "pendente" : "nao_encontrado";
      alterarItem(item.id, { status: proximo });

      // O swipe comita sozinho pra ser um gesto só no corredor; o Desfazer é
      // o que torna isso seguro quando o dedo escorrega.
      toast(
        proximo === "nao_encontrado"
          ? `“${item.nome}” marcado como não encontrado`
          : `“${item.nome}” voltou pra lista`,
        {
          action: {
            label: "Desfazer",
            onClick: () => alterarItem(item.id, { status: anterior }),
          },
        },
      );
    },
    [alterarItem],
  );

  const proximaOrdem = useCallback(
    () =>
      itensRef.current.reduce((maior, i) => Math.max(maior, i.ordem), 0) + 1,
    [],
  );

  const adicionar = useCallback(
    (nome: string, quantidade: string | null) => {
      const chave = normalizarNome(nome);
      const existente = itensRef.current.find(
        (i) => normalizarNome(i.nome) === chave,
      );
      if (existente) {
        // Duplicata no corredor é sempre engano. Em vez de criar a segunda
        // linha, pisca a que já existe.
        setDestacadoId(existente.id);
        setTimeout(() => setDestacadoId(null), 1200);
        return;
      }

      const id = crypto.randomUUID();
      const ordem = proximaOrdem();
      const novo: ItemMercado = {
        id,
        nome,
        quantidade,
        preco: null,
        status: "pendente",
        faltou_antes: false,
        ordem,
      };
      setItens([...itensRef.current, novo]);
      enfileirar(id, { novo: true, nome, quantidade, status: "pendente", ordem });
    },
    [enfileirar, proximaOrdem, setItens],
  );

  const adicionarVarios = useCallback(
    (novos: ItemParseado[]) => {
      let ordem = proximaOrdem();
      const criados: ItemMercado[] = [];
      let fila = filaRef.current;

      for (const { nome, quantidade } of novos) {
        const id = crypto.randomUUID();
        criados.push({
          id,
          nome,
          quantidade,
          preco: null,
          status: "pendente",
          faltou_antes: false,
          ordem,
        });
        fila = mesclarMudanca(fila, id, {
          novo: true,
          nome,
          quantidade,
          status: "pendente",
          ordem,
        });
        ordem++;
      }

      setItens([...itensRef.current, ...criados]);
      setFila(fila);
      setEstado("pendente");
      agendarFlush();
      toast.success(
        criados.length === 1
          ? "1 item adicionado."
          : `${criados.length} itens adicionados.`,
      );
    },
    [agendarFlush, proximaOrdem, setFila, setItens],
  );

  const remover = useCallback(
    (id: string) => {
      setItens(itensRef.current.filter((i) => i.id !== id));
      enfileirar(id, { removido: true });
    },
    [enfileirar, setItens],
  );

  // ------------------------------------------------------------------
  // Fechamento
  // ------------------------------------------------------------------

  async function abrirFechamento() {
    setAbrindoFechamento(true);
    // Único ponto do fluxo que bloqueia o usuário, e é de propósito: lançar
    // despesa a partir de um estado que o servidor não conhece gera número
    // errado no mês.
    const { error } = await flush();
    setAbrindoFechamento(false);

    if (error) {
      const quantas = Object.keys(filaRef.current).length;
      toast.error(
        `${quantas} ${quantas === 1 ? "alteração ainda não salva" : "alterações ainda não salvas"}. Tente de novo em um instante.`,
      );
      return;
    }
    setFinalizando(true);
  }

  const progresso = contarProgresso(itens);
  const nomes = itens.map((i) => i.nome);
  const itemDetalhe = itens.find((i) => i.id === detalheId) ?? null;

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                {progresso.total === 0
                  ? "Lista vazia"
                  : `${progresso.carrinho} de ${progresso.total} no carrinho`}
                {progresso.naoEncontrados > 0 &&
                  ` · ${progresso.naoEncontrados} não ${progresso.naoEncontrados === 1 ? "encontrado" : "encontrados"}`}
              </p>
              <IndicadorSync
                estado={estado}
                semArmazenamento={semArmazenamento}
              />
            </div>

            <Button
              onClick={abrirFechamento}
              disabled={progresso.total === 0 || abrindoFechamento}
              size="sm"
            >
              {abrindoFechamento ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <ShoppingBasketIcon className="size-4" />
              )}
              Finalizar compra
            </Button>
          </div>

          {itens.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
              Comece digitando no campo abaixo — ou cole a lista inteira de uma
              vez.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60">
              {itens.map((item) => (
                <ItemLinha
                  key={item.id}
                  item={item}
                  destacado={item.id === destacadoId}
                  aoAlternarCarrinho={() => alternarCarrinho(item)}
                  aoAlternarNaoEncontrado={() => alternarNaoEncontrado(item)}
                  aoAbrirDetalhe={() => setDetalheId(item.id)}
                />
              ))}
            </ul>
          )}

          {/* No celular o bloco fica recolhido; a mesa de cadastro é o desktop. */}
          <BlocoDeItens
            naLista={nomes}
            aoAdicionar={adicionarVarios}
            className="self-start md:hidden"
          />
        </div>

        <BlocoDeItens
          naLista={nomes}
          aoAdicionar={adicionarVarios}
          abertoPorPadrao
          className="hidden w-80 shrink-0 md:flex"
        />
      </div>

      {/*
        O campo de adicionar fica colado no rodapé: no mercado a pessoa lembra
        de coisa no meio do corredor, e rolar até o fim da lista pra digitar
        seria hostil. `sticky` em vez de `fixed` pra não brigar com o
        bottom-nav nem com o teclado virtual.
      */}
      <div className="sticky bottom-0 -mx-4 mt-4 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <CampoAdicionarItem
          historico={historico}
          naLista={nomes}
          aoAdicionar={adicionar}
        />
      </div>

      <ItemDetalheSheet
        item={itemDetalhe}
        aoFechar={() => setDetalheId(null)}
        aoSalvar={(mudanca) => {
          if (itemDetalhe) alterarItem(itemDetalhe.id, mudanca);
        }}
        aoRemover={() => {
          if (itemDetalhe) remover(itemDetalhe.id);
        }}
      />

      {finalizando && (
        <FinalizarDialog
          listaId={listaId}
          itens={itens}
          cartoes={cartoes}
          categorias={categorias}
          membros={membros}
          padroes={padroes}
          aoFechar={() => setFinalizando(false)}
          aoFinalizar={() => {
            // A lista virou histórico e o servidor já abriu a próxima. A fila
            // desta aqui não tem mais destino.
            descartarFila(listaId);
            filaRef.current = {};
            setFilaState({});
            setEstado("salvo");
          }}
        />
      )}
    </>
  );
}

function IndicadorSync({
  estado,
  semArmazenamento,
}: {
  estado: EstadoSync;
  semArmazenamento: boolean;
}) {
  if (estado === "salvando") {
    return (
      <Legenda icone={<LoaderCircleIcon className="size-3.5 animate-spin" />}>
        salvando…
      </Legenda>
    );
  }

  if (estado === "pendente") {
    return (
      <Legenda
        className="text-amber-800"
        icone={<CloudOffIcon className="size-3.5" />}
      >
        {semArmazenamento
          ? "sem conexão — não guardado no aparelho"
          : "sem conexão — guardado no aparelho"}
      </Legenda>
    );
  }

  return (
    <Legenda icone={<CheckCircle2Icon className="size-3.5" />}>salvo</Legenda>
  );
}

function Legenda({
  icone,
  children,
  className,
}: {
  icone: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
        className,
      )}
      role="status"
    >
      {icone}
      {children}
    </span>
  );
}
