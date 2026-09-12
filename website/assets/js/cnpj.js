// CNPJ helpers, numeric and alphanumeric (IN RFB 2.229/2024, in force since July 2026).
// Mirrors api/Services/CnpjValidator.cs: each character is worth its ASCII code minus 48.

const FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const SECOND_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Uppercase, only [0-9A-Z]. */
export function normalizeCnpj(value) {
  return (value || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** Formats while typing: AA.AAA.AAA/AAAA-DD (the last two positions are digits). */
export function maskCnpj(value) {
  let raw = normalizeCnpj(value);
  const base = raw.slice(0, 12);
  const digits = raw.slice(12).replace(/[^0-9]/g, '').slice(0, 2);
  raw = base + digits;

  let out = raw.slice(0, 2);
  if (raw.length > 2) out += '.' + raw.slice(2, 5);
  if (raw.length > 5) out += '.' + raw.slice(5, 8);
  if (raw.length > 8) out += '/' + raw.slice(8, 12);
  if (raw.length > 12) out += '-' + raw.slice(12, 14);
  return out;
}

function checkDigit(value, weights) {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += (value.charCodeAt(i) - 48) * weights[i];
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCnpj(value) {
  const cnpj = normalizeCnpj(value);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) {
    return false;
  }
  return checkDigit(cnpj, FIRST_WEIGHTS) === Number(cnpj[12]) && checkDigit(cnpj, SECOND_WEIGHTS) === Number(cnpj[13]);
}
