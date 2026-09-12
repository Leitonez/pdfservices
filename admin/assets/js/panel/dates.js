// Calendar-day helpers. Day keys are "AAAA-MM-DD" strings in Brasília time (the API's reporting zone).

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/** Today in Brasília as "AAAA-MM-DD". */
export function todayKey() {
  const parts = Object.fromEntries(partsFormatter.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function toUtc(key) {
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

export function addDays(key, days) {
  return new Date(toUtc(key) + days * 86400000).toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a, b) {
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}

export function isDayKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toUtc(value));
}

const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });

/** "2026-09-12" -> "sáb." */
export function weekdayOf(key) {
  return weekdayFormatter.format(new Date(toUtc(key)));
}

/** Every day from `from` to `to` (inclusive) with the counts summed across capabilities; empty days are zero. */
export function fillDays(from, to, days) {
  const byDate = new Map();
  for (const day of days || []) {
    const entry = byDate.get(day.date) || { count: 0, amount: 0 };
    entry.count += Number(day.count) || 0;
    entry.amount += Number(day.amount) || 0;
    byDate.set(day.date, entry);
  }

  const series = [];
  const total = daysBetween(from, to);
  for (let i = 0; i <= total; i += 1) {
    const date = addDays(from, i);
    const entry = byDate.get(date) || { count: 0, amount: 0 };
    series.push({ date, count: entry.count, amount: Math.round(entry.amount * 1e6) / 1e6 });
  }
  return series;
}
