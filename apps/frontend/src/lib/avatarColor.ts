/**
 * Deterministic avatar palette generator.
 *
 * Hashes any string (typically a user/space name) onto a curated family of
 * warm-paper compatible OKLCH hues, returning {bg, fg, ring} so callers can
 * paint the background, glyph, and outline together. Same name → same color
 * across reloads, devices, and rendering surfaces.
 *
 * The palette is intentionally limited to 12 hues so collisions exist but
 * still feel deliberate (instead of one-off "random" colors that look noisy).
 * Hues are spaced around the warm-leaning half of the wheel (terracotta →
 * amber → moss → teal) so nothing fights with the page's dominant ochre/sepia
 * accent.
 */

/** Curated hue family — warm + a few cool punctuations for contrast. */
const HUES = [
  18, // terracotta
  35, // ember
  55, // honey
  75, // amber
  95, // moss-yellow
  130, // sage
  155, // moss
  180, // teal
  210, // slate-blue
  255, // periwinkle
  285, // plum
  340, // dusty rose
] as const;

/** Cheap deterministic hash → 32-bit int. djb2 variant. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    // bitwise multiply-and-add keeps it inside SMI range on most JS runtimes
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export interface AvatarPalette {
  /** Background fill (light tint). */
  bg: string;
  /** Foreground glyph color (deep ink). */
  fg: string;
  /** Outline ring (between bg and fg darkness). */
  ring: string;
  /** Soft glow / hover halo. */
  soft: string;
  /** The raw hue we picked, exposed for callers that want to drive a CSS var. */
  hue: number;
}

/**
 * Resolve the palette for a given seed string. Empty/falsy input maps to a
 * neutral grey so anonymous avatars stay obviously anonymous.
 */
export function paletteFor(seed: string | null | undefined): AvatarPalette {
  if (!seed) {
    return {
      bg: 'oklch(92% 0.012 70)',
      fg: 'oklch(35% 0.015 70)',
      ring: 'oklch(78% 0.018 70)',
      soft: 'oklch(96% 0.01 70)',
      hue: 70,
    };
  }
  const hue = HUES[hash(seed) % HUES.length];
  return {
    bg: `oklch(92% 0.05 ${hue})`,
    fg: `oklch(34% 0.10 ${hue})`,
    ring: `oklch(78% 0.07 ${hue} / 0.6)`,
    soft: `oklch(96% 0.04 ${hue})`,
    hue,
  };
}

/**
 * Convert a name like "Anna María de la Vega" into 1–2 initial glyphs:
 * "AV". Falls back to "?" for empty input. Pulls the first letter of the
 * first word and the first letter of the last word (single-word names get
 * just the first letter).
 */
export function initialsFor(name: string | null | undefined): string {
  if (!name) return '?';
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? '' : '';
  return (first + last).toUpperCase().slice(0, 2);
}

/**
 * One-shot helper for inline `style={...}` props on simple avatar circles.
 * Returns the most common subset (background + ring + color) so consumers
 * don't have to manually splice the palette.
 */
export function avatarStyle(seed: string | null | undefined): React.CSSProperties {
  const p = paletteFor(seed);
  return {
    background: p.bg,
    color: p.fg,
    boxShadow: `inset 0 0 0 1px ${p.ring}`,
  };
}
