import React, { useState, useMemo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { ModuleBackButton } from "@/components/home/module-back-button";
import { ScheduleSidebar } from "@/components/schedule-sidebar";
import { toast } from "sonner";
import { generateSchedule } from "../lib/scheduler";
import {
  exportScheduleToXlsx,
  downloadBlob,
  parseXlsx,
  cellLabel,
  parseOperationalPreviousMonth,
  previousYearMonth,
} from "../lib/excel";
import { fetchPreviousMonthFromServer } from "../lib/operational-schedule-api";
import {
  CURRENT_USER,
  createScheduleHistoryItem,
  getNextScheduleVersion,
  groupScheduleHistoryByMonth,
  loadScheduleHistory,
  saveScheduleHistoryItem,
  updateScheduleHistoryStatus,
} from "../lib/schedule-history";
import { DEFAULT_EMPLOYEES } from "../lib/employees";
import {
  fallbackVerticalCode,
  getDefaultVerticalCodeForOperator,
  normalizeVerticalCode,
} from "../lib/vertical-operator-codes";
import { daysInMonth, weekdayOf, weekdayLabel, monthLabel } from "../lib/calendar";
import type {
  Employee,
  AbsencePeriod,
  ScheduleResult,
  ScheduleInput,
  Role,
  ShiftCode,
  CellKind,
  PreviousMonthInfo,
  SavedScheduleStatus,
  ScheduleHistoryItem,
} from "../lib/types";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import {
  Upload,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  History,
  Save,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface OperationalSchedulePageProps {
  onBackHome: () => void;
}

function getInitialGenerationPeriod(): { year: number; month: number } {
  const today = new Date();
  const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return {
    year: nextMonthDate.getFullYear(),
    month: nextMonthDate.getMonth() + 1,
  };
}

export function OperationalSchedulePage({ onBackHome }: OperationalSchedulePageProps) {
  const initialGenerationPeriod = getInitialGenerationPeriod();
  const [year, setYear] = useState(initialGenerationPeriod.year);
  const [month, setMonth] = useState(initialGenerationPeriod.month);
  const [holidaysInput, setHolidaysInput] = useState("");
  const [holidays, setHolidays] = useState<number[]>([]);

  const [employees, setEmployees] = useState<Employee[]>(DEFAULT_EMPLOYEES);
  const [absences, setAbsences] = useState<AbsencePeriod[]>([]);
  const [previousMonth, setPreviousMonth] = useState<PreviousMonthInfo | undefined>(undefined);
  const [previousMonthSheet, setPreviousMonthSheet] = useState<string | null>(null);
  const [loadingPreviousMonthFromServer, setLoadingPreviousMonthFromServer] = useState(false);
  const [loadedOperationalBase, setLoadedOperationalBase] = useState<{ year: number; month: number } | null>(null);

  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string | null>(null);
  const [showDecisionLog, setShowDecisionLog] = useState(false);
  const [scheduleHistory, setScheduleHistory] = useState<ScheduleHistoryItem[]>(() =>
    loadScheduleHistory(CURRENT_USER.id),
  );
  const [openedHistoryItem, setOpenedHistoryItem] = useState<ScheduleHistoryItem | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches,
  );

  const handleAddHoliday = () => {
    const values = holidaysInput
      .split(",")
      .map((item) => parseInt(item.trim(), 10))
      .filter((value) => !Number.isNaN(value) && value >= 1 && value <= 31);
    const uniqueValues = values.filter((value) => !holidays.includes(value));
    if (uniqueValues.length > 0) {
      setHolidays([...holidays, ...uniqueValues].sort((a, b) => a - b));
      setHolidaysInput("");
    }
  };

  const handleRemoveHoliday = (h: number) => {
    setHolidays(holidays.filter(x => x !== h));
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    setEmployees(emps => emps.map(e => (e.id === id ? { ...e, ...updates } : e)));
  };

  const removeEmployee = (id: string) => {
    setEmployees(emps => emps.filter(e => e.id !== id));
  };

  const addEmployee = () => {
    const newId = `emp-${Date.now()}`;
    setEmployees([
      ...employees,
      {
        id: newId,
        name: "Novo Funcionário",
        role: "OPE",
        verticalCode: fallbackVerticalCode(employees.length),
      },
    ]);
  };

  const addAbsence = () => {
    setAbsences([
      ...absences,
      {
        id: `abs-${Date.now()}`,
        employeeId: employees[0]?.id ?? "",
        type: "ferias",
        startDay: 1,
        endDay: 15,
      },
    ]);
  };

  const updateAbsence = (id: string, updates: Partial<AbsencePeriod>) => {
    setAbsences(abs => abs.map(a => (a.id === id ? { ...a, ...updates } : a)));
  };

  const removeAbsence = (id: string) => {
    setAbsences(abs => abs.filter(a => a.id !== id));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseXlsx(buffer);
      if (parsed.employees && parsed.employees.length > 0) {
        setEmployees(parsed.employees);
      }
      if (parsed.absences) {
        setAbsences(parsed.absences);
      }
      toast.success("Arquivo XLSX importado com sucesso!");
    } catch (err) {
      toast.error("Erro ao importar arquivo XLSX.");
    } finally {
      // reset input so the same file can be picked again
      e.target.value = "";
    }
  };

  const handlePrevMonthUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const expectedBasePeriod = previousYearMonth(year, month);
      const parsed = parseOperationalPreviousMonth(buffer, expectedBasePeriod.year, expectedBasePeriod.month);

      setEmployees(parsed.employees);
      setPreviousMonth(parsed.prevMonth);
      setPreviousMonthSheet(parsed.sheetName);
      setLoadedOperationalBase({ year: parsed.detectedYear, month: parsed.detectedMonth });
      toast.success(
        `Escala base de ${monthLabel(parsed.detectedMonth)}/${parsed.detectedYear} importada (${parsed.matchedNames.length} funcionários).`,
      );
      if (parsed.unmatchedNames.length > 0) {
        console.warn("Funcionários não reconhecidos:", parsed.unmatchedNames);
      }
    } catch (err: any) {
      toast.error(`Erro ao importar escala anterior: ${err?.message ?? err}`);
    } finally {
      e.target.value = "";
    }
  };

  const handleLoadPreviousMonthFromServer = async () => {
    setLoadingPreviousMonthFromServer(true);
    try {
      const expectedBasePeriod = previousYearMonth(year, month);
      const parsed = await fetchPreviousMonthFromServer(expectedBasePeriod.year, expectedBasePeriod.month);
      setEmployees(parsed.employees);
      setPreviousMonth(parsed.prevMonth);
      setPreviousMonthSheet(parsed.sheetName);
      setLoadedOperationalBase({
        year: parsed.detectedYear,
        month: parsed.detectedMonth,
      });
      toast.success(
        `Escala base de ${monthLabel(parsed.detectedMonth)}/${parsed.detectedYear} carregada do servidor (${parsed.matchedNames.length} funcionários).`,
      );
      if (parsed.unmatchedNames.length > 0) {
        console.warn("Funcionários não reconhecidos:", parsed.unmatchedNames);
      }
    } catch (err: any) {
      toast.error(`Erro ao carregar escala privada do servidor: ${err?.message ?? err}`);
    } finally {
      setLoadingPreviousMonthFromServer(false);
    }
  };

  const clearPreviousMonth = () => {
    setPreviousMonth(undefined);
    setPreviousMonthSheet(null);
    setLoadedOperationalBase(null);
    toast.message("Escala anterior removida. O algoritmo usará posições padrão.");
  };

  const handleNewSchedule = () => {
    setResult(null);
    setSelectedAlternativeId(null);
    setOpenedHistoryItem(null);
    setShowDecisionLog(false);
  };

  const handleSidebarNewSchedule = () => {
    handleNewSchedule();
    window.setTimeout(() => {
      document.getElementById("schedule-settings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const handleGoToDashboard = () => {
    document.getElementById("app-dashboard")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleGoToHistory = () => {
    setSidebarCollapsed(false);
  };

  const handleGoToSettings = () => {
    document.getElementById("schedule-settings")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleGenerate = () => {
    try {
      const input: ScheduleInput = {
        year,
        month,
        scenario: "operacional",
        employees,
        absences,
        holidays,
        previousMonth,
      };
      const res = generateSchedule(input);
      setResult(res);
      setSelectedAlternativeId(res.selectedAlternativeId ?? res.alternatives?.[0]?.id ?? null);
      setOpenedHistoryItem(null);
      setShowDecisionLog(true);
      toast.success("Escala gerada com sucesso!");
    } catch (err: any) {
      toast.error(`Erro ao gerar escala: ${err.message}`);
    }
  };

  const handleExport = () => {
    if (!activeResult) return;
    try {
      const blob = exportScheduleToXlsx(activeResult);
      const filename =
        openedHistoryItem?.filename ??
        `escala-${activeScheduleResult.year}-${activeScheduleResult.month.toString().padStart(2, "0")}.xlsx`;
      downloadBlob(blob, filename);
      toast.success("Arquivo exportado com sucesso!");
    } catch (err) {
      toast.error("Erro ao exportar arquivo.");
    }
  };

  const handleDownloadGenerationLog = () => {
    if (!activeScheduleResult) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `log_escala_${activeScheduleResult.year}_${activeScheduleResult.month
      .toString()
      .padStart(2, "0")}_${timestamp}.txt`;
    const content =
      activeScheduleResult.reinforcementLogText ??
      [
        "LOG DA GERAÇÃO",
        "==============",
        "",
        "Nenhum log estruturado de reforço foi registrado para esta escala.",
        "",
        "Log de decisões:",
        ...activeScheduleResult.decisionLog,
      ].join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, filename);
    toast.success("Log da geração baixado.");
  };

  const handleSaveSchedule = () => {
    if (!result) return;
    try {
      const nextVersion = getNextScheduleVersion(
        scheduleHistory,
        CURRENT_USER.id,
        result.year,
        result.month,
      );
      const item = createScheduleHistoryItem({
        userId: CURRENT_USER.id,
        userName: CURRENT_USER.name,
        result,
        version: nextVersion,
        selectedAlternativeId,
      });
      setScheduleHistory(saveScheduleHistoryItem(item));
      setOpenedHistoryItem(item);
      toast.success(`Escala salva como ${item.filename}`);
    } catch (err) {
      toast.error("Erro ao salvar escala no histórico local.");
    }
  };

  const handleOpenSchedule = (item: ScheduleHistoryItem) => {
    setResult(item.result);
    setSelectedAlternativeId(
      item.selectedAlternativeId ?? item.result.selectedAlternativeId ?? item.result.alternatives?.[0]?.id ?? null,
    );
    setOpenedHistoryItem(item);
    setShowDecisionLog(false);
    setYear(item.year);
    setMonth(item.month);
    toast.message(`Escala aberta: ${item.filename}`);
  };

  const handleDownloadSavedSchedule = (item: ScheduleHistoryItem) => {
    try {
      const blob = exportScheduleToXlsx(item.result);
      downloadBlob(blob, item.filename);
      toast.success(`Download iniciado: ${item.filename}`);
    } catch (err) {
      toast.error("Erro ao baixar escala salva.");
    }
  };

  const handleUpdateSavedStatus = (item: ScheduleHistoryItem, status: SavedScheduleStatus) => {
    const updatedHistory = updateScheduleHistoryStatus(CURRENT_USER.id, item.id, status);
    setScheduleHistory(updatedHistory);
    if (openedHistoryItem?.id === item.id) {
      setOpenedHistoryItem({ ...item, status });
    }
  };

  const getCellClassName = (kind: CellKind, shift: ShiftCode | null) => {
    let base =
      "text-center font-medium border-r border-b text-xs w-[40px] h-[36px] p-0 select-none transition-colors ";
    if (kind === "WORK") {
      if (shift === "A") return base + "bg-[hsl(var(--shift-a))] text-white";
      if (shift === "B") return base + "bg-[hsl(var(--shift-b))] text-white";
      if (shift === "INT") return base + "bg-[hsl(var(--shift-int))] text-white";
    }
    if (kind === "FT") return base + "bg-[hsl(var(--shift-ft))] text-muted-foreground italic";
    if (kind === "OFF") return base + "bg-[hsl(var(--shift-off))] text-muted-foreground/30";
    if (kind === "FERIAS" || kind === "LICENCA" || kind === "CURSO")
      return base + "bg-[hsl(var(--shift-warn))] text-white";
    if (kind === "EXP") return base + "bg-stone-100 text-stone-500";
    return base;
  };

  const getSummaryCellClassName = (shift: ShiftCode, count: number) => {
    const min = shiftMinimums[shift];
    const base = "border-r border-b p-1 text-center font-mono text-xs font-semibold w-[40px] ";
    if (count < min) return base + "bg-red-100 text-red-700";
    if (count > min) return base + "bg-emerald-100 text-emerald-700";
    return base + "bg-slate-100 text-slate-700";
  };

  const activeAlternative = useMemo(
    () => result?.alternatives?.find((alternative) => alternative.id === selectedAlternativeId) ?? result?.alternatives?.[0],
    [result, selectedAlternativeId],
  );
  const activeResult = activeAlternative?.result ?? result;
  const activeScheduleResult = activeResult ?? result!;
  const displayedYear = activeResult?.year ?? year;
  const displayedMonth = activeResult?.month ?? month;
  const daysCount = useMemo(() => daysInMonth(displayedYear, displayedMonth), [displayedYear, displayedMonth]);
  const daysArr = useMemo(() => Array.from({ length: daysCount }, (_, i) => i + 1), [daysCount]);
  const shiftMinimums: Record<ShiftCode, number> = { A: 3, INT: 2, B: 2 };
  const groupedScheduleHistory = useMemo(
    () => groupScheduleHistoryByMonth(scheduleHistory),
    [scheduleHistory],
  );
  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  const formatScore = (score?: number[]) => (score?.length ? score.join(" / ") : "N/D");
  const generationSummaryText = useMemo(() => {
    const structuredLog = activeResult?.reinforcementLogText;
    if (structuredLog) {
      const firstSectionEnd = structuredLog.indexOf("\n2. Dias críticos");
      const excessStart = structuredLog.indexOf("\n3. Excedentes detectados");
      const rejectionsStart = structuredLog.indexOf("\n5. Realocações rejeitadas");
      const summarySection =
        firstSectionEnd >= 0 ? structuredLog.slice(0, firstSectionEnd).trim() : structuredLog.trim();
      const actionSections =
        excessStart >= 0
          ? structuredLog.slice(excessStart, rejectionsStart >= 0 ? rejectionsStart : undefined).trim()
          : "";
      return [summarySection, actionSections].filter(Boolean).join("\n\n");
    }
    return (activeResult?.decisionLog ?? []).slice(0, 12).join("\n");
  }, [activeResult]);
  const generationSummaryLineCount = generationSummaryText
    ? generationSummaryText.split("\n").length
    : 0;
  const getDayVisualKind = (day: number): "holiday" | "weekend" | "normal" => {
    const perDay = activeResult?.perDay?.[day - 1];
    if (perDay?.isHoliday) return "holiday";
    const weekday = weekdayOf(displayedYear, displayedMonth, day);
    if (weekday === 0 || weekday === 6) return "weekend";
    return "normal";
  };
  const getDayHeaderClassName = (day: number) => {
    const kind = getDayVisualKind(day);
    if (kind === "holiday") return "bg-amber-100 text-amber-950 border-amber-300";
    if (kind === "weekend") return "bg-cyan-50 text-cyan-950 border-cyan-200";
    return "bg-card";
  };
  const getDayCellEmphasisClassName = (day: number) => {
    const kind = getDayVisualKind(day);
    if (kind === "holiday") return "ring-2 ring-inset ring-amber-300/75";
    if (kind === "weekend") return "ring-1 ring-inset ring-cyan-200/70";
    return "";
  };
  const summaryRows = (["A", "INT", "B"] as ShiftCode[]).map((shift) => {
    const counts = (activeResult?.perDay ?? []).map((day) => day[shift].length);
    const compliantDays = counts.filter((count) => count >= shiftMinimums[shift]).length;
    return {
      shift,
      label: shift === "A" ? "Total A" : shift === "INT" ? "Total INT" : "Total B",
      counts,
      compliantDays,
    };
  });
  const formatDistribution = (alternative: NonNullable<ScheduleResult["alternatives"]>[number]) => {
    const distribution = alternative.metrics.ftReallocationDistribution;
    if (distribution.length === 0) return "Sem FT por realocacao";
    return distribution.map((entry) => `${entry.employeeName} ${entry.count}`).join(", ");
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background font-sans">
      <div className="flex min-h-[100dvh] w-full">
        <ScheduleSidebar
          collapsed={sidebarCollapsed}
          userName={CURRENT_USER.name}
          scheduleCount={scheduleHistory.length}
          activeScheduleId={openedHistoryItem?.id ?? null}
          groupedHistory={groupedScheduleHistory}
          formatDateTime={formatDateTime}
          formatScore={formatScore}
          onToggle={() => setSidebarCollapsed((value) => !value)}
          onGoToDashboard={handleGoToDashboard}
          onGoToHistory={handleGoToHistory}
          onNewSchedule={handleSidebarNewSchedule}
          onOpenSchedule={handleOpenSchedule}
          onDownloadSchedule={handleDownloadSavedSchedule}
          onGoToSettings={handleGoToSettings}
        />
        <div className="flex min-w-0 flex-1 flex-col">
      <header id="app-dashboard" className="border-b bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div>
          <ModuleBackButton onBackHome={onBackHome} label="Voltar para Home" className="mb-2" />
          <h1 className="text-2xl font-bold tracking-tight text-card-foreground">
            Gerador de Escala Mensal
          </h1>
          <p className="text-sm text-muted-foreground">Sistema oficial de planejamento de turnos 2x2</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleLoadPreviousMonthFromServer}
            disabled={loadingPreviousMonthFromServer}
            title="Carregar do servidor a escala oficial configurada para este sistema"
          >
            <History className="w-4 h-4 mr-2" />
            {loadingPreviousMonthFromServer ? "Carregando..." : "Carregar do Servidor"}
          </Button>
          <Button
            variant="outline"
            onClick={() => document.getElementById("xlsx-prev-upload")?.click()}
            title="Selecionar manualmente a escala oficial do mês anterior"
          >
            <History className="w-4 h-4 mr-2" />
            Selecionar Escala
          </Button>
          <input
            type="file"
            id="xlsx-prev-upload"
            className="hidden"
            accept=".xlsx,.xls"
            onChange={handlePrevMonthUpload}
          />
          <input
            type="file"
            id="xlsx-upload"
            className="hidden"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
          />
          <Button
            onClick={handleGenerate}
            className="px-6 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Gerar Escala
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
        {/* OPERATIONAL CONFIGURATION */}
        <div className="flex flex-col gap-6">
          <Card id="schedule-settings">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Configurações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mês</Label>
                  <Select value={month.toString()} onValueChange={v => setMonth(parseInt(v, 10))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <SelectItem key={m} value={m.toString()}>
                          {monthLabel(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Input
                    type="number"
                    value={year}
                    onChange={e => setYear(parseInt(e.target.value, 10))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Feriados (Dias do Mês)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: 8, 15, 25"
                    value={holidaysInput}
                    onChange={e => setHolidaysInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddHoliday()}
                  />
                  <Button variant="secondary" onClick={handleAddHoliday}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {holidays.map(h => (
                    <Badge key={h} variant="secondary" className="flex items-center gap-1">
                      Dia {h}
                      <button
                        onClick={() => handleRemoveHoliday(h)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {holidays.length === 0 && (
                    <span className="text-xs text-muted-foreground">Nenhum feriado</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Informe apenas o número do dia. Para múltiplos feriados, separe por vírgula.
                </p>
              </div>

              {loadedOperationalBase ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>
                    Base operacional carregada: Escala em Vigor
                  </AlertTitle>
                  <AlertDescription>
                    Essa base será usada apenas como referência para continuidade automática do ciclo dos funcionários.
                    O mês e o ano de geração continuam sendo definidos livremente por você.
                  </AlertDescription>
                </Alert>
              ) : null}

            </CardContent>
          </Card>

          {/* Previous month source card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="w-4 h-4" /> Escala do Mês Anterior
              </CardTitle>
              <CardDescription>
                Esta base define a continuidade automática do ciclo de trabalho de cada funcionário.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {previousMonth ? (
                <div className="rounded-md border bg-emerald-50 dark:bg-emerald-950/20 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        {monthLabel(previousMonth.month)} / {previousMonth.year}
                      </div>
                      <div className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                        {Object.keys(previousMonth.daysByEmployeeId).length} funcionários encontrados
                        {previousMonthSheet ? ` (aba ${previousMonthSheet})` : ""}
                      </div>
                      {loadedOperationalBase ? (
                        <div className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                          Base carregada: Escala em Vigor. Referência ativa para continuidade do ciclo.
                        </div>
                      ) : null}
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearPreviousMonth}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground text-center">
                  Nenhuma escala anterior carregada. O algoritmo usará posições padrão.
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleLoadPreviousMonthFromServer}
                disabled={loadingPreviousMonthFromServer}
              >
                <History className="w-3 h-3 mr-2" />
                {loadingPreviousMonthFromServer ? "Carregando do servidor..." : "Carregar do servidor"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => document.getElementById("xlsx-prev-upload")?.click()}
              >
                <Upload className="w-3 h-3 mr-2" />
                {previousMonth ? "Selecionar outra escala" : "Selecionar escala"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Afastamentos</CardTitle>
              <Button variant="ghost" size="sm" onClick={addAbsence}>
                <Plus className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {absences.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Nenhum afastamento registrado.
                </div>
              ) : (
                <div className="space-y-3">
                  {absences.map(abs => (
                    <div
                      key={abs.id}
                      className="grid grid-cols-[1fr_auto] gap-2 p-3 bg-muted/40 rounded-md border"
                    >
                      <div className="space-y-2">
                        <Select
                          value={abs.employeeId}
                          onValueChange={v => updateAbsence(abs.id, { employeeId: v })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.map(e => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="grid grid-cols-3 gap-2">
                          <Select
                            value={abs.type}
                            onValueChange={(v: any) => updateAbsence(abs.id, { type: v })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ferias">Férias</SelectItem>
                              <SelectItem value="licenca">Licença</SelectItem>
                              <SelectItem value="curso">Curso</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            className="h-8 text-xs"
                            value={abs.startDay}
                            onChange={e =>
                              updateAbsence(abs.id, {
                                startDay: parseInt(e.target.value, 10) || 1,
                              })
                            }
                          />
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            className="h-8 text-xs"
                            value={abs.endDay}
                            onChange={e =>
                              updateAbsence(abs.id, {
                                endDay: parseInt(e.target.value, 10) || 1,
                              })
                            }
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeAbsence(abs.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex flex-col gap-6 overflow-hidden">
          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                key="config"
              >
                <Card className="h-full border-dashed shadow-none bg-muted/20">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Equipe ({employees.length})</CardTitle>
                      <CardDescription>
                        Gerencie os funcionários, função e status de novato. A posição no ciclo é
                        inferida automaticamente da escala anterior importada.
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={addEmployee}>
                      <Plus className="w-4 h-4 mr-2" /> Adicionar
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[600px] pr-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[92px]">Código</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead className="w-[100px]">Função</TableHead>
                            <TableHead className="w-[100px]">Novato</TableHead>
                            <TableHead className="w-[140px]">Origem do ciclo</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {employees.map((emp, index) => {
                            const hasPrev = previousMonth?.daysByEmployeeId?.[emp.id]?.length;
                            const verticalCode =
                              emp.verticalCode ??
                              getDefaultVerticalCodeForOperator(emp.name) ??
                              fallbackVerticalCode(index);
                            return (
                              <TableRow key={emp.id}>
                                <TableCell>
                                  <Input
                                    value={verticalCode}
                                    onChange={e =>
                                      updateEmployee(emp.id, {
                                        verticalCode: normalizeVerticalCode(e.target.value),
                                      })
                                    }
                                    className="h-8 font-mono text-xs uppercase"
                                    aria-label={`Código vertical de ${emp.name}`}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={emp.name}
                                    onChange={e => updateEmployee(emp.id, { name: e.target.value })}
                                    className="h-8"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={emp.role}
                                    onValueChange={(v: Role) => updateEmployee(emp.id, { role: v })}
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="ENC">ENC</SelectItem>
                                      <SelectItem value="SUB">SUB</SelectItem>
                                      <SelectItem value="OPE">OPE</SelectItem>
                                      <SelectItem value="ESP">ESP</SelectItem>
                                      <SelectItem value="ADM">ADM</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  {emp.role === "OPE" ? (
                                    <div className="flex items-center space-x-2">
                                      <Switch
                                        checked={emp.novice ?? false}
                                        onCheckedChange={v =>
                                          updateEmployee(emp.id, { novice: v })
                                        }
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {emp.role === "ENC" ||
                                  emp.role === "SUB" ||
                                  emp.role === "OPE" ? (
                                    hasPrev ? (
                                      <Badge variant="outline" className="text-[10px] gap-1">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        Importado
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-[10px]">
                                        Padrão
                                      </Badge>
                                    )
                                  ) : (
                                    <span className="text-muted-foreground text-xs">N/A</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeEmployee(emp.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                key="result"
                className="flex flex-col gap-6"
              >
                {/* Result Header & Alerts */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold">
                      Escala Gerada: {monthLabel(activeScheduleResult.month)} {activeScheduleResult.year}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Funcionários são avaliados diretamente por role.
                    </p>
                    <Badge
                      className={
                        activeScheduleResult.status === "gerada_com_warning_critico"
                          ? "mt-2 bg-red-600 text-white"
                          : activeScheduleResult.status === "gerada_com_ajustes"
                            ? "mt-2 bg-amber-500 text-white"
                            : "mt-2 bg-emerald-600 text-white"
                      }
                    >
                      {activeScheduleResult.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={handleNewSchedule}
                    >
                      Voltar à Configuração
                    </Button>
                    <Button variant="outline" onClick={handleSaveSchedule}>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar
                    </Button>
                    <Button
                      variant="default"
                      onClick={handleExport}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Baixar XLSX
                    </Button>
                    <Button variant="outline" onClick={handleDownloadGenerationLog}>
                      <FileText className="w-4 h-4 mr-2" />
                      Baixar log da geração
                    </Button>
                  </div>
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Resumo da Escala Selecionada</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Mês/Ano</div>
                        <div className="font-semibold">
                          {monthLabel(activeScheduleResult.month)} / {activeScheduleResult.year}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Versão</div>
                        <div className="font-semibold">
                          {openedHistoryItem
                            ? `v${openedHistoryItem.version.toString().padStart(3, "0")}`
                            : "Não salva"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Status</div>
                        <div className="font-semibold">{openedHistoryItem?.status ?? "Rascunho"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Pendências/alertas</div>
                        <div className="font-semibold">
                          {activeScheduleResult.violations.length} violação(ões),{" "}
                          {activeScheduleResult.warnings.length} aviso(s)
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {result.alternatives && result.alternatives.length > 0 && (
                  <div className="grid gap-3 md:grid-cols-3">
                    {result.alternatives.map((alternative) => {
                      const selected = alternative.id === (activeAlternative?.id ?? selectedAlternativeId);
                      return (
                        <button
                          key={alternative.id}
                          type="button"
                          onClick={() => setSelectedAlternativeId(alternative.id)}
                          className={`rounded-lg border bg-card p-4 text-left transition-colors ${
                            selected ? "border-emerald-600 ring-2 ring-emerald-600/20" : "hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold">{alternative.label}</div>
                              <div className="mt-1 text-xs text-muted-foreground">{alternative.description}</div>
                            </div>
                            {alternative.duplicateOf && (
                              <Badge variant="secondary" className="shrink-0">
                                mesmo resultado
                              </Badge>
                            )}
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <div className="text-muted-foreground">Ajustes</div>
                              <div className="font-mono font-semibold">{alternative.metrics.totalAdjustments}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">FTs geradas</div>
                              <div className="font-mono font-semibold">{alternative.metrics.totalFtReallocations}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Maior FT/operador</div>
                              <div className="font-mono font-semibold">
                                {alternative.metrics.maxFtReallocationsForOneEmployee}
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 text-xs text-muted-foreground line-clamp-2">
                            FT distribuídas: {formatDistribution(alternative)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {activeScheduleResult.status === "gerada_com_warning_critico" && (
                  <Alert className="border-red-600 bg-red-50 text-red-950 dark:bg-red-950/30 dark:text-red-100 shadow-md">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <AlertTitle className="text-red-800 dark:text-red-200 text-base font-bold">
                      WARNING CRÍTICO: A escala foi gerada, mas existem pendências que exigem revisão manual.
                    </AlertTitle>
                    <AlertDescription className="mt-1 text-sm">
                      Consulte o log de decisões para identificar faltas, realocações, exceções e conflitos não resolvidos.
                    </AlertDescription>
                  </Alert>
                )}

                {activeScheduleResult.status === "gerada_com_ajustes" && (
                  <Alert className="border-amber-500/70 bg-amber-50/80 dark:bg-amber-950/25 text-amber-950 dark:text-amber-100">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertTitle className="text-amber-800 dark:text-amber-200">Escala gerada com ajustes</AlertTitle>
                    <AlertDescription>
                      A escala foi concluída com concessões controladas. O log mostra os ajustes aplicados.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => setShowDecisionLog((value) => !value)}>
                    {showDecisionLog ? "Ocultar sumário" : "Ver sumário"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {generationSummaryLineCount} linha(s) de resumo
                  </span>
                </div>

                {showDecisionLog && (
                  <Card className="border-border shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Sumário da Geração
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[220px] rounded-md border bg-muted/20 p-3">
                        <pre className="text-xs font-mono leading-5 whitespace-pre-wrap">
                          {generationSummaryText || "Nenhum sumário disponível para esta geração."}
                        </pre>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}

                {activeScheduleResult.violations.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Violações Encontradas ({activeScheduleResult.violations.length})</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-5 mt-2 space-y-1 text-sm max-h-40 overflow-y-auto">
                        {activeScheduleResult.violations.map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {activeScheduleResult.warnings.length > 0 && (
                  <Alert className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertTitle className="text-amber-800 dark:text-amber-300">
                      Avisos ({activeScheduleResult.warnings.length})
                    </AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-5 mt-2 space-y-1 text-sm max-h-40 overflow-y-auto">
                        {activeScheduleResult.warnings.map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {activeScheduleResult.violations.length === 0 && activeScheduleResult.warnings.length === 0 && (
                  <Alert className="border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <AlertTitle className="text-emerald-800 dark:text-emerald-300">
                      Escala Perfeita
                    </AlertTitle>
                    <AlertDescription>
                      Nenhuma violação ou aviso encontrado no algoritmo.
                    </AlertDescription>
                  </Alert>
                )}

                {/* The Big Grid */}
                <Card className="overflow-hidden border-border shadow-sm">
                  <ScrollArea className="w-full max-w-[calc(100vw-450px)] whitespace-nowrap rounded-md border-b">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-20 bg-muted/80 backdrop-blur-sm border-r border-b p-2 text-left min-w-[100px] font-semibold">
                            Funcionário
                          </th>
                          <th className="sticky left-[100px] z-20 bg-muted/80 backdrop-blur-sm border-r border-b p-2 text-center min-w-[50px] text-xs">
                            Função
                          </th>
                          {daysArr.map(d => {
                            return (
                              <th
                                key={d}
                                className={`border-r border-b p-1 text-center font-mono w-[40px] ${getDayHeaderClassName(d)}`}
                              >
                                <div className="text-[10px] text-muted-foreground">
                                  {weekdayLabel(weekdayOf(displayedYear, displayedMonth, d))}
                                </div>
                                <div className="font-bold">{d}</div>
                              </th>
                            );
                          })}
                          <th className="border-b p-2 text-center bg-muted/30 text-xs font-semibold w-[50px]">
                            Trab
                          </th>
                          <th className="border-b p-2 text-center bg-muted/30 text-xs font-semibold w-[50px]">
                            FT
                          </th>
                          <th className="border-b p-2 text-center bg-muted/30 text-xs font-semibold w-[50px]">
                            A
                          </th>
                          <th className="border-b p-2 text-center bg-muted/30 text-xs font-semibold w-[50px]">
                            INT
                          </th>
                          <th className="border-b p-2 text-center bg-muted/30 text-xs font-semibold w-[50px]">
                            B
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeScheduleResult.rows.map(row => (
                          <tr
                            key={row.employee.id}
                            className="hover:bg-muted/20 transition-colors group"
                          >
                            <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/50 border-r border-b p-2 font-medium flex items-center gap-2 min-w-[100px]">
                              <span className="truncate max-w-[70px]">{row.employee.name}</span>
                              {row.employee.novice && (
                                <span
                                  className="w-2 h-2 rounded-full bg-amber-500"
                                  title="Novato"
                                />
                              )}
                            </td>
                            <td className="sticky left-[100px] z-10 bg-card group-hover:bg-muted/50 border-r border-b p-2 text-center text-xs text-muted-foreground">
                              {row.employee.role}
                            </td>
                            {row.days.map((d, di) => (
                              <td
                                key={di}
                                className={`${getCellClassName(d.kind, d.shift)} ${getDayCellEmphasisClassName(di + 1)}`}
                              >
                                {cellLabel(d.kind, d.shift)}
                              </td>
                            ))}
                            <td className="border-l border-b p-2 text-center font-mono font-semibold bg-muted/10">
                              {row.workedDays}
                            </td>
                            <td className="border-b p-2 text-center font-mono text-muted-foreground bg-muted/10">
                              {row.ftDays}
                            </td>
                            <td className="border-b p-2 text-center font-mono text-[hsl(var(--shift-a))] bg-muted/10">
                              {row.countA}
                            </td>
                            <td className="border-b p-2 text-center font-mono text-[hsl(var(--shift-int))] bg-muted/10">
                              {row.countInt}
                            </td>
                            <td className="border-b p-2 text-center font-mono text-[hsl(var(--shift-b))] bg-muted/10">
                              {row.countB}
                            </td>
                          </tr>
                        ))}
                        {summaryRows.map((summary) => (
                          <tr key={`summary-${summary.shift}`} className="bg-muted/20">
                            <td className="sticky left-0 z-10 min-w-[100px] border-r border-b bg-muted/70 p-2 font-semibold">
                              {summary.label}
                            </td>
                            <td className="sticky left-[100px] z-10 border-r border-b bg-muted/70 p-2 text-center text-xs text-muted-foreground">
                              min {shiftMinimums[summary.shift]}
                            </td>
                            {summary.counts.map((count, index) => (
                              <td
                                key={`${summary.shift}-${index + 1}`}
                                className={`${getSummaryCellClassName(summary.shift, count)} ${getDayCellEmphasisClassName(index + 1)}`}
                              >
                                {count}
                              </td>
                            ))}
                            <td className="border-l border-b bg-muted/30 p-2 text-center font-mono text-xs text-muted-foreground">
                              -
                            </td>
                            <td className="border-b bg-muted/30 p-2 text-center font-mono text-xs text-muted-foreground">
                              -
                            </td>
                            <td className="border-b bg-muted/30 p-2 text-center font-mono font-semibold text-[hsl(var(--shift-a))]">
                              {summary.shift === "A" ? summary.compliantDays : "-"}
                            </td>
                            <td className="border-b bg-muted/30 p-2 text-center font-mono font-semibold text-[hsl(var(--shift-int))]">
                              {summary.shift === "INT" ? summary.compliantDays : "-"}
                            </td>
                            <td className="border-b bg-muted/30 p-2 text-center font-mono font-semibold text-[hsl(var(--shift-b))]">
                              {summary.shift === "B" ? summary.compliantDays : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </Card>

                {/* Per Day Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Resumo Diário (Efetivo)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[80px]">Dia</TableHead>
                            <TableHead className="w-[100px]">Turno A</TableHead>
                            <TableHead className="w-[100px]">Turno INT</TableHead>
                            <TableHead className="w-[100px]">Turno B</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeScheduleResult.perDay.map(d => (
                            <TableRow
                              key={d.date}
                              className={
                                d.isHoliday ||
                                weekdayOf(displayedYear, displayedMonth, d.date) === 0 ||
                                weekdayOf(displayedYear, displayedMonth, d.date) === 6
                                  ? "bg-muted/20"
                                  : ""
                              }
                            >
                              <TableCell className="font-medium">
                                Dia {d.date}{" "}
                                <span className="text-muted-foreground text-xs ml-1">
                                  ({weekdayLabel(d.weekday)})
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="text-xs text-muted-foreground">
                                  {d.A.join(", ") || "-"}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-xs text-muted-foreground">
                                  {d.INT.join(", ") || "-"}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-xs text-muted-foreground">
                                  {d.B.join(", ") || "-"}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
