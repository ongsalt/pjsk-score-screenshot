const FULL_WIDTH_DIGITS = '０１２３４５６７８９';
const ASCII_DIGITS = '0123456789';

function normalizeDigit(char: string): string {
  const index = FULL_WIDTH_DIGITS.indexOf(char);
  return index >= 0 ? ASCII_DIGITS[index] : char;
}

export function normalizeText(input: string): string {
  return Array.from(input)
    .map((char) => normalizeDigit(char))
    .join('')
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeForMatch(input: string): string {
  return normalizeText(input)
    .toLowerCase()
    .replace(/[\s_\-:.,/\\|()[\]{}]/g, '');
}

export function parseIntegerFromText(input: string): number | null {
  const normalized = normalizeText(input);
  const digitsOnly = normalized.replace(/[^\d]/g, '');

  if (digitsOnly.length === 0) {
    return null;
  }

  const parsed = Number.parseInt(digitsOnly, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isMostlyNumeric(input: string): boolean {
  const normalized = normalizeText(input);
  if (normalized.length === 0) {
    return false;
  }

  const numericChars = normalized.replace(/[^\d]/g, '').length;
  return numericChars / normalized.length > 0.6;
}

export function hasMeaningfulText(input: string): boolean {
  const normalized = normalizeText(input);
  return normalized.replace(/[\d\s:.,/\\|()[\]{}\-]/g, '').length > 1;
}
