// All "today" logic uses your local timezone, not the server's
// (Vercel runs in UTC, which is a day behind Sydney every morning).
export const TIME_ZONE = process.env.DASHBOARD_TIME_ZONE || "Australia/Sydney";

/** Today's date as YYYY-MM-DD in TIME_ZONE. */
export function todayISO(): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(
    new Date(),
  );
}

/** "today", "yesterday", "5 days ago", or "never". */
export function describeLastWorked(date: string | null, today: string): string {
  if (!date) return "never";
  const days = Math.round(
    (Date.parse(today) - Date.parse(date)) / 86_400_000,
  );
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/** Days since last worked on, or null if never. */
export function daysSince(date: string | null, today: string): number | null {
  if (!date) return null;
  return Math.round((Date.parse(today) - Date.parse(date)) / 86_400_000);
}
