export function normalizeTr(input: string): string {
  const s = String(input ?? '')
    .trim()
    // `toLowerCase` doesn't accept a locale argument; keep it portable.
    // We apply Turkish-specific character fallbacks below.
    .toLowerCase()
    // Normalize combined characters
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

  // Turkish-specific fallbacks
  return s
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ');
}
