import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest cobre só a lógica pura da lista de mercado (`src/lib/mercado*.ts`).
 *
 * Não há teste de componente nem mock de Supabase de propósito: mock de
 * cliente de banco envelhece mal e a manutenção não se paga num app de duas
 * pessoas. O que está aqui são as funções que erram calado — parser, merge da
 * fila e soma do total — onde o bug não aparece na tela, aparece no número.
 */
export default defineConfig({
  test: {
    // `node` basta: nada aqui toca em DOM. As funções que dependem de
    // `localStorage` são testadas pelo lado puro (mesclar/remover), não pelo
    // acesso ao armazenamento.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
