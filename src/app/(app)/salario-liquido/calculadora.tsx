"use client";

import { useMemo, useState } from "react";
import { InfoIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatBRL, parseBRLInput } from "@/lib/format";
import {
  ANO_TABELA,
  DEDUCAO_POR_DEPENDENTE,
  DESCONTO_SIMPLIFICADO,
  ISENCAO_PARCIAL_ATE,
  ISENCAO_TOTAL_ATE,
  TETO_INSS,
  calcularSalarioLiquido,
} from "@/lib/salario";

function pct(v: number): string {
  return `${(v * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

/** Lê o campo aceitando vazio (= 0) sem transformar em NaN. */
function lerValor(raw: string): number {
  if (!raw.trim()) return 0;
  return parseBRLInput(raw) ?? 0;
}

export function CalculadoraSalario() {
  const [brutoRaw, setBrutoRaw] = useState("");
  const [dependentesRaw, setDependentesRaw] = useState("0");
  const [pensaoRaw, setPensaoRaw] = useState("");
  const [outrosRaw, setOutrosRaw] = useState("");

  const bruto = lerValor(brutoRaw);

  const resultado = useMemo(
    () =>
      calcularSalarioLiquido({
        bruto,
        dependentes: Number(dependentesRaw) || 0,
        pensao: lerValor(pensaoRaw),
        outrosDescontos: lerValor(outrosRaw),
      }),
    [bruto, dependentesRaw, pensaoRaw, outrosRaw],
  );

  const preenchido = bruto > 0;

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,340px)_1fr] md:items-start">
      <Card>
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="bruto" className="text-xs text-muted-foreground">
              Salário bruto (R$)
            </Label>
            <Input
              id="bruto"
              inputMode="decimal"
              value={brutoRaw}
              onChange={(e) => setBrutoRaw(e.target.value)}
              placeholder="Ex: 6500,00"
              autoFocus
              className="text-lg"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="dependentes"
              className="text-xs text-muted-foreground"
            >
              Dependentes
            </Label>
            <Input
              id="dependentes"
              type="number"
              min={0}
              max={20}
              value={dependentesRaw}
              onChange={(e) => setDependentesRaw(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Abate {formatBRL(DEDUCAO_POR_DEPENDENTE)} da base do IR por
              dependente.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="pensao" className="text-xs text-muted-foreground">
              Pensão alimentícia (R$)
            </Label>
            <Input
              id="pensao"
              inputMode="decimal"
              value={pensaoRaw}
              onChange={(e) => setPensaoRaw(e.target.value)}
              placeholder="0,00"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="outros" className="text-xs text-muted-foreground">
              Outros descontos (R$)
            </Label>
            <Input
              id="outros"
              inputMode="decimal"
              value={outrosRaw}
              onChange={(e) => setOutrosRaw(e.target.value)}
              placeholder="0,00"
            />
            <p className="text-xs text-muted-foreground">
              Vale-transporte, plano de saúde, adiantamentos — saem do
              líquido, mas não mudam INSS nem IR.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <div className="flex flex-col gap-2 p-6">
            <p className="text-[11px] uppercase tracking-widest text-primary">
              Salário líquido
            </p>
            <p
              className="font-heading tabular-nums text-primary"
              style={{ fontSize: "clamp(2rem, 6vw, 3rem)", lineHeight: 1 }}
            >
              {preenchido ? formatBRL(resultado.liquido) : "—"}
            </p>
            {preenchido && (
              <p className="text-[13px] text-neutral-700">
                De {formatBRL(resultado.bruto)} brutos ·{" "}
                {pct(resultado.aliquotaEfetiva)} vai em descontos
              </p>
            )}
          </div>
        </Card>

        {preenchido && (
          <>
            <Card>
              <div className="flex flex-col divide-y divide-border/60">
                <LinhaResumo
                  label="Salário bruto"
                  valor={formatBRL(resultado.bruto)}
                />

                <div className="flex flex-col gap-2 px-5 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[15px] font-semibold">
                      INSS
                      {resultado.inssNoTeto && (
                        <Badge variant="neutral" className="ml-2 text-[10px]">
                          no teto
                        </Badge>
                      )}
                    </span>
                    <span className="tabular-nums text-[15px] font-medium text-primary">
                      − {formatBRL(resultado.inss)}
                    </span>
                  </div>
                  {/* O desconto por faixa é o que mais confunde: quase todo
                      mundo acha que a alíquota do topo vale pro salário
                      inteiro. Mostrar fatia a fatia mata a dúvida. */}
                  <ul className="flex flex-col gap-1">
                    {resultado.faixasInss.map((f) => (
                      <li
                        key={f.ate}
                        className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground"
                      >
                        <span className="tabular-nums">
                          {formatBRL(f.baseNaFaixa)} × {pct(f.aliquota)}
                        </span>
                        <span className="tabular-nums">
                          {formatBRL(f.valor)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {resultado.inssNoTeto && (
                    <p className="text-xs text-muted-foreground">
                      Acima de {formatBRL(TETO_INSS)} não há contribuição.
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2 px-5 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[15px] font-semibold">IRRF</span>
                    <span className="tabular-nums text-[15px] font-medium text-primary">
                      {resultado.irrf > 0
                        ? `− ${formatBRL(resultado.irrf)}`
                        : "isento"}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <li className="flex items-baseline justify-between gap-3">
                      <span>
                        Base de cálculo
                        {resultado.usouSimplificado
                          ? ` (desconto simplificado de ${formatBRL(DESCONTO_SIMPLIFICADO)})`
                          : " (deduções legais)"}
                      </span>
                      <span className="tabular-nums">
                        {formatBRL(resultado.baseIrrf)}
                      </span>
                    </li>
                    <li className="flex items-baseline justify-between gap-3">
                      <span>Alíquota da faixa</span>
                      <span className="tabular-nums">
                        {pct(resultado.aliquotaIrrf)}
                      </span>
                    </li>
                    {resultado.redutorIsencao > 0 && (
                      <li className="flex items-baseline justify-between gap-3">
                        <span>
                          Redutor da isenção (até{" "}
                          {formatBRL(ISENCAO_PARCIAL_ATE)})
                        </span>
                        <span className="tabular-nums">
                          − {formatBRL(resultado.redutorIsencao)}
                        </span>
                      </li>
                    )}
                  </ul>
                  {resultado.bruto <= ISENCAO_TOTAL_ATE && (
                    <p className="text-xs text-muted-foreground">
                      Salários até {formatBRL(ISENCAO_TOTAL_ATE)} estão
                      isentos de imposto de renda.
                    </p>
                  )}
                </div>

                {resultado.pensao > 0 && (
                  <LinhaResumo
                    label="Pensão alimentícia"
                    valor={`− ${formatBRL(resultado.pensao)}`}
                    negativo
                  />
                )}
                {resultado.outrosDescontos > 0 && (
                  <LinhaResumo
                    label="Outros descontos"
                    valor={`− ${formatBRL(resultado.outrosDescontos)}`}
                    negativo
                  />
                )}

                <LinhaResumo
                  label="Total de descontos"
                  valor={`− ${formatBRL(resultado.totalDescontos)}`}
                  negativo
                />
                <LinhaResumo
                  label="Líquido a receber"
                  valor={formatBRL(resultado.liquido)}
                  destaque
                />
              </div>
            </Card>

            <Card>
              <div className="flex items-start gap-3 p-5">
                <InfoIcon
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  strokeWidth={2.75}
                />
                <div className="flex flex-col gap-1 text-[13px] text-neutral-700">
                  <p>
                    <strong className="tabular-nums text-foreground">
                      {formatBRL(resultado.fgts)}
                    </strong>{" "}
                    de FGTS são depositados pelo empregador — não saem do seu
                    salário e não entram no líquido acima.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cálculo com as tabelas de INSS e IRRF de {ANO_TABELA}.
                    Não considera 13º, férias, adicionais (insalubridade,
                    periculosidade, horas extras) nem descontos de acordo
                    coletivo.
                  </p>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function LinhaResumo({
  label,
  valor,
  negativo,
  destaque,
}: {
  label: string;
  valor: string;
  negativo?: boolean;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-5 py-4">
      <span
        className={`text-[15px] ${destaque ? "font-heading text-[17px]" : "font-semibold"}`}
      >
        {label}
      </span>
      <span
        className={`tabular-nums font-medium ${
          destaque
            ? "font-heading text-[19px] text-primary"
            : negativo
              ? "text-[15px] text-primary"
              : "text-[15px]"
        }`}
      >
        {valor}
      </span>
    </div>
  );
}
