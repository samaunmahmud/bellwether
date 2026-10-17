import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../src/components/Toasts';
import { REGISTER_QUERY, VOID_REGISTER_EVENT } from '../src/graphql/v3';
import { eventDetails, RegisterPage } from '../src/pages/RegisterPage';
import { routerFuture } from '../src/routerFuture';
import type { RegisterEvent } from '../src/types';

const event = (id: string, extra: Partial<RegisterEvent>) => ({
  __typename: 'RegisterEvent',
  id,
  kind: 'DEATH',
  date: '2026-05-01',
  count: 1,
  bornDead: null,
  value: null,
  otherParty: null,
  reference: null,
  cause: null,
  note: null,
  recordedBy: 'ann@example.com',
  voided: false,
  voidReason: null,
  group: { __typename: 'LivestockGroup', id: 'g1', name: 'Ewes' },
  ...extra,
});

const death = event('e1', { cause: 'Found dead', reference: 'FS-1' });
const weighing = event('e2', { kind: 'WEIGHING', count: 20, value: 31.5 });

const registerMock = (myRole = 'OWNER'): MockedResponse => ({
  request: { query: REGISTER_QUERY, variables: { farmId: 'f1' } },
  result: {
    data: {
      farm: {
        __typename: 'Farm',
        id: 'f1',
        name: 'Hill Farm',
        cphNumber: '12/345/6789',
        flockMark: null,
        myRole,
        groups: [{ __typename: 'LivestockGroup', id: 'g1', name: 'Ewes', headCount: 99 }],
      },
      holdingRegister: [{ __typename: 'RegisterRow', headCountAfter: 99, event: death }],
      registerEvents: [weighing, death],
    },
  },
});

function renderAt(path: string, mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]} future={routerFuture}>
          <Routes>
            <Route path="/farms/:id/register" element={<RegisterPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </MockedProvider>,
  );
}

describe('RegisterPage (v3)', () => {
  it('describes entries in words', () => {
    expect(eventDetails(death as RegisterEvent)).toBe('1 · Found dead · Ref FS-1');
    expect(eventDetails(weighing as RegisterEvent)).toBe('20 weighed, average 31.5 kg');
  });

  it('shows the holding details, head counts and the register with running totals', async () => {
    renderAt('/farms/f1/register', [registerMock()]);
    expect(await screen.findByText(/CPH 12\/345\/6789/)).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /Ewes Death or loss/ });
    expect(within(row).getByRole('cell', { name: '99' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Weights, egg counts/ }));
    expect(screen.getByText('20 weighed, average 31.5 kg')).toBeInTheDocument();
  });

  it('opens the record form from the address, e.g. from a dashboard quick action', async () => {
    renderAt('/farms/f1/register?record=WEIGHING', [registerMock()]);
    expect(await screen.findByRole('form', { name: 'Record an entry' })).toBeInTheDocument();
    expect(screen.getByLabelText('Weighing')).toBeChecked();
  });

  it('voids an entry after asking why', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Wrong group');
    const voided = vi.fn(() => ({
      data: { voidRegisterEvent: { __typename: 'RegisterEvent', id: 'e1', voided: true } },
    }));
    renderAt('/farms/f1/register', [
      registerMock(),
      {
        request: { query: VOID_REGISTER_EVENT, variables: { id: 'e1', reason: 'Wrong group' } },
        result: voided,
      },
      registerMock(),
    ]);
    await userEvent.click(await screen.findByRole('button', { name: /Void death or loss/ }));
    await vi.waitFor(() => expect(voided).toHaveBeenCalled());
  });

  it('gives viewers the register without record or void buttons', async () => {
    renderAt('/farms/f1/register', [registerMock('VIEWER')]);
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record an entry' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Void/ })).not.toBeInTheDocument();
  });
});
