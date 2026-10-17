/** The Bellwether bell, coloured from the theme. */
export function BrandMark() {
  return (
    <svg className="brand__mark" width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="var(--accent)" />
      <path
        d="M10 21c0-6 2.5-10 6-10s6 4 6 10H10zm4.5 2.5a1.5 1.5 0 0 0 3 0"
        fill="none"
        stroke="var(--accent-text)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16 11V8" stroke="var(--accent-text)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
