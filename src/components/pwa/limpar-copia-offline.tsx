"use client";

import { useEffect } from "react";
import { limparCopiaDoMercado } from "@/lib/mercado-offline";

/**
 * Na tela de login ninguém está logado — se sobrou cópia do Mercado de uma
 * sessão que expirou, ela sai daqui. O logout pelo menu já limpa; isto cobre
 * o caso em que a sessão acabou sozinha.
 */
export function LimparCopiaOffline() {
  useEffect(() => {
    limparCopiaDoMercado();
  }, []);

  return null;
}
