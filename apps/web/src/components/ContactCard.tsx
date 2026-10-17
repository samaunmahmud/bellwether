import { telHref } from '../nearby';
import type { Contact } from '../types';
import { Icon } from './Icon';

/** v4: one contact, with every way of reaching them as a link a phone can act on. */
export function ContactCard({
  contact,
  onEdit,
  onDelete,
  showFarm = false,
}: {
  contact: Contact;
  onEdit?: () => void;
  onDelete?: () => void;
  showFarm?: boolean;
}) {
  const c = contact;
  const id = `contact-${c.id}`;
  return (
    <article className={`contact contact--${c.kind.toLowerCase()}`} aria-labelledby={id}>
      <header className="contact__head">
        <h3 id={id}>{c.name}</h3>
        {showFarm && <span className="muted">{c.farmName ?? 'Your own contact'}</span>}
      </header>
      <div className="contact__ways">
        {c.emergencyPhone && (
          <a
            className="button contact__call contact__call--urgent"
            href={telHref(c.emergencyPhone)}
          >
            <Icon name="phone" size={18} /> Call out of hours {c.emergencyPhone}
          </a>
        )}
        {c.phone && (
          <a className="button contact__call" href={telHref(c.phone)}>
            <Icon name="phone" size={18} /> Call {c.phone}
          </a>
        )}
        {c.email && (
          <a className="button button--secondary" href={`mailto:${c.email}`}>
            <Icon name="mail" size={18} /> {c.email}
          </a>
        )}
        {c.website && (
          <a
            className="button button--secondary"
            href={c.website}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="globe" size={18} /> Website
          </a>
        )}
      </div>
      {c.address && (
        <p className="contact__address">
          <Icon name="pin" size={16} /> {c.address}
        </p>
      )}
      {c.notes && <p className="muted">{c.notes}</p>}
      {(onEdit || onDelete) && (
        <p className="contact__actions">
          {onEdit && (
            <button
              type="button"
              className="link-button"
              onClick={onEdit}
              aria-label={`Edit ${c.name}`}
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="link-button"
              onClick={onDelete}
              aria-label={`Delete ${c.name}`}
            >
              Delete
            </button>
          )}
        </p>
      )}
    </article>
  );
}
