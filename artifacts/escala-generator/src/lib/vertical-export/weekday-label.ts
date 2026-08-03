export function formatOfficialVerticalWeekdayLabel(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    timeZone: "UTC",
  })
    .format(date)
    .replace(/\.$/, "")
    .toLocaleUpperCase("pt-BR");
}
