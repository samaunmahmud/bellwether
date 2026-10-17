import { useMutation, useQuery } from '@apollo/client';
import { useState, type FormEvent } from 'react';
import { PageHero } from '../components/photos';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../errors';
import { FARMS_QUERY } from '../graphql/farms';
import {
  CANCEL_INVITE,
  INVITE_MEMBER,
  PEOPLE_QUERY,
  REMOVE_MEMBER,
  SET_MEMBER_ROLE,
} from '../graphql/members';
import { canManage, ROLE_HELP, ROLE_LABELS } from '../roles';
import type { FarmMember, FarmRole } from '../types';

interface People {
  id: string;
  name: string;
  myRole: FarmRole;
  members: FarmMember[];
  invites: Array<{ id: string; email: string; role: FarmRole }>;
}

const ROLES: FarmRole[] = ['WORKER', 'VIEWER', 'OWNER'];

function InviteForm({
  onInvite,
}: {
  onInvite: (email: string, role: FarmRole) => Promise<unknown>;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<FarmRole>('WORKER');
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await onInvite(email.trim(), role);
      setMessage({ error: false, text: `Invitation sent to ${email.trim()}` });
      setEmail('');
    } catch (err) {
      setMessage({ error: true, text: errorMessage(err) });
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} aria-label="Invite someone">
      <div className="form--inline">
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            required
          />
        </label>
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value as FarmRole)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted">{ROLE_HELP[role]}.</p>
      {message && (
        <p className={message.error ? 'error' : 'muted'} role={message.error ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
      <button type="submit">Send invitation</button>
    </form>
  );
}

/** FR-8.2: who can see and work on this farm. */
/** Two letters from the start of an email, e.g. "jo.vet@…" → "JV". */
export function initials(email: string) {
  const parts = email
    .split('@')[0]!
    .split(/[._+-]+/)
    .filter(Boolean);
  const letters = parts.length > 1 ? parts[0]![0]! + parts[1]![0]! : (parts[0]?.slice(0, 2) ?? '?');
  return letters.toUpperCase();
}

export function PeoplePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useQuery<{ farm: People | null }>(PEOPLE_QUERY, {
    variables: { id },
  });
  const refetch = { refetchQueries: [{ query: PEOPLE_QUERY, variables: { id } }] };
  const [inviteMember] = useMutation(INVITE_MEMBER, refetch);
  const [cancelInvite] = useMutation(CANCEL_INVITE, refetch);
  const [setMemberRole] = useMutation(SET_MEMBER_ROLE, refetch);
  const [removeMember] = useMutation(REMOVE_MEMBER, refetch);
  const [leave] = useMutation(REMOVE_MEMBER, { refetchQueries: [{ query: FARMS_QUERY }] });
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) return <p aria-live="polite">Loading…</p>;
  if (error)
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  const farm = data?.farm;
  if (!farm) return <h1>Farm not found</h1>;
  const owner = canManage(farm.myRole);
  const me = farm.members.find((m) => m.isMe);

  const run = async (action: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  return (
    <section>
      <PageHero photo="cattle" eyebrow={<Link to={`/farms/${farm.id}`}>{farm.name}</Link>}>
        <h1>People</h1>
        <p className="muted">
          You are{' '}
          {farm.myRole === 'OWNER' ? 'an owner' : `a ${ROLE_LABELS[farm.myRole].toLowerCase()}`} on
          this farm. {ROLE_HELP[farm.myRole]}.
        </p>
      </PageHero>
      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}

      <ul className="list" aria-label="Members">
        {farm.members.map((m) => (
          <li key={m.userId} className="row">
            <span className="member">
              <span className={`avatar avatar--${m.role.toLowerCase()}`} aria-hidden="true">
                {initials(m.email)}
              </span>
              <span>{m.isMe ? `${m.email} (you)` : m.email}</span>
            </span>
            {owner ? (
              <span className="log__actions">
                <select
                  aria-label={`Role for ${m.email}`}
                  value={m.role}
                  onChange={(e) =>
                    run(() =>
                      setMemberRole({
                        variables: { farmId: farm.id, userId: m.userId, role: e.target.value },
                      }),
                    )
                  }
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                {!m.isMe && (
                  <button
                    type="button"
                    className="link-button"
                    aria-label={`Remove ${m.email}`}
                    onClick={() => {
                      if (window.confirm(`Remove ${m.email} from ${farm.name}?`))
                        void run(() =>
                          removeMember({ variables: { farmId: farm.id, userId: m.userId } }),
                        );
                    }}
                  >
                    Remove
                  </button>
                )}
              </span>
            ) : (
              <span className="pill">{ROLE_LABELS[m.role]}</span>
            )}
          </li>
        ))}
      </ul>

      {owner && (
        <>
          <h2>Invite someone</h2>
          <p className="muted">
            They&apos;ll get an email, and see the invitation when they sign up or log in with that
            address.
          </p>
          <InviteForm
            onInvite={(email, role) =>
              inviteMember({ variables: { farmId: farm.id, email, role } })
            }
          />
          {farm.invites.length > 0 && (
            <>
              <h2>Waiting to accept</h2>
              <ul className="list" aria-label="Invitations sent">
                {farm.invites.map((invite) => (
                  <li key={invite.id} className="row">
                    <span>
                      {invite.email} · {ROLE_LABELS[invite.role]}
                    </span>
                    <button
                      type="button"
                      className="link-button"
                      aria-label={`Cancel invitation for ${invite.email}`}
                      onClick={() => run(() => cancelInvite({ variables: { id: invite.id } }))}
                    >
                      Cancel
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {me && (
        <>
          <h2>Leave</h2>
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (!window.confirm(`Leave ${farm.name}? You'll need a new invitation to come back.`))
                return;
              void run(async () => {
                await leave({ variables: { farmId: farm.id, userId: me.userId } });
                navigate('/farms');
              });
            }}
          >
            Leave this farm
          </button>
        </>
      )}
    </section>
  );
}
