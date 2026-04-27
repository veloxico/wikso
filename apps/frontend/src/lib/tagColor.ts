/**
 * Tag color generator — shares the deterministic-hash idea with avatarColor
 * but lives in its own module because tags target a different visual feel:
 * smaller chips, broader hue range (cool greens/blues/purples are fine since
 * tags read against the page accent, not next to a name plate).
 *
 * The CSS rule for `.wp-tag` reads `--tag-h` and a `--tag-c` chroma, so all
 * we need to emit is a hue number in `[0, 360)`. The palette is intentionally
 * not equally spaced — we cluster around hues that pair well with warm
 * sepia/ochre page accents (so the tag stays calm even when many are stacked
 * on a single document).
 */

const TAG_HUES = [
  18, 35, 55, 75, 95, 130, 155, 180, 210, 235, 260, 285, 315, 340,
] as const;

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Hash a tag name onto one of the curated hues.
 * Same name → same hue across reloads and surfaces.
 */
export function tagHue(name: string): number {
  if (!name) return 40; // neutral honey for empty/falsy
  return TAG_HUES[hash(name) % TAG_HUES.length];
}

/**
 * Returns inline style props ready for a `.wp-tag` element. Only the
 * `--tag-h` is set — the chroma defaults from CSS are respected, so the
 * palette stays tonally coherent.
 */
export function tagStyle(name: string): React.CSSProperties {
  return { '--tag-h': tagHue(name) } as React.CSSProperties;
}
