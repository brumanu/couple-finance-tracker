"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";

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

/** Formato de retorno de toda action de formulário. */
export type EstadoForm = { error?: string; ok?: boolean };

export type ControleFormDialog<S extends EstadoForm> = {
  open: boolean;
  setOpen: (aberto: boolean) => void;
  fechar: () => void;
  state: S;
  formAction: (formData: FormData) => void;
  pending: boolean;
  /** Vai no `key` do `<form>` pra zerar os inputs não-controlados. */
  formKey: string;
};

const ESTADO_INICIAL = {} as never;

/**
 * O miolo repetido dos 15 form-dialogs: abrir/fechar, `useActionState`,
 * toast de sucesso e reset ao reabrir.
 *
 * O fecha/notifica acontece dentro da própria action, não num `useEffect` que
 * observa `state` — quando o resultado chega já estamos numa transição, então
 * dá pra agir ali e evitar o render extra que o efeito causava.
 */
export function useFormDialog<S extends EstadoForm>(opcoes: {
  /** `createX` ou `updateX.bind(null, id)`. */
  action: (anterior: S, formData: FormData) => Promise<S>;
  /** Texto do toast quando salva. */
  sucesso: string;
  /** Já nasce aberto — usado por quem monta o dialog sob demanda (o FAB). */
  defaultOpen?: boolean;
  /** Chamado ao fechar, pra o pai desmontar o que carregou sob demanda. */
  onClose?: () => void;
  /** Efeito extra no sucesso, tipo o som da moeda ao lançar despesa. */
  aoSalvar?: () => void;
  /** Zera os campos controlados quando o dialog reabre. */
  reset?: () => void;
}): ControleFormDialog<S> {
  const { action, sucesso, defaultOpen = false, onClose, aoSalvar, reset } =
    opcoes;

  const [open, setOpenBruto] = useState(defaultOpen);

  function setOpen(proximo: boolean) {
    setOpenBruto(proximo);
    if (!proximo) onClose?.();
  }

  const [state, formAction, pending] = useActionState<S, FormData>(
    async (anterior, formData) => {
      const resultado = await action(anterior, formData);
      if (resultado.ok) {
        setOpen(false);
        toast.success(sucesso);
        aoSalvar?.();
      }
      return resultado;
    },
    ESTADO_INICIAL,
  );

  useResetAoAbrir(open, () => reset?.());

  return {
    open,
    setOpen,
    fechar: () => setOpen(false),
    state,
    formAction,
    pending,
    formKey: open ? "open" : "closed",
  };
}

/**
 * Props que todo form-dialog aceita pra poder ser montado sob demanda —
 * pelo provider de uma lista ou pelo FAB do mobile.
 *
 * Quem monta assim já tem o próprio botão do lado de fora, então passa
 * `trigger={null}`, `defaultOpen` e um `onClose` que desmonta o dialog.
 */
export type PropsDialogControlado = {
  /** Trigger próprio; `null` = nenhum (o dialog nasce aberto). */
  trigger?: React.ReactElement | null;
  /** Já nasce aberto. */
  defaultOpen?: boolean;
  /** Chamado ao fechar, pra o pai desmontar o que carregou. */
  onClose?: () => void;
};
