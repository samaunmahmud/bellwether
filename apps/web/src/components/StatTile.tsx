import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** A dashboard figure: a label, one big value and an optional note underneath. */
export function StatTile({
  label,
  value,
  note,
  tone,
  to,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  /** "alert" draws attention with a border and an icon-free word in the note, never colour alone */
  tone?: 'alert' | 'good';
  to?: string;
}) {
  const body = (
    <>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      {note && <span className="stat__note">{note}</span>}
    </>
  );
  const className = `stat${tone ? ` stat--${tone}` : ''}`;
  return to ? (
    <Link to={to} className={`${className} stat--link`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
