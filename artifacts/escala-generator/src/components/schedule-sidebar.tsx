import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  FileClock,
  FolderOpen,
  History,
  Plus,
  Settings,
} from "lucide-react";
import { monthLabel } from "@/lib/calendar";
import type { ScheduleHistoryItem } from "@/lib/types";

type ScheduleHistoryGroup = {
  key: string;
  year: number;
  month: number;
  items: ScheduleHistoryItem[];
};

interface ScheduleSidebarProps {
  collapsed: boolean;
  userName: string;
  scheduleCount: number;
  activeScheduleId?: string | null;
  groupedHistory: ScheduleHistoryGroup[];
  formatDateTime: (iso: string) => string;
  formatScore: (score?: number[]) => string;
  onToggle: () => void;
  onGoToDashboard: () => void;
  onGoToHistory: () => void;
  onNewSchedule: () => void;
  onOpenSchedule: (item: ScheduleHistoryItem) => void;
  onDownloadSchedule: (item: ScheduleHistoryItem) => void;
  onGoToSettings: () => void;
}

const menuItems = [
  { label: "Dashboard", icon: BarChart3 },
  { label: "Nova Escala", icon: Plus },
  { label: "Histórico", icon: History },
  { label: "Configurações", icon: Settings },
];

function statusClassName(status: ScheduleHistoryItem["status"]): string {
  if (status === "Aprovada") return "bg-emerald-400";
  if (status === "Enviada") return "bg-sky-400";
  if (status === "Arquivada") return "bg-slate-500";
  return "bg-amber-400";
}

export function ScheduleSidebar({
  collapsed,
  userName,
  scheduleCount,
  activeScheduleId,
  groupedHistory,
  formatDateTime,
  formatScore,
  onToggle,
  onGoToDashboard,
  onGoToHistory,
  onNewSchedule,
  onOpenSchedule,
  onDownloadSchedule,
  onGoToSettings,
}: ScheduleSidebarProps) {
  const runMenuAction = (label: string) => {
    if (label === "Dashboard") onGoToDashboard();
    if (label === "Nova Escala") onNewSchedule();
    if (label === "Histórico") onGoToHistory();
    if (label === "Configurações") onGoToSettings();
  };

  return (
    <aside
      className={`sticky top-0 z-40 h-[100dvh] shrink-0 bg-[#00111a] p-3 text-slate-100 shadow-2xl transition-[width] duration-300 ease-out ${
        collapsed ? "w-[72px]" : "w-[268px]"
      }`}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-[22px] border border-white/8 bg-[#001925] p-3">
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-3 px-1 py-2`}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-200/20">
              <FileClock className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold tracking-wide">Escala 2x2</div>
                <div className="truncate text-[11px] text-slate-400">{userName}</div>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              type="button"
              onClick={onToggle}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/8 hover:text-white"
              title="Recolher sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="mt-3 flex h-9 w-full items-center justify-center rounded-xl bg-white/6 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            title="Expandir sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        <nav className="mt-6 rounded-2xl bg-[#152b38] p-2 shadow-inner shadow-black/20">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = item.label === "Histórico" && !!activeScheduleId;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => runMenuAction(item.label)}
                  title={collapsed ? item.label : undefined}
                  className={`flex h-11 w-full items-center rounded-xl text-sm transition-colors ${
                    collapsed ? "justify-center px-0" : "gap-3 px-3"
                  } ${
                    active
                      ? "border-l-2 border-cyan-300 bg-white/12 text-white"
                      : "text-slate-300 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        </nav>

        {!collapsed && (
          <section className="mt-6 flex min-h-0 flex-1 flex-col">
            <div className="mb-3 flex items-center justify-between px-1">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Histórico de Escalas
                </h2>
                <p className="mt-1 text-[11px] text-slate-500">{scheduleCount} escala(s) salvas</p>
              </div>
            </div>

            {groupedHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/12 p-4 text-center text-xs text-slate-500">
                Nenhuma escala salva.
              </div>
            ) : (
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                {groupedHistory.map((group) => (
                  <div key={group.key} className="space-y-2">
                    <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {monthLabel(group.month)} / {group.year}
                    </div>
                    <div className="space-y-2">
                      {group.items.map((item) => {
                        const active = activeScheduleId === item.id;
                        const tooltip = [
                          item.filename,
                          `Gerada em: ${formatDateTime(item.createdAt)}`,
                          `Status: ${item.status}`,
                          `Pontuação: ${formatScore(item.score)}`,
                        ].join("\n");

                        return (
                          <div
                            key={item.id}
                            title={tooltip}
                            className={`group rounded-2xl border p-2 transition-colors ${
                              active
                                ? "border-cyan-300/40 bg-cyan-300/12"
                                : "border-white/8 bg-white/5 hover:bg-white/8"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                onClick={() => onOpenSchedule(item)}
                                className="min-w-0 flex-1 text-left"
                              >
                                <div className="truncate text-sm font-semibold text-slate-100">
                                  {monthLabel(item.month)} / {item.year} · v
                                  {item.version.toString().padStart(3, "0")}
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                                  <span className={`h-2 w-2 rounded-full ${statusClassName(item.status)}`} />
                                  <span className="truncate">{item.status}</span>
                                </div>
                              </button>
                              <div className="flex shrink-0 items-center gap-1 opacity-90">
                                <button
                                  type="button"
                                  onClick={() => onOpenSchedule(item)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                                  title="Abrir"
                                >
                                  <FolderOpen className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDownloadSchedule(item)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                                  title="Baixar Excel"
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </aside>
  );
}
