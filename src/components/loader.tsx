// A boba cup that fills with sloshing tea while pearls bounce. Pure CSS, so it
// animates during streaming before any JavaScript runs.
export function BobaLoader({label = 'brewing your boba', compact = false}: {label?: string; compact?: boolean}) {
  return (
    <div className={'boba-loader' + (compact ? ' compact' : '')} role="status" aria-live="polite">
      <svg viewBox="0 0 120 150" aria-hidden="true">
        <defs>
          <clipPath id="cup-inside"><path d="M25 46h70l-8 82a9 9 0 0 1-9 8H42a9 9 0 0 1-9-8z"/></clipPath>
        </defs>
        <ellipse className="bl-shadow" cx="60" cy="144" rx="30" ry="4"/>
        <path className="bl-straw" d="M70 4l10 2-9 50-9-1z"/>
        <g clipPath="url(#cup-inside)">
          <rect x="20" y="40" width="80" height="100" className="bl-glass"/>
          <g className="bl-tea">
            <path className="bl-wave back" d="M0 78q15-7 30 0t30 0 30 0 30 0 30 0 30 0 30 0 30 0v80H0z"/>
            <path className="bl-wave" d="M0 82q15-7 30 0t30 0 30 0 30 0 30 0 30 0 30 0 30 0v80H0z"/>
          </g>
          <circle className="bl-pearl" cx="45" cy="124" r="7"/>
          <circle className="bl-pearl" cx="60" cy="127" r="7"/>
          <circle className="bl-pearl" cx="75" cy="124" r="7"/>
          <circle className="bl-pearl small" cx="52" cy="110" r="5"/>
          <circle className="bl-pearl small" cx="69" cy="112" r="5"/>
        </g>
        <path className="bl-cup" d="M25 46h70l-8 82a9 9 0 0 1-9 8H42a9 9 0 0 1-9-8z"/>
        <rect className="bl-lid" x="19" y="36" width="82" height="12" rx="6"/>
        <path className="bl-shine" d="M34 58l4 52"/>
      </svg>
      <p>{label}<span className="bl-dots"><i>.</i><i>.</i><i>.</i></span></p>
    </div>
  );
}
