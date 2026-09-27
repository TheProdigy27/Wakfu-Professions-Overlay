// Normalisation commune à la recherche et à l'index.

/**
 * Minuscules, sans diacritiques, apostrophes et guillemets unifiés, œ/æ développés, espaces fusionnés.
 * La ponctuation est conservée : des noms réels en sont presque entièrement faits (`!"(-è@)"`).
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFKD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[’‘´`ʼ]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}
