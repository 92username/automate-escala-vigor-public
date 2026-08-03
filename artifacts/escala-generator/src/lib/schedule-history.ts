import type {
  SavedScheduleStatus,
  ScheduleHistoryItem,
  ScheduleResult,
} from "./types";

const STORAGE_KEY = "escala-generator:schedule-history:v1";

export const CURRENT_USER = {
  id: "local-user",
  name: "Usuário local",
};

export function formatScheduleFilename(year: number, month: number, version: number): string {
  return `escala_${year}_${month.toString().padStart(2, "0")}_v${version
    .toString()
    .padStart(3, "0")}.xlsx`;
}

export function loadScheduleHistory(userId: string): ScheduleHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScheduleHistoryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

function saveAllHistory(items: ScheduleHistoryItem[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function loadAllHistory(): ScheduleHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScheduleHistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getNextScheduleVersion(
  history: ScheduleHistoryItem[],
  userId: string,
  year: number,
  month: number,
): number {
  const versions = history
    .filter((item) => item.userId === userId && item.year === year && item.month === month)
    .map((item) => item.version);
  return versions.length === 0 ? 1 : Math.max(...versions) + 1;
}

export function createScheduleHistoryItem(params: {
  userId: string;
  userName: string;
  result: ScheduleResult;
  version: number;
  selectedAlternativeId?: string | null;
  status?: SavedScheduleStatus;
}): ScheduleHistoryItem {
  const activeAlternative = params.result.alternatives?.find(
    (alternative) => alternative.id === params.selectedAlternativeId,
  );
  const score = activeAlternative?.score;

  return {
    id: `${params.userId}-${params.result.year}-${params.result.month}-${params.version}-${Date.now()}`,
    userId: params.userId,
    userName: params.userName,
    year: params.result.year,
    month: params.result.month,
    version: params.version,
    filename: formatScheduleFilename(params.result.year, params.result.month, params.version),
    createdAt: new Date().toISOString(),
    status: params.status ?? "Rascunho",
    result: params.result,
    selectedAlternativeId: params.selectedAlternativeId ?? null,
    score,
    operatorCount: params.result.rows.length,
    warningCount: params.result.warnings.length,
    violationCount: params.result.violations.length,
  };
}

export function saveScheduleHistoryItem(item: ScheduleHistoryItem): ScheduleHistoryItem[] {
  const allHistory = loadAllHistory();
  saveAllHistory([item, ...allHistory]);
  return loadScheduleHistory(item.userId);
}

export function updateScheduleHistoryStatus(
  userId: string,
  scheduleId: string,
  status: SavedScheduleStatus,
): ScheduleHistoryItem[] {
  const allHistory = loadAllHistory();
  const updated = allHistory.map((item) =>
    item.userId === userId && item.id === scheduleId ? { ...item, status } : item,
  );
  saveAllHistory(updated);
  return loadScheduleHistory(userId);
}

export function groupScheduleHistoryByMonth(
  history: ScheduleHistoryItem[],
): Array<{ key: string; year: number; month: number; items: ScheduleHistoryItem[] }> {
  const groups = new Map<string, { year: number; month: number; items: ScheduleHistoryItem[] }>();
  for (const item of history) {
    const key = `${item.year}-${item.month.toString().padStart(2, "0")}`;
    const group = groups.get(key) ?? { year: item.year, month: item.month, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }

  return Array.from(groups.entries())
    .map(([key, group]) => ({
      key,
      year: group.year,
      month: group.month,
      items: group.items.sort((a, b) => b.version - a.version),
    }))
    .sort((a, b) => b.key.localeCompare(a.key));
}
