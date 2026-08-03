import { useMemo, useState } from "react";
import { ArrowRight, FileCheck2, FileClock, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ModuleBackButton } from "@/components/home/module-back-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { monthLabel } from "../lib/calendar";
import { CURRENT_USER, loadScheduleHistory } from "../lib/schedule-history";
import { downloadDocxBlob, generateVerticalPreviewDocx } from "../lib/vertical-schedule-api";

interface VerticalPlaceholderPageProps {
  onBackHome: () => void;
}

interface SessionExport {
  id: string;
  filename: string;
  month: number;
  year: number;
  generatedAt: string;
}

interface SummaryItem {
  label: string;
  value: string;
}

function formatNumber(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

function buildSummaryItems(
  items: Array<{ label: string; value: unknown; formatter?: (value: unknown) => string | null }>,
): SummaryItem[] {
  return items.flatMap((item) => {
    const value = item.formatter ? item.formatter(item.value) : item.value;
    if (value === null || value === undefined || value === "") return [];
    return [{ label: item.label, value: String(value) }];
  });
}

export function VerticalPlaceholderPage({ onBackHome }: VerticalPlaceholderPageProps) {
  const savedSchedules = useMemo(() => loadScheduleHistory(CURRENT_USER.id), []);
  const [selectedScheduleId, setSelectedScheduleId] = useState(savedSchedules[0]?.id ?? "");
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [sessionExports, setSessionExports] = useState<SessionExport[]>([]);
  const selectedSchedule = savedSchedules.find((item) => item.id === selectedScheduleId) ?? null;
  const metadataItems = selectedSchedule
    ? buildSummaryItems([
        { label: "Mês", value: monthLabel(selectedSchedule.month) },
        { label: "Ano", value: selectedSchedule.year, formatter: formatNumber },
        {
          label: "Versão",
          value: selectedSchedule.version,
          formatter: (value) => {
            const formatted = formatNumber(value);
            return formatted ? `v${formatted.padStart(3, "0")}` : null;
          },
        },
        { label: "Operadores", value: selectedSchedule.operatorCount, formatter: formatNumber },
        { label: "Avisos", value: selectedSchedule.warningCount, formatter: formatNumber },
        { label: "Violações", value: selectedSchedule.violationCount, formatter: formatNumber },
      ])
    : [];
  const previewItems = selectedSchedule
    ? buildSummaryItems([
        { label: "Mês", value: monthLabel(selectedSchedule.result.month) },
        { label: "Ano", value: selectedSchedule.result.year, formatter: formatNumber },
        { label: "Dias", value: selectedSchedule.result.perDay?.length, formatter: formatNumber },
        { label: "Operadores", value: selectedSchedule.result.rows?.length, formatter: formatNumber },
        { label: "Avisos", value: selectedSchedule.result.warnings?.length, formatter: formatNumber },
        { label: "Violações", value: selectedSchedule.result.violations?.length, formatter: formatNumber },
      ])
    : [];

  const handleGeneratePreview = async () => {
    if (!selectedSchedule) {
      toast.error("Não há escala operacional salva para gerar o DOCX. Gere e salve uma Escala Operacional primeiro.");
      return;
    }

    setIsGeneratingPreview(true);
    try {
      const filename = `escala-vertical-prevista-${selectedSchedule.year}-${String(selectedSchedule.month).padStart(2, "0")}.docx`;
      const result = await generateVerticalPreviewDocx({
        schedule: selectedSchedule.result,
        filename,
      });
      downloadDocxBlob(result.blob, result.filename);
      setSessionExports((current) =>
        [
          {
            id: `${selectedSchedule.id}-${Date.now()}`,
            filename: result.filename,
            month: selectedSchedule.month,
            year: selectedSchedule.year,
            generatedAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          },
          ...current,
        ].slice(0, 5),
      );
      toast.success("DOCX da Escala Prevista gerado com sucesso.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar DOCX da Escala Prevista.");
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#F5F7FA] px-5 py-6 text-[#0B1F3A] sm:px-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-6">
        <ModuleBackButton onBackHome={onBackHome} />

        <section className="rounded-lg bg-[#0B1F3A] px-7 py-7 text-white shadow-[0_14px_36px_rgba(11,31,58,0.18)] sm:px-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4CC9F0]">Exportação vertical</p>
              <h1 className="mt-2 text-3xl font-bold">Escala Vertical</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-white/86">
                Gere o DOCX da Escala Prevista a partir de uma escala operacional salva.
              </p>
            </div>
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-white/10">
              <FileText className="h-10 w-10 text-[#4CC9F0]" />
            </div>
          </div>
        </section>

        {savedSchedules.length === 0 ? (
          <Alert className="border-[#4CC9F0]/50 bg-white text-[#0B1F3A] shadow-[0_10px_28px_rgba(11,31,58,0.08)]">
            <FileText className="h-4 w-4 text-[#009BDF]" />
            <AlertTitle>Não há escala operacional salva</AlertTitle>
            <AlertDescription>
              Gere uma Escala Operacional, clique em Salvar e volte para este módulo para gerar o DOCX da Escala Prevista.
            </AlertDescription>
          </Alert>
        ) : (
          <Card className="rounded-lg border-slate-200 bg-white shadow-[0_10px_28px_rgba(11,31,58,0.08)]">
            <CardHeader>
              <CardTitle className="text-[#0B1F3A]">Biblioteca de Escalas</CardTitle>
              <CardDescription className="text-[#0B1F3A]/70">
                Escolha uma escala operacional já salva no histórico local para revisar os dados antes da exportação vertical.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="space-y-2">
                <Label>Escala salva</Label>
                <Select value={selectedScheduleId} onValueChange={setSelectedScheduleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma escala" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedSchedules.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {monthLabel(item.month)} / {item.year} - v{item.version.toString().padStart(3, "0")} - {item.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {metadataItems.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {metadataItems.map((item) => (
                    <div key={item.label} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-medium text-[#0B1F3A]/60">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-[#0B1F3A]">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {selectedSchedule && (
          <Card className="rounded-lg border-slate-200 bg-white shadow-[0_10px_28px_rgba(11,31,58,0.08)]">
            <CardHeader>
              <CardTitle className="text-[#0B1F3A]">Preview</CardTitle>
              <CardDescription className="text-[#0B1F3A]/70">
                Resumo da escala que será enviada ao backend para geração do DOCX.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {previewItems.map((item) => (
                <div key={item.label} className="rounded-md border border-[#4CC9F0]/30 bg-[#4CC9F0]/10 px-3 py-2">
                  <p className="text-xs font-medium text-[#006FA8]">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-[#0B1F3A]">{item.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <section className="grid gap-5 md:grid-cols-2">
          <Card className="rounded-lg border-slate-200 bg-white opacity-75 shadow-[0_10px_28px_rgba(11,31,58,0.08)]">
            <CardHeader>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-[#4CC9F0]/15 text-[#009BDF]">
                <FileCheck2 className="h-6 w-6" />
              </div>
              <CardTitle className="text-[#0B1F3A]">Gerar Escala Cumprida</CardTitle>
              <CardDescription className="text-[#0B1F3A]/70">
                Fluxo futuro para gerar a escala cumprida a partir de arquivo externo e comparação com a prevista.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-0 bg-slate-100 text-slate-600">Importar XLSX</Badge>
                <ArrowRight className="h-4 w-4 text-slate-400" />
                <Badge className="border-0 bg-slate-100 text-slate-600">Comparar com Prevista</Badge>
                <ArrowRight className="h-4 w-4 text-slate-400" />
                <Badge className="border-0 bg-slate-100 text-slate-600">Gerar DOCX</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="border-0 bg-slate-100 text-slate-600">Em preparação</Badge>
                <Button disabled variant="outline" className="ml-auto">Indisponível</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-slate-200 bg-white shadow-[0_10px_28px_rgba(11,31,58,0.08)]">
            <CardHeader>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-[#4CC9F0]/15 text-[#009BDF]">
                <FileClock className="h-6 w-6" />
              </div>
              <CardTitle className="text-[#0B1F3A]">Gerar Escala Prevista</CardTitle>
              <CardDescription className="text-[#0B1F3A]/70">
                Converte a escala operacional salva em um DOCX vertical ICA 63-33.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              <Badge className="border-0 bg-[#4CC9F0]/15 text-[#006FA8]">Escala operacional</Badge>
              <Badge className="border-0 bg-[#4CC9F0]/15 text-[#006FA8]">Exportação DOCX</Badge>
              <p className="basis-full text-xs leading-5 text-[#0B1F3A]/60">
                Média Hora Mensal calculada automaticamente pelo sistema: carga-base 2x2 do mês / média real sobre o
                efetivo total. O valor pode ser editado manualmente no DOCX gerado.
              </p>
              <Button
                type="button"
                disabled={isGeneratingPreview}
                onClick={handleGeneratePreview}
                className="ml-auto bg-[#009BDF] text-white hover:bg-[#007DB5]"
              >
                {isGeneratingPreview ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  "Gerar DOCX"
                )}
              </Button>
            </CardContent>
          </Card>
        </section>

        <Card className="rounded-lg border-slate-200 bg-white shadow-[0_10px_28px_rgba(11,31,58,0.08)]">
          <CardHeader>
            <CardTitle className="text-[#0B1F3A]">Últimas exportações</CardTitle>
            <CardDescription className="text-[#0B1F3A]/70">
              Histórico temporário desta sessão. A persistência definitiva será adicionada em uma sprint futura.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sessionExports.length === 0 ? (
              <p className="text-sm text-[#0B1F3A]/60">Nenhuma exportação DOCX foi gerada nesta sessão.</p>
            ) : (
              <div className="grid gap-2">
                {sessionExports.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
                    <FileText className="h-4 w-4 text-[#009BDF]" />
                    <span className="text-sm font-medium text-[#0B1F3A]">{item.filename}</span>
                    <Badge className="ml-auto border-0 bg-[#4CC9F0]/15 text-[#006FA8]">
                      {monthLabel(item.month)} / {item.year}
                    </Badge>
                    <span className="text-xs text-[#0B1F3A]/55">{item.generatedAt}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
