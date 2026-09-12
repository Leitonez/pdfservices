// pt-BR formatting helpers.
// This file is duplicated in website/ and admin/: keep both copies identical.

const moneyFormatters = new Map();

/** R$ with at least 2 and at most `maxDecimals` decimals: 0.001 -> "R$ 0,001", 12.5 -> "R$ 12,50". */
export function formatMoney(value, maxDecimals = 6) {
  if (!moneyFormatters.has(maxDecimals)) {
    moneyFormatters.set(maxDecimals, new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: maxDecimals
    }));
  }
  return moneyFormatters.get(maxDecimals).format(Number(value) || 0);
}

const integerFormatter = new Intl.NumberFormat('pt-BR');

export function formatNumber(value) {
  return integerFormatter.format(Number(value) || 0);
}

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo'
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' });

/** ISO timestamp -> "12/09/2026 14:03" (Brasília). */
export function formatDateTime(iso) {
  return iso ? dateTimeFormatter.format(new Date(iso)) : '—';
}

/** ISO timestamp -> "12/09/2026" (Brasília). */
export function formatDate(iso) {
  return iso ? dateFormatter.format(new Date(iso)) : '—';
}

/** "2026-09-12" (a calendar day, no time zone) -> "12/09". */
export function formatDayKey(dayKey, withYear = false) {
  const [year, month, day] = dayKey.split('-');
  return withYear ? `${day}/${month}/${year}` : `${day}/${month}`;
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) {
    return value + ' B';
  }
  if (value < 1024 * 1024) {
    return (value / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' KB';
  }
  return (value / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' MB';
}
