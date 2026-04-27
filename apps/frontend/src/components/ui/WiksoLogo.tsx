interface WiksoLogoProps {
  className?: string;
  showText?: boolean;
}

/**
 * Wikso logo — minimalist open book / origami unfold paired with an
 * editorial wordmark in Source Serif 4 (the warm-paper body font).
 *
 * Wordmark choices:
 *  • `font-family` lists 'Source Serif 4' first then falls back to
 *    Georgia/Times so the SVG still reads correctly before the webfont
 *    loads (Inter would feel too plain next to the book glyph).
 *  • `font-weight: 600` keeps it expressive but not heavy — the icon
 *    carries most of the visual weight.
 *  • `font-feature-settings: 'ss01'` enables Source Serif's stylistic
 *    set 1 (a softer 'k' and balanced 'a') which matches the .wikso-title
 *    treatment elsewhere — same letterforms across logo + page titles.
 *  • A custom hand-drawn underline curve under the word is rendered as
 *    a separate path so it inherits accent color via `fill: currentColor`
 *    on the parent (or via `--logo-spark` which we already expose).
 */
export function WiksoLogo({ className = '', showText = true }: WiksoLogoProps) {
  const icon = (
    <g>
      {/* Left page — outer face (lighter) */}
      <path
        d="M46 12 L6 36 L16 80 L46 60 Z"
        fill="var(--logo-left, #6AADFF)"
      />
      {/* Left page — inner face (darker, creates fold depth) */}
      <path
        d="M46 12 L30 22 L16 80 L46 60 Z"
        fill="var(--logo-left-dark, #2D6BDD)"
      />

      {/* Right page — outer face (lighter) */}
      <path
        d="M54 12 L94 36 L84 80 L54 60 Z"
        fill="var(--logo-right, #5B9FFF)"
      />
      {/* Right page — inner face (darker) */}
      <path
        d="M54 12 L70 22 L84 80 L54 60 Z"
        fill="var(--logo-right-dark, #1A4FAA)"
      />

      {/* Center spine — bright accent line */}
      <path
        d="M46 12 L50 6 L54 12 L54 60 L50 64 L46 60 Z"
        fill="var(--logo-spine, #8AC4FF)"
      />
    </g>
  );

  if (!showText) {
    return (
      <svg viewBox="2 2 96 82" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        {icon}
      </svg>
    );
  }

  return (
    <svg viewBox="-2 0 380 92" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {icon}
      <text
        x="106"
        y="62"
        fontFamily="'Source Serif 4', Georgia, 'Times New Roman', serif"
        fontSize="56"
        fontWeight="600"
        letterSpacing="-1.5"
        fill="currentColor"
        style={{ fontFeatureSettings: "'ss01'", fontVariationSettings: "'opsz' 60, 'SOFT' 30" }}
      >
        Wikso
      </text>
      {/* Hand-drawn underline — slight wobble + tapered ends keeps it
          from feeling like a generic CSS rule. Inherits accent via
          --logo-spine which is already accent-soft. */}
      <path
        d="M108 76 C 168 71, 230 73, 290 76"
        stroke="var(--logo-spine, #8AC4FF)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
    </svg>
  );
}
