import { BookOpen, CircleHelp, ListChecks } from "lucide-react";
import { ModuleBackButton } from "@/components/home/module-back-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface WikiPlaceholderPageProps {
  onBackHome: () => void;
}

export function WikiPlaceholderPage({ onBackHome }: WikiPlaceholderPageProps) {
  return (
    <main className="min-h-[100dvh] bg-[#F5F7FA] px-5 py-6 text-[#0B1F3A] sm:px-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-6">
        <ModuleBackButton onBackHome={onBackHome} />

        <section className="rounded-lg bg-[#0B1F3A] px-7 py-7 text-white shadow-[0_14px_36px_rgba(11,31,58,0.18)] sm:px-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4CC9F0]">Base de conhecimento</p>
              <h1 className="mt-2 text-3xl font-bold">Wiki</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-white/86">
                Espaço reservado para documentação, tutoriais e regras do sistema.
              </p>
            </div>
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-white/10">
              <BookOpen className="h-10 w-10 text-[#4CC9F0]" />
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {[
            { title: "Como usar", description: "Guias rápidos para operação diária.", icon: BookOpen },
            { title: "Perguntas frequentes", description: "Respostas para dúvidas recorrentes.", icon: CircleHelp },
            { title: "Regras", description: "Critérios e premissas da geração.", icon: ListChecks },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="rounded-lg border-slate-200 bg-white shadow-[0_10px_28px_rgba(11,31,58,0.08)]">
                <CardHeader>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-[#4CC9F0]/15 text-[#009BDF]">
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-[#0B1F3A]">{item.title}</CardTitle>
                  <CardDescription className="text-[#0B1F3A]/70">{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge className="border-0 bg-[#4CC9F0]/15 text-[#006FA8]">Em preparação</Badge>
                </CardContent>
              </Card>
            );
          })}
        </section>
      </div>
    </main>
  );
}
