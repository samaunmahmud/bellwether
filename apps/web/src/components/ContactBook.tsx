import { useMutation, type DocumentNode } from '@apollo/client';
import { useState } from 'react';
import { ADD_CONTACT, DELETE_CONTACT, UPDATE_CONTACT } from '../graphql/keeping';
import type { Contact, ContactKind } from '../types';
import { ContactCard } from './ContactCard';
import { ContactForm, type ContactValues } from './ContactForm';
import { Icon } from './Icon';
import { useToast } from './Toasts';

const SECTIONS: Array<[ContactKind, string]> = [
  ['VET', 'Vets'],
  ['FEED', 'Feed merchants'],
  ['SUPPLIER', 'Suppliers'],
  ['OTHER', 'Other contacts'],
];

/**
 * v4: a list of contacts grouped by kind, with add, edit and delete for those allowed.
 * `farmId` null means the user's own contacts.
 */
export function ContactBook({
  contacts,
  farmId,
  canEdit,
  refetch,
}: {
  contacts: Contact[];
  farmId: string | null;
  canEdit: boolean;
  refetch: { query: DocumentNode; variables?: Record<string, unknown> };
}) {
  const options = { refetchQueries: [refetch], awaitRefetchQueries: true };
  const [addContact] = useMutation(ADD_CONTACT, options);
  const [updateContact] = useMutation(UPDATE_CONTACT, options);
  const [deleteContact] = useMutation(DELETE_CONTACT, options);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const toast = useToast();

  async function add(values: ContactValues) {
    await addContact({ variables: { input: { farmId, ...values } } });
    setEditing(null);
    toast(`${values.name} saved`);
  }

  async function update(id: string, values: ContactValues) {
    await updateContact({ variables: { id, input: values } });
    setEditing(null);
    toast(`${values.name} updated`);
  }

  async function remove(c: Contact) {
    if (!window.confirm(`Delete ${c.name} from your contacts?`)) return;
    await deleteContact({ variables: { id: c.id } });
  }

  return (
    <div className="contact-book">
      {canEdit &&
        (editing === 'new' ? (
          <ContactForm onSubmit={add} onCancel={() => setEditing(null)} />
        ) : (
          <button type="button" onClick={() => setEditing('new')} className="contact-book__add">
            <Icon name="plus" size={18} /> Add a contact
          </button>
        ))}

      {contacts.length === 0 && (
        <p className="empty">
          No contacts yet. Save your vet (with their out-of-hours number), feed merchants and
          suppliers here, so they’re one tap away.
        </p>
      )}

      {SECTIONS.map(([kind, title]) => {
        const list = contacts.filter((c) => c.kind === kind);
        if (list.length === 0) return null;
        return (
          <section key={kind} aria-label={title} className="contact-book__section">
            <h2>{title}</h2>
            <div className="contact-grid">
              {list.map((c) =>
                editing === c.id ? (
                  <ContactForm
                    key={c.id}
                    initial={c}
                    onSubmit={(values) => update(c.id, values)}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <ContactCard
                    key={c.id}
                    contact={c}
                    onEdit={canEdit ? () => setEditing(c.id) : undefined}
                    onDelete={canEdit ? () => remove(c) : undefined}
                  />
                ),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
