import { requireSession } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await requireSession();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Olá, {session.nome}. Em breve, o resumo por quinzena aparece aqui.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quinzena do dia 15</CardTitle>
            <CardDescription>
              Adiantamento e contas com quinzena 15
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Cadastre suas rendas e contas recorrentes para ver o saldo aqui.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quinzena do dia 30</CardTitle>
            <CardDescription>
              Salário final e contas com quinzena 30
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Cadastre suas rendas e contas recorrentes para ver o saldo aqui.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
