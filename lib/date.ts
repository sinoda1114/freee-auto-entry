const TOKYO_TIME_ZONE = "Asia/Tokyo";

export function formatTokyoDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TOKYO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatTokyoMonth(date = new Date()): string {
  return formatTokyoDate(date).slice(0, 7);
}
