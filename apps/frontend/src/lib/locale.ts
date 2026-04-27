/**
 * Locale utilities — bridge between our internal locale codes and the
 * BCP-47 tags that browser Intl APIs require.
 *
 * The app stores a few non-standard regional variants as a single token
 * (`esAR`, `ptBR`) instead of the standard hyphenated form (`es-AR`,
 * `pt-BR`) — that choice matters for storage keys and dictionary
 * lookups, but every browser Intl constructor (`Intl.RelativeTimeFormat`,
 * `Intl.DateTimeFormat`, `Date.prototype.toLocaleString`, etc.) parses
 * its first argument as BCP-47 and throws `RangeError: Invalid
 * language tag: esAR` when it sees a 4-letter combined code.
 *
 * That crash bricked the BacklinksPanel and the page header for any
 * Argentinian or Brazilian user. This helper rewrites just those two
 * codes; everything else passes through unchanged so future locale
 * additions keep working without an opt-in.
 *
 * Usage:
 *   const tag = bcp47Locale(locale);
 *   new Intl.RelativeTimeFormat(tag, { numeric: 'auto' });
 */
export function bcp47Locale(locale: string): string {
  // Hot-path map for the two known offenders. A switch is faster than
  // a regex split when the input is one of these short fixed strings,
  // and keeps the intent legible.
  switch (locale) {
    case 'esAR':
      return 'es-AR';
    case 'ptBR':
      return 'pt-BR';
    default:
      return locale;
  }
}
