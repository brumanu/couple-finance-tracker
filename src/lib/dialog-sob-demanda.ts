"use client";

import { useState } from "react";

/**
 * Estado de "só carrega o dialog no primeiro clique".
 *
 * Serve pros dialogs de ação que aparecem uma vez por linha e quase nunca
 * são abertos — Pagar, Pagar fatura, Comprei. Importados direto, eles
 * colocavam o formulário inteiro no bundle inicial da rota e montavam uma
 * instância por linha; aqui a linha custa só um botão até alguém clicar.
 *
 * É o mesmo padrão do FAB do mobile. Diferente do `criarDialogDeLista`, que
 * compartilha um dialog entre todas as linhas, aqui cada linha monta o seu —
 * o que basta porque essas ações levam dados diferentes por linha e são
 * abertas uma de cada vez.
 */
export function useDialogSobDemanda() {
  const [montado, setMontado] = useState(false);
  return {
    montado,
    montar: () => setMontado(true),
    desmontar: () => setMontado(false),
  };
}
