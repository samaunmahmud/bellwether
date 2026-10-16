import { useMutation, useQuery } from '@apollo/client';
import { useState } from 'react';
import { errorMessage } from '../errors';
import { FARMS_QUERY } from '../graphql/farms';
import { ACCEPT_INVITE, DECLINE_INVITE, MY_INVITES_QUERY } from '../graphql/members';
import type { FarmRole } from '../types';

interface MyInvite {
  id: string;
  farmName: string;
  role: FarmRole;
  invitedBy: string | null;
}

const ROLE_WORDS: Record<FarmRole, string> = {
  OWNER: 'an owner',
  WORKER: 'a worker',
  VIEWER: 'a viewer',
};

/** FR-8.2: invitations for the signed-in user's email. Shows nothing when there are none. */
export function Invitations() {
  const { data } = useQuery<{ myInvites: MyInvite[] }>(MY_INVITES_QUERY);
  const refetch = { refetchQueries: [{ query: FARMS_QUERY }, { query: MY_INVITES_QUERY }] };
  const [accept] = useMutation(ACCEPT_INVITE, refetch);
  const [decline] = useMutation(DECLINE_INVITE, refetch);
  const [error, setError] = useState<string | null>(null);

  const invites = data?.myInvites ?? [];
  if (invites.length === 0) return null;

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <section className="card" aria-labelledby="invites-heading">
      <h2 id="invites-heading">Invitations</h2>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <ul className="list">
        {invites.map((invite) => (
          <li key={invite.id} className="row">
            <span>
              {invite.invitedBy ?? 'Someone'} invited you to {invite.farmName} as{' '}
              {ROLE_WORDS[invite.role]}.
            </span>
            <span className="actions">
              <button
                type="button"
                aria-label={`Accept invitation to ${invite.farmName}`}
                onClick={() => run(() => accept({ variables: { id: invite.id } }))}
              >
                Accept
              </button>
              <button
                type="button"
                className="secondary"
                aria-label={`Decline invitation to ${invite.farmName}`}
                onClick={() => run(() => decline({ variables: { id: invite.id } }))}
              >
                Decline
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
