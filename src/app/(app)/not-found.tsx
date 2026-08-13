import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-4 text-center">
      <h2 className="text-xl font-semibold">Pagina nao encontrada</h2>
      <p className="text-muted-foreground text-sm">
        O recurso que voce procura nao existe ou foi removido.
      </p>
      <Link
        href="/"
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm"
      >
        Voltar ao inicio
      </Link>
    </div>
  );
}
