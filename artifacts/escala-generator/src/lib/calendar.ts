export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function weekdayOf(year: number, month: number, day: number): number {
  // 0 = Sunday, 6 = Saturday
  return new Date(year, month - 1, day).getDay();
}

export function weekdayLabel(weekday: number): string {
  return ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"][weekday] ?? "";
}

export function monthLabel(month: number): string {
  return [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ][month - 1] ?? "";
}

export function isWeekend(weekday: number): boolean {
  return weekday === 0 || weekday === 6;
}

export function isFriday(weekday: number): boolean {
  return weekday === 5;
}

export function isWeekdayMonFri(weekday: number): boolean {
  return weekday >= 1 && weekday <= 5;
}
