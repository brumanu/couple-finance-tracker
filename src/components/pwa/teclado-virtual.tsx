"use client";

import { useEffect } from "react";

// Tipos de <input> que não abrem teclado: ou são clique, ou abrem um seletor
// nativo do sistema (data, hora, cor, arquivo).
const SEM_TECLADO = new Set([
  "button",
  "checkbox",
  "color",
  "date",
  "datetime-local",
  "file",
  "hidden",
  "image",
  "month",
  "radio",
  "range",
  "reset",
  "submit",
  "time",
  "week",
]);

function abreTeclado(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly;
  if (el instanceof HTMLInputElement) {
    return !el.readOnly && !SEM_TECLADO.has(el.type);
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * Marca `<html data-teclado="aberto">` enquanto um campo de texto tem foco.
 *
 * Com `interactive-widget=resizes-content` (layout.tsx) o Android encolhe a
 * página quando o teclado abre, e tudo que é `fixed` no rodapé sobe junto:
 * o bottom-nav e o FAB ficariam em cima do teclado comendo quase 150px de uma
 * tela que já está pela metade. O CSS esconde os dois com essa marca (classe
 * `some-com-teclado` em globals.css) e zera `--altura-barra-inferior`.
 *
 * Foco é o sinal mais confiável que existe: não há evento de "teclado abriu"
 * que funcione igual no iOS e no Android.
 */
export function TecladoVirtual() {
  useEffect(() => {
    const html = document.documentElement;

    function atualizar() {
      if (abreTeclado(document.activeElement)) {
        html.dataset.teclado = "aberto";
      } else {
        delete html.dataset.teclado;
      }
    }

    // No focusout o activeElement ainda é o campo que está saindo; o próximo
    // só ganha foco depois, na mesma tarefa. Pular de um campo pro outro não
    // pode piscar o bottom-nav, então a checagem vai pra tarefa seguinte.
    // setTimeout e não requestAnimationFrame: rAF pausa com a página fora de
    // foco e a marca ficaria presa.
    function aoSairDoFoco() {
      setTimeout(atualizar, 0);
    }

    document.addEventListener("focusin", atualizar);
    document.addEventListener("focusout", aoSairDoFoco);
    return () => {
      document.removeEventListener("focusin", atualizar);
      document.removeEventListener("focusout", aoSairDoFoco);
      delete html.dataset.teclado;
    };
  }, []);

  return null;
}
