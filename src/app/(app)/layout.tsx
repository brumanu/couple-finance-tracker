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
import { GlobalSearchDialog } from "@/components/search/global-search-dialog";
import { SwRegister } from "@/components/push/sw-register";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // As três não dependem uma da outra (RLS escopa por cookie de sessão),
  // então rodam em paralelo em vez de esperar a sessão resolver primeiro.
  const [session, cartoes, categorias, membros] = await Promise.all([
    requireSession(),
    getCartoesParaSelecao(),
    getCategorias(),
    getMembrosCasal(),
  ]);

  return (
    <SearchProvider>
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
        <MobileFab cartoes={cartoes} categorias={categorias} membros={membros} />
        <Toaster />
        <GlobalSearchDialog />
        <SwRegister />
      </div>
    </SearchProvider>
  );
}
