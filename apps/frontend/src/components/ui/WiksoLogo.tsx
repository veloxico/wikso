interface WiksoLogoProps {
  className?: string;
  showText?: boolean;
}

/**
 * Wikso logo: a minimalist open book / origami unfold.
 * Clean geometry, balanced proportions, recognizable at any size.
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
    <svg viewBox="-2 0 380 86" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {icon}
      <text
        x="106" y="62"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="54"
        fontWeight="700"
        letterSpacing="-1"
        fill="currentColor"
      >
        Wikso
      </text>
    </svg>
  );
}
