"use client";

import { useMemo, useState } from "react";
import { PackageXIcon, ShoppingBasketIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BancoIcone } from "@/lib/bancos-icones";
import { hojeISO } from "@/lib/mes";
import { formatBRL } from "@/lib/format";
import { playCoinSound } from "@/lib/sound";
import type { CartaoOpcao } from "@/lib/cartoes-selection";
import { NENHUMA_CATEGORIA, type CategoriaOpcao } from "@/lib/categorias";
import { CategoriaSelectField } from "@/components/categoria-select";
import { NENHUM_QUEM, type MembroOpcao } from "@/lib/membros";
import { QuemGastouSelectField } from "@/components/quem-gastou-select";
import { useFormDialog } from "@/lib/form-dialog";
import { CampoForm, FormDialogShell } from "@/components/form-dialog-shell";
import { inferQuinzena } from "@/components/campos-lancamento";
import { calcularTotalSugerido, type ItemMercado } from "@/lib/mercado";
import { finalizarCompra, type MercadoFormState } from "./actions";

const SEM_CARTAO = "__sem_cartao__";

export type PadroesDoFechamento = {
  cartaoId: string | null;
  categoriaId: string | null;
  quemGastou: string | null;
};

type Props = {
  listaId: string;
  itens: ItemMercado[];
  cartoes: CartaoOpcao[];
  categorias: CategoriaOpcao[];
  membros: MembroOpcao[];
  /** Categoria/cartão/quem da última compra fechada. */
  padroes: PadroesDoFechamento;
  aoFechar: () => void;
  aoFinalizar: () => void;
};

/**
 * A tela de fechamento.
 *
 * Só é montada depois que a fila de sincronização subiu — quem cuida disso é
 * a `lista-cliente`. Lançar a despesa a partir de um estado que o servidor não
 * conhece geraria um total errado, então este dialog só existe quando o
 * servidor e a tela já concordam sobre o que está no carrinho.
 */
