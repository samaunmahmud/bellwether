/** Simple line icons, drawn inline so they follow the text colour. Decorative unless labelled. */
const PATHS = {
  dashboard: 'M4 13h6V4H4zm0 7h6v-5H4zm10 0h6v-9h-6zm0-16v5h6V4z',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zm0 0v14m6-12v14',
  livestock:
    'M7 8c0-2 2-4 5-4s5 2 5 4c2 0 3 1.5 3 3.5S18.5 15 17 15v4h-2v-3H9v3H7v-4c-1.5 0-3-1-3-3.5S5 8 7 8z',
  outlook:
    'M12 3v2m0 14v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M3 12h2m14 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  briefing: 'M4 5h16v14H4zm4 4h8m-8 4h5',
  calendar: 'M4 6h16v14H4zm0 4h16M8 3v4m8-4v4',
  tasks: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  register: 'M6 3h9l4 4v14H6zm9 0v4h4M9 12h7m-7 4h7m-7-8h3',
  medicine: 'M10 3h4v4h4v4h-4v4h-4v-4H6V7h4zM5 19h14',
  records: 'M5 4h14v16H5zm3 4h8m-8 4h8m-8 4h5',
  people:
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm-6 9c0-3 3-5 6-5s6 2 6 5m2-9a3 3 0 1 0 0-6m2 15c0-2.5-1.5-4-3-4.6',
  settings:
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm8 3-2.2.7-.4 1 1 2.1-1.4 1.4-2.1-1-1 .4L13.2 20h-2.4l-.7-2.2-1-.4-2.1 1-1.4-1.4 1-2.1-.4-1L4 12.6v-2l2.2-.7.4-1-1-2.1 1.4-1.4 2.1 1 1-.4L10.8 4h2.4l.7 2.2 1 .4 2.1-1 1.4 1.4-1 2.1.4 1L20 10.6z',
  farms: 'M3 20V9l9-5 9 5v11M8 20v-6h8v6',
  pets: 'M6 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm12 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-3 4c-3 0-6 4-6 7 0 2 2 3 3 2s2-1 3-1 2 0 3 1 3 0 3-2c0-3-3-7-6-7z',
  forecast: 'M7 18a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 18z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  alert: 'M12 3 2 20h20zm0 6v5m0 3v.5',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4m-4-4h11',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeOff:
    'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  wind: 'M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h7',
  sparkle:
    'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  check: 'M5 12.5l4.5 4.5L19 7',
  phone:
    'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  mail: 'M3 6h18v12H3zm0 0 9 7 9-7',
  globe:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-9 9h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zm0-14a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  siren: 'M7 18v-6a5 5 0 0 1 10 0v6M5 18h14v3H5zM12 3v2M4.5 6l1.4 1.4M19.5 6l-1.4 1.4',
  thermometer: 'M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0zM12 9v6',
  drop: 'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z',
  tag: 'M3 12V4h8l10 10-8 8zm5-4.5a1 1 0 1 0 0 .1',
  scale: 'M4 20h16M6 20l2-12h8l2 12M12 8V5m-3 0h6',
  file: 'M6 3h8l4 4v14H6zm8 0v4h4M9 12h6m-6 4h6',
  download: 'M12 4v11m-5-5 5 5 5-5M5 20h14',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 20,
  label,
}: {
  name: IconName;
  size?: number;
  label?: string;
}) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
