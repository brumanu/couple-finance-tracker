import { Suspense } from "react";
import { requireSession } from "@/lib/auth";
import { getCartoesParaSelecao } from "@/lib/cartoes-selection";
import { getCategorias } from "@/lib/categorias-server";
import { getMembrosCasal } from "@/lib/membros-server";
import { Sidebar } from "@/components/nav/sidebar";
import { BottomNav } from "@/components/nav/bottom-nav";
import { MobileHeader } from "@/components/nav/mobile-header";
import { MobileFab } from "@/components/nav/mobile-fab";
import { Toaster } from "@/components/ui/sonner";
import { SearchProvider } from "@/components/search/search-provider";
import { SidebarProvider } from "@/components/nav/sidebar-provider";
import { GlobalSearchMount } from "@/components/search/global-search-mount";
import { SwRegister } from "@/components/push/sw-register";

/**
 * Cartões, categorias e membros existem só pra alimentar o dialog do FAB,
 * que no mobile nem aparece aberto. Ficando fora do await do layout, a shell
 * (sidebar, nav e o loading.tsx da rota) pinta depois de UMA query em vez de
 * quatro — o resto chega em streaming.
 */
async function MobileFabLoader() {
  const [cartoes, categorias, membros] = await Promise.all([
    getCartoesParaSelecao(),
    getCategorias(),
    getMembrosCasal(),
  ]);
  return (
    <MobileFab cartoes={cartoes} categorias={categorias} membros={membros} />
  );
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();

  return (
    <SearchProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <Sidebar
            nomeUsuario={session.nome}
            emailUsuario={session.email}
            nomeCasal={session.casalNome}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <MobileHeader
              nomeCasal={session.casalNome}
              nomeUsuario={session.nome}
            />
            <main className="min-w-0 flex-1 pb-44 md:pb-6">{children}</main>
          </div>

          <BottomNav />
          <Suspense fallback={null}>
            <MobileFabLoader />
          </Suspense>
          <Toaster />
          <GlobalSearchMount />
          <SwRegister />
        </div>
      </SidebarProvider>
    </SearchProvider>
  );
}
