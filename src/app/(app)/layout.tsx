import { requireSession } from "@/lib/auth";
import { getCartoesParaSelecao } from "@/lib/cartoes-selection";
import { getCategorias } from "@/lib/categorias-server";
import { Sidebar } from "@/components/nav/sidebar";
import { BottomNav } from "@/components/nav/bottom-nav";
import { MobileHeader } from "@/components/nav/mobile-header";
import { MobileFab } from "@/components/nav/mobile-fab";
import { Toaster } from "@/components/ui/sonner";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const [cartoes, categorias] = await Promise.all([
    getCartoesParaSelecao(),
    getCategorias(),
  ]);

  return (
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
      <MobileFab cartoes={cartoes} categorias={categorias} />
      <Toaster />
    </div>
  );
}
