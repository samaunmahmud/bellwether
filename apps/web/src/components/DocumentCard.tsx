import { dayMonth } from '../dates';
import { expiryLabel, formatSize } from '../documents';
import type { StoredDocument } from '../types';
import { DOCUMENT_KIND_LABELS } from './DocumentForm';
import { Icon } from './Icon';

const TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'Photo',
  'image/png': 'Image',
  'image/webp': 'Image',
};

/** v4: one stored document, with open and save, and edit and delete for those allowed. */
export function DocumentCard({
  doc,
  onOpen,
  onSave,
  onEdit,
  onDelete,
  busy = false,
}: {
  doc: StoredDocument;
  onOpen: () => void;
  onSave: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  busy?: boolean;
}) {
  const id = `document-${doc.id}`;
  const expiry = expiryLabel(doc.daysToExpiry, doc.expiresOn);
  const links = [doc.group?.name, doc.taggedAnimal?.tag].filter(Boolean).join(' · ');
  const meta = [
    TYPE_LABELS[doc.mimeType] ?? 'File',
    formatSize(doc.sizeBytes),
    doc.documentDate ? `dated ${dayMonth(doc.documentDate)} ${doc.documentDate.slice(0, 4)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <article className={`doc doc--${doc.kind.toLowerCase()}`} aria-labelledby={id} aria-busy={busy}>
      <header className="doc__head">
        <span className="doc__icon" aria-hidden="true">
          <Icon name="file" size={22} />
        </span>
        <div>
          <span className="doc__kind">{DOCUMENT_KIND_LABELS[doc.kind]}</span>
          <h3 id={id}>{doc.title}</h3>
          <p className="muted doc__meta">{meta}</p>
        </div>
      </header>
      {links && <p className="doc__links">For {links}</p>}
      {expiry && <span className={`badge badge--${expiry.level}`}>{expiry.text}</span>}
      {doc.notes && <p className="muted">{doc.notes}</p>}
      <div className="doc__actions">
        <button type="button" onClick={onOpen} aria-label={`Open ${doc.title}`} disabled={busy}>
          <Icon name="eye" size={18} /> Open
        </button>
        <button
          type="button"
          className="secondary"
          onClick={onSave}
          aria-label={`Save ${doc.title} to this device`}
          disabled={busy}
        >
          <Icon name="download" size={18} /> Save
        </button>
        {onEdit && (
          <button
            type="button"
            className="link-button"
            onClick={onEdit}
            aria-label={`Edit ${doc.title}`}
          >
            Edit
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            className="link-button"
            onClick={onDelete}
            aria-label={`Delete ${doc.title}`}
          >
            Delete
          </button>
        )}
      </div>
    </article>
  );
}
