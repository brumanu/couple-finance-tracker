"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampoForm } from "@/components/form-dialog-shell";
import { parseBRLInput } from "@/lib/format";

/**
 * Valor + data + quinzena: o trio que aparece igual no lançamento de despesa
 * e no de renda extra, com a mesma regra de inferir a quinzena pela data e a
 * mesma validação de valor enquanto se digita.
 */

/** Até o dia 15 é a primeira quinzena; do 16 em diante, a segunda. */
export function inferQuinzena(dataISO: string): "15" | "30" {
  return Number(dataISO.slice(8, 10)) <= 15 ? "15" : "30";
}

export function useValorDataQuinzena(defaults: {
  valor: string;
  data: string;
  quinzena: string;
}) {
  const [valor, setValor] = useState(defaults.valor);
  const [data, setData] = useState(defaults.data);
  const [quinzena, setQuinzena] = useState(defaults.quinzena);
  // Depois que o usuário escolhe a quinzena na mão, trocar a data não mexe
  // mais nela — a escolha explícita ganha da inferência.
  const [quinzenaEscolhida, setQuinzenaEscolhida] = useState(false);

  const valorInvalido = useMemo(() => {
    if (!valor.trim()) return false;
    const n = parseBRLInput(valor);
    return n === null || n <= 0;
  }, [valor]);

  return {
    valor,
    setValor,
    data,
    quinzena,
    valorInvalido,
    mudarData(novaData: string) {
      setData(novaData);
      if (!quinzenaEscolhida && novaData) setQuinzena(inferQuinzena(novaData));
    },
    escolherQuinzena(nova: string | null) {
      if (!nova) return;
      setQuinzenaEscolhida(true);
      setQuinzena(nova);
    },
    reset() {
      setValor(defaults.valor);
      setData(defaults.data);
      setQuinzena(defaults.quinzena);
      setQuinzenaEscolhida(false);
    },
  };
}

export type CamposLancamento = ReturnType<typeof useValorDataQuinzena>;

export function CampoValor({
  campos,
  placeholder = "Ex: 250,00",
}: {
  campos: CamposLancamento;
  placeholder?: string;
}) {
  return (
    <CampoForm htmlFor="valor" rotulo="Valor (R$)">
      <Input
        id="valor"
        name="valor"
        required
        inputMode="decimal"
        aria-invalid={campos.valorInvalido}
        value={campos.valor}
        onChange={(e) => campos.setValor(e.target.value)}
        placeholder={placeholder}
      />
      {campos.valorInvalido && (
        <p className="text-xs text-destructive">
          Digite um valor válido, ex: 250,00.
        </p>
      )}
    </CampoForm>
  );
}

export function CampoData({ campos }: { campos: CamposLancamento }) {
  return (
    <CampoForm htmlFor="data" rotulo="Data">
      <Input
        id="data"
        name="data"
        type="date"
        required
        value={campos.data}
        onChange={(e) => campos.mudarData(e.target.value)}
      />
    </CampoForm>
  );
}

export function CampoQuinzena({ campos }: { campos: CamposLancamento }) {
  return (
    <CampoForm htmlFor="quinzena" rotulo="Quinzena">
      <input type="hidden" name="quinzena" value={campos.quinzena} />
      <Select value={campos.quinzena} onValueChange={campos.escolherQuinzena}>
        <SelectTrigger id="quinzena">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="15">Dia 15</SelectItem>
          <SelectItem value="30">Dia 30</SelectItem>
        </SelectContent>
      </Select>
    </CampoForm>
  );
}
