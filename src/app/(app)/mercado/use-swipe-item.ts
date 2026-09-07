"use client";

import { useCallback, useRef, useState } from "react";

/** Fração da largura da linha que o dedo precisa percorrer pra comitar. */
const LIMIAR = 0.35;

/**
 * Antes de decidir se o gesto é horizontal, o dedo precisa andar isto em
 * pixels. Abaixo disso qualquer tremida vira direção aleatória.
 */
const ZONA_MORTA = 10;

/**
 * O horizontal precisa ser 1,5× maior que o vertical pra "ganhar" o gesto.
 * Rolar uma lista de 30 itens com o polegar nunca é perfeitamente vertical —
 * sem essa margem, metade das rolagens marcaria item como não encontrado.
 */
const DOMINANCIA = 1.5;

type Opcoes = {
  /** Chamado quando o arrasto passa do limiar e o dedo sai da tela. */
  aoComitar: () => void;
  /** Desliga o gesto (lista finalizada, item sendo editado). */
  ativo?: boolean;
};

/**
 * Arrastar-pra-esquerda que comita sozinho, sem botão intermediário.
 *
 * No corredor a pessoa está com uma mão só e o carrinho na outra. "Arrasta,
 * revela botão, toca no botão" são dois gestos pra uma decisão — então aqui o
 * arrasto completa a ação quando passa de {@link LIMIAR} da largura, e quem
 * salva do engano é o Desfazer no toast, não um passo a mais.
 *
 * Eventos de ponteiro puros, sem biblioteca de gestos: são ~70 linhas contra
 * um pacote inteiro no bundle de uma tela que precisa abrir rápido com sinal
 * ruim.
 */
export function useSwipeItem({ aoComitar, ativo = true }: Opcoes) {
  const [deslocamento, setDeslocamento] = useState(0);
  const [arrastando, setArrastando] = useState(false);
  // A largura vira estado, não ref: o `progresso` é calculado no render pra
  // pintar o fundo, e ler `ref.current` durante o render não garante que o
  // componente re-renderize quando o valor mudar.
  const [largura, setLargura] = useState(0);

  const inicio = useRef<{ x: number; y: number } | null>(null);
  // null = ainda decidindo; false = o gesto é do scroll, não é nosso.
  const horizontal = useRef<boolean | null>(null);

  const encerrar = useCallback(() => {
    inicio.current = null;
    horizontal.current = null;
    setArrastando(false);
    setDeslocamento(0);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!ativo || e.button !== 0) return;
      inicio.current = { x: e.clientX, y: e.clientY };
      horizontal.current = null;
    },
    [ativo],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const partida = inicio.current;
    if (!partida) return;

    const dx = e.clientX - partida.x;
    const dy = e.clientY - partida.y;

    if (horizontal.current === null) {
      if (Math.abs(dx) < ZONA_MORTA && Math.abs(dy) < ZONA_MORTA) return;

      const ganhou = Math.abs(dx) > Math.abs(dy) * DOMINANCIA;
      horizontal.current = ganhou;

      if (!ganhou) {
        // É rolagem. Solta o gesto e deixa o navegador cuidar.
        inicio.current = null;
        return;
      }

      // Só captura depois de ter certeza: capturar antes roubaria a rolagem.
      e.currentTarget.setPointerCapture(e.pointerId);
      // Mede uma vez, no momento em que o gesto começa pra valer. Medir a
      // cada movimento forçaria reflow do layout 60 vezes por segundo.
      setLargura(e.currentTarget.offsetWidth);
      setArrastando(true);
    }

    if (!horizontal.current) return;

    // Só pra esquerda. Puxar pra direita não faz nada — a volta do estado é
    // outro arrasto pra esquerda, não um gesto espelhado que ninguém adivinha.
    setDeslocamento(Math.min(0, dx));
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (horizontal.current && largura > 0) {
        if (Math.abs(deslocamento) / largura >= LIMIAR) {
          aoComitar();
        }
      }
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      encerrar();
    },
    [aoComitar, deslocamento, encerrar, largura],
  );

  const progresso =
    largura > 0 ? Math.min(1, Math.abs(deslocamento) / (largura * LIMIAR)) : 0;

  return {
    /** Espalhe na linha. */
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
    /** `transform` da linha. */
    deslocamento,
    /** `true` enquanto o dedo está arrastando — desliga a transição do CSS. */
    arrastando,
    /** 0→1 conforme se aproxima do limiar; serve pra revelar o fundo. */
    progresso,
    /** Já passou do ponto: dá pra soltar que comita. */
    vaiComitar: progresso >= 1,
  };
}
