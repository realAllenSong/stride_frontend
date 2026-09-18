export type Period = "daily" | "weekly" | "monthly" | "yearly";
export const PERIODS: Period[] = ["daily", "weekly", "monthly", "yearly"];
export const DEMO_DATE = "2026-09-09";
export const TIME_ZONE = "America/New_York";
const clampDate = (date: string) =>
  date < "2000-01-01"
    ? "2000-01-01"
    : date > "2100-12-31"
      ? "2100-12-31"
      : date;
export function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
export function fromISO(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = fromISO(value);
  return (
    !Number.isNaN(d.valueOf()) &&
    iso(d) === value &&
    value >= "2000-01-01" &&
    value <= "2100-12-31"
  );
}
export function addDays(value: string, count: number): string {
  const d = fromISO(value);
  d.setUTCDate(d.getUTCDate() + count);
  return iso(d);
}
export function bounds(
  date: string,
  period: Period,
): { start: string; end: string } {
  const d = fromISO(date),
    year = d.getUTCFullYear(),
    month = d.getUTCMonth();
  if (period === "daily") return { start: date, end: date };
  if (period === "weekly") {
    const start = addDays(date, -((d.getUTCDay() + 6) % 7));
    return { start: clampDate(start), end: clampDate(addDays(start, 6)) };
  }
  if (period === "monthly")
    return {
      start: iso(new Date(Date.UTC(year, month, 1, 12))),
      end: iso(new Date(Date.UTC(year, month + 1, 0, 12))),
    };
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}
export function shiftPeriod(
  date: string,
  period: Period,
  delta: number,
): string {
  if (period === "daily" || period === "weekly")
    return clampDate(addDays(date, delta * (period === "weekly" ? 7 : 1)));
  const d = fromISO(date),
    day = d.getUTCDate();
  d.setUTCDate(1);
  if (period === "monthly") d.setUTCMonth(d.getUTCMonth() + delta);
  else d.setUTCFullYear(d.getUTCFullYear() + delta);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return clampDate(iso(d));
}
export function shortDate(value: string, withYear = false): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
  }).format(fromISO(value));
}
export function periodLabel(date: string, period: Period): string {
  const { start, end } = bounds(date, period);
  if (period === "daily") return shortDate(date, true);
  if (period === "weekly")
    return `${shortDate(start)} - ${shortDate(end, true)}`;
  return new Intl.DateTimeFormat("en-US", {
    ...(period === "monthly" ? { month: "long" as const } : {}),
    year: "numeric",
    timeZone: "UTC",
  }).format(fromISO(date));
}
