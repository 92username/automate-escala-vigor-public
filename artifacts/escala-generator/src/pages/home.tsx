import { BookOpen, CalendarDays, FileText, Rocket } from "lucide-react";
import { FeatureCard } from "@/components/home/feature-card";

interface HomePageProps {
  onOpenOperational: () => void;
  onOpenVertical: () => void;
  onOpenWiki: () => void;
}

export function HomePage({ onOpenOperational, onOpenVertical, onOpenWiki }: HomePageProps) {
  return (
    <main className="min-h-[100dvh] bg-[#F5F7FA] px-5 py-6 text-[#0B1F3A] sm:px-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
        <header className="overflow-hidden rounded-lg bg-[#0B1F3A] shadow-[0_14px_36px_rgba(11,31,58,0.18)]">
          <div className="flex min-h-[96px] flex-col justify-center gap-2 px-7 py-6 text-white sm:flex-row sm:items-center sm:justify-between sm:px-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4CC9F0]">Sistema de Escalas</p>
              <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">Painel de módulos</h1>
            </div>
            <div className="text-left text-sm font-semibold uppercase leading-6 tracking-wide text-white/90 sm:text-right">
              <div>Planejamento operacional</div>
              <div>Documentos e Automação</div>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FeatureCard
            icon={CalendarDays}
            title="Escala Operacional"
            description="Criação automática da escala operacional mensal."
            tags={["Importação XLSX", "Geração Automática", "Exportação XLSX"]}
            actionLabel="Gerar"
            onAction={onOpenOperational}
          />
          <FeatureCard
            icon={FileText}
            title="Escala Vertical"
            description="Conversão da escala operacional para o padrão ICA 63-33."
            tags={["Escala Cumprida", "Escala Prevista", "Exportação DOCX"]}
            actionLabel="Acessar"
            onAction={onOpenVertical}
          />
          <FeatureCard
            icon={BookOpen}
            title="Wiki"
            description="Documentação, tutoriais e informações do sistema."
            tags={["Como Usar", "Perguntas Frequentes", "Regras"]}
            actionLabel="Abrir"
            onAction={onOpenWiki}
          />
          <FeatureCard
            icon={Rocket}
            title="Em breve"
            description="Novas funcionalidades estão em desenvolvimento."
            tags={["Histórico", "Relatórios", "Configurações"]}
            actionLabel="Em desenvolvimento"
            accent="green"
            disabled
          />
        </section>

        <section className="rounded-lg border border-[#4CC9F0]/45 bg-white px-6 py-5 shadow-[0_10px_26px_rgba(11,31,58,0.06)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#009BDF] text-sm font-bold text-white">i</div>
            <div>
              <h2 className="text-lg font-bold text-[#009BDF]">Importante</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[#0B1F3A]/82">
                O fluxo atual da Escala Operacional permanece preservado. Nesta sprint, a Home organiza a entrada dos módulos e mantém Escala Vertical e Wiki como áreas de preparação.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
