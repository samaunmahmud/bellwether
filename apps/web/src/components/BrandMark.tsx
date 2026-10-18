/**
 * The Bellwether mark: the lead ewe wearing her bell (a bellwether is the sheep that leads the
 * flock). Fixed brand colours, so it looks the same in every colour scheme.
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg className="brand__mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#1f4d38" />
      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="15"
        fill="none"
        stroke="#f4ecd8"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <g fill="#f4ecd8">
        <circle cx="21" cy="21" r="8" />
        <circle cx="32" cy="16" r="9" />
        <circle cx="43" cy="21" r="8" />
        <circle cx="17" cy="30" r="6" />
        <circle cx="47" cy="30" r="6" />
      </g>
      <ellipse cx="15" cy="31" rx="7" ry="3.4" transform="rotate(-18 15 31)" fill="#2b2b2b" />
      <ellipse cx="49" cy="31" rx="7" ry="3.4" transform="rotate(18 49 31)" fill="#2b2b2b" />
      <path d="M32 21c7 0 10 6 10 13 0 8-4.5 13-10 13s-10-5-10-13c0-7 3-13 10-13z" fill="#2b2b2b" />
      <circle cx="27.5" cy="32" r="1.8" fill="#f4ecd8" />
      <circle cx="36.5" cy="32" r="1.8" fill="#f4ecd8" />
      <path
        d="M24 47.5q8 4 16 0"
        fill="none"
        stroke="#d9a441"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M28 51.5c0-3 1.8-4.5 4-4.5s4 1.5 4 4.5v4h-8z" fill="#d9a441" />
      <circle cx="32" cy="57.3" r="1.6" fill="#d9a441" />
    </svg>
  );
}
