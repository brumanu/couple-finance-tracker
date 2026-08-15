"use client";

import { useState } from "react";

/**
 * Reseta estado controlado toda vez que o dialog abre.
 *
 * É a mesma regra que o `key={open ? "open" : "closed"}` dos forms já
 * aplica nos inputs não-controlados — só que os Selects controlados
 * (categoria, quem gastou, prioridade…) não são zerados por `key`, então
 * precisavam de um `useEffect` por campo pra acompanhar as props.
 *
 * Aqui o ajuste acontece durante o render, que é o padrão oficial do React
 * pra estado derivado de prop ("Adjusting state when a prop changes"): o
 * React descarta o render em andamento e refaz com o valor novo, sem o
 * render em cascata que o `useEffect` causava.
 */
export function useResetAoAbrir(open: boolean, reset: () => void): void {
  const [abertoAntes, setAbertoAntes] = useState(open);
  if (open !== abertoAntes) {
    setAbertoAntes(open);
    if (open) reset();
  }
}