export function FinalizarDialog({
  listaId,
  itens,
  cartoes,
  categorias,
  membros,
  padroes,
  aoFechar,
  aoFinalizar,
}: Props) {
  const sugestao = useMemo(() => calcularTotalSugerido(itens), [itens]);

  const hoje = hojeISO();
  const [total, setTotal] = useState(
    // Só preenche quando TODOS os itens do carrinho têm preço. Uma soma
    // parcial no campo seria confirmada sem ninguém reparar, e a despesa
    // entraria menor do que a compra foi.
    sugestao.tipo === "completo"
      ? sugestao.valor.toFixed(2).replace(".", ",")
      : "",
  );
  const [data, setData] = useState(hoje);
  const [quinzena, setQuinzena] = useState(inferQuinzena(hoje));
  const [quinzenaEscolhida, setQuinzenaEscolhida] = useState(false);
  const [cartaoId, setCartaoId] = useState(padroes.cartaoId ?? SEM_CARTAO);
  const [categoriaId, setCategoriaId] = useState(
    padroes.categoriaId ?? NENHUMA_CATEGORIA,
  );
  const [quemGastou, setQuemGastou] = useState(
    padroes.quemGastou ?? NENHUM_QUEM,
  );

  const ctrl = useFormDialog<MercadoFormState>({
    action: finalizarCompra.bind(null, listaId),
    sucesso: "Compra finalizada.",
    defaultOpen: true,
    onClose: aoFechar,
    aoSalvar: () => {
      playCoinSound();
      aoFinalizar();
    },
  });

  const naoEncontrados = itens.filter((i) => i.status === "nao_encontrado");
  const naoPegos = itens.filter((i) => i.status === "pendente");
  const sobrou = naoEncontrados.length + naoPegos.length;

  const usaCartao = cartaoId !== SEM_CARTAO;
  const cartaoSelecionado = cartoes.find((c) => c.id === cartaoId);

  return (
    <FormDialogShell
      ctrl={ctrl}
      trigger={null}
      rotuloSalvar="Finalizar compra"
      titulo="Finalizar compra"
      descricao={
        sobrou > 0
          ? "Informe quanto deu e escolha o que leva pra próxima ida."
          : "Informe quanto deu. Levou tudo o que estava na lista."
      }
      className="sm:max-w-lg"
    >
      <CampoForm htmlFor="total" rotulo="Quanto deu (R$)">
        <Input
          id="total"
          name="total"
          required
          autoFocus
          inputMode="decimal"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          placeholder="Ex: 412,90"
          className="h-12 text-lg"
        />
        {sugestao.tipo === "parcial" && (
          <p className="text-xs text-muted-foreground">
            {formatBRL(sugestao.valor)} anotados em {sugestao.comPreco} de{" "}
            {sugestao.total} itens — o resto você confere no cupom.
          </p>
        )}
      </CampoForm>

      <CampoForm htmlFor="descricao" rotulo="Descrição da despesa">
        <Input
          id="descricao"
          name="descricao"
          defaultValue="Mercado"
          placeholder="Mercado"
        />
      </CampoForm>

      <div className="grid grid-cols-2 gap-3">
        <CampoForm htmlFor="data" rotulo="Data">
          <Input
            id="data"
            name="data"
            type="date"
            required
            value={data}
            onChange={(e) => {
              setData(e.target.value);
              if (!quinzenaEscolhida && e.target.value) {
                setQuinzena(inferQuinzena(e.target.value));
              }
            }}
          />
        </CampoForm>

        {!usaCartao && (
          <CampoForm htmlFor="quinzena" rotulo="Quinzena">
            <input type="hidden" name="quinzena" value={quinzena} />
            <Select
              value={quinzena}
              onValueChange={(v) => {
                if (!v) return;
                setQuinzenaEscolhida(true);
                setQuinzena(v as "15" | "30");
              }}
            >
              <SelectTrigger id="quinzena">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">Dia 15</SelectItem>
                <SelectItem value="30">Dia 30</SelectItem>
              </SelectContent>
            </Select>
          </CampoForm>
        )}
      </div>

      {cartoes.length > 0 && (
        <CampoForm htmlFor="cartao_id" rotulo="Como pagou">
          <input
            type="hidden"
            name="cartao_id"
            value={usaCartao ? cartaoId : ""}
          />
          <Select value={cartaoId} onValueChange={(v) => v && setCartaoId(v)}>
            <SelectTrigger id="cartao_id">
              <SelectValue>
                {cartaoSelecionado ? (
                  <span className="inline-flex items-center gap-2">
                    <BancoIcone
                      icone={cartaoSelecionado.bancoIcone}
                      corFallback={cartaoSelecionado.bancoCor}
                      nomeFallback={cartaoSelecionado.bancoNome}
                      size={20}
                    />
                    <span>{cartaoSelecionado.label}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Débito, dinheiro ou pix
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_CARTAO}>
                <span className="text-muted-foreground">
                  Débito, dinheiro ou pix
                </span>
              </SelectItem>
              {cartoes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="inline-flex items-center gap-2">
                    <BancoIcone
                      icone={c.bancoIcone}
                      corFallback={c.bancoCor}
                      nomeFallback={c.bancoNome}
                      size={20}
                    />
                    <span>{c.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CampoForm>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <CampoForm htmlFor="categoria_id" rotulo="Categoria">
          <CategoriaSelectField
            categorias={categorias}
            value={categoriaId}
            onValueChange={setCategoriaId}
          />
        </CampoForm>
        <CampoForm htmlFor="quem_gastou" rotulo="Quem gastou">
          <QuemGastouSelectField
            membros={membros}
            value={quemGastou}
            onValueChange={setQuemGastou}
          />
        </CampoForm>
      </div>

      {sobrou > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border/60 p-4">
          <div>
            <h3 className="text-sm font-semibold">Levar pra próxima?</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Já vem tudo marcado — desmarque só o que você desistiu.
            </p>
          </div>

          {naoEncontrados.length > 0 && (
            <GrupoSobra
              titulo="Não encontrei"
              icone={<PackageXIcon className="size-3.5" />}
              itens={naoEncontrados}
            />
          )}
          {naoPegos.length > 0 && (
            <GrupoSobra
              titulo="Não peguei"
              icone={<ShoppingBasketIcon className="size-3.5" />}
              itens={naoPegos}
            />
          )}
        </div>
      )}
    </FormDialogShell>
  );
}

function GrupoSobra({
  titulo,
  icone,
  itens,
}: {
  titulo: string;
  icone: React.ReactNode;
  itens: ItemMercado[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icone}
        {titulo}
      </p>
      {itens.map((i) => (
        <label key={i.id} className="flex items-center gap-2.5 py-1 text-sm">
          <input
            type="checkbox"
            name="manter"
            value={i.id}
            defaultChecked
            className="size-4 rounded border-input"
          />
          <span>
            {i.nome}
            {i.quantidade && (
              <span className="ml-1.5 text-muted-foreground">
                {i.quantidade}
              </span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}
