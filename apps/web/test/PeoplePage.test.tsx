import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  INVITE_MEMBER,
  PEOPLE_QUERY,
  REMOVE_MEMBER,
  SET_MEMBER_ROLE,
} from '../src/graphql/members';
import { initials, PeoplePage } from '../src/pages/PeoplePage';
import { routerFuture } from '../src/routerFuture';

const member = (userId: string, email: string, role: string, isMe = false) => ({
  __typename: 'FarmMember',
  userId,
  email,
  role,
  isMe,
});

const people = (myRole: string) => ({
  request: { query: PEOPLE_QUERY, variables: { id: 'farm1' } },
  result: {
    data: {
      farm: {
        __typename: 'Farm',
        id: 'farm1',
        name: 'Hill Farm',
        myRole,
        members: [
          member('u1', 'ann@example.com', 'OWNER', myRole === 'OWNER'),
          member('u2', 'bob@example.com', 'WORKER', myRole !== 'OWNER'),
        ],
        invites: [
          { __typename: 'FarmInvite', id: 'i1', email: 'carl@example.com', role: 'VIEWER' },
        ],
      },
    },
  },
});

function renderWith(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={['/farms/farm1/people']} future={routerFuture}>
        <Routes>
          <Route path="/farms/:id/people" element={<PeoplePage />} />
          <Route path="/farms" element={<p>All farms</p>} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('PeoplePage (FR-8.2)', () => {
  it('shows members with their roles in words, and pending invites', async () => {
    renderWith([people('OWNER')]);
    const list = await screen.findByRole('list', { name: 'Members' });
    expect(within(list).getByText('ann@example.com (you)')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Invitations sent' })).toHaveTextContent(
      'carl@example.com · Viewer',
    );
  });

  it('lets an owner invite someone', async () => {
    const invited = vi.fn(() => ({
      data: {
        inviteMember: {
          __typename: 'FarmInvite',
          id: 'i2',
          email: 'dan@example.com',
          role: 'WORKER',
        },
      },
    }));
    renderWith([
      people('OWNER'),
      {
        request: {
          query: INVITE_MEMBER,
          variables: { farmId: 'farm1', email: 'dan@example.com', role: 'WORKER' },
        },
        result: invited,
      },
      people('OWNER'),
    ]);
    const form = await screen.findByRole('form', { name: 'Invite someone' });
    await userEvent.type(within(form).getByLabelText('Email'), 'dan@example.com');
    await userEvent.click(within(form).getByRole('button', { name: 'Send invitation' }));
    await vi.waitFor(() => expect(invited).toHaveBeenCalled());
  });

  it("lets an owner change someone's role and remove them", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const changed = vi.fn(() => ({ data: { setMemberRole: true } }));
    const removed = vi.fn(() => ({ data: { removeMember: true } }));
    renderWith([
      people('OWNER'),
      {
        request: {
          query: SET_MEMBER_ROLE,
          variables: { farmId: 'farm1', userId: 'u2', role: 'VIEWER' },
        },
        result: changed,
      },
      people('OWNER'),
      {
        request: { query: REMOVE_MEMBER, variables: { farmId: 'farm1', userId: 'u2' } },
        result: removed,
      },
      people('OWNER'),
    ]);
    await userEvent.selectOptions(
      await screen.findByLabelText('Role for bob@example.com'),
      'VIEWER',
    );
    await vi.waitFor(() => expect(changed).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Remove bob@example.com' }));
    await vi.waitFor(() => expect(removed).toHaveBeenCalled());
  });

  it('lets a worker see the team and leave, but not manage it', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWith([
      people('WORKER'),
      {
        request: { query: REMOVE_MEMBER, variables: { farmId: 'farm1', userId: 'u2' } },
        result: { data: { removeMember: true } },
      },
    ]);
    await screen.findByRole('list', { name: 'Members' });
    expect(screen.queryByRole('form', { name: 'Invite someone' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Role for/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Leave this farm' }));
    expect(await screen.findByText('All farms')).toBeInTheDocument();
  });
});

describe('initials', () => {
  it.each([
    ['jo.vet@example.com', 'JV'],
    ['alex@example.com', 'AL'],
    ['demo-1a2b@example.com', 'D1'],
  ])('%s → %s', (email, expected) => {
    expect(initials(email)).toBe(expected);
  });
});
