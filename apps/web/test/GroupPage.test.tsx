import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GROUP_QUERY, RECORD_TREATMENT } from '../src/graphql/records';
import { GroupPage } from '../src/pages/GroupPage';
import { routerFuture } from '../src/routerFuture';

const treatment = {
  __typename: 'Treatment',
  id: 't1',
  date: '2026-06-01',
  productName: 'Product from label',
  batchNumber: 'B123',
  quantityUsed: '400 ml',
  animalsTreated: 12,
  administeredBy: 'Ann',
  reason: 'Lameness',
  meatWithdrawalDays: 28,
  milkWithdrawalDays: 3,
  meatWithdrawalEnds: '2026-06-29',
  milkWithdrawalEnds: '2026-06-04',
  group: { __typename: 'LivestockGroup', id: 'g1', name: 'Dairy herd' },
};

const group = (withdrawal: {
  inWithdrawal: boolean;
  meatEnds: string | null;
  milkEnds: string | null;
}) => ({
  __typename: 'LivestockGroup',
  id: 'g1',
  name: 'Dairy herd',
  species: 'CATTLE',
  livestockClass: 'DAIRY_COWS',
  headCount: 80,
  farm: { __typename: 'Farm', id: 'farm1', name: 'Hill Farm' },
  withdrawal: { __typename: 'WithdrawalStatus', ...withdrawal },
  treatments: [treatment],
  observations: [
    {
      __typename: 'Observation',
      id: 'o1',
      date: '2026-06-10',
      type: 'Herd check',
      note: '2 lame cows',
    },
  ],
});

const groupMock = (data: unknown): MockedResponse => ({
  request: { query: GROUP_QUERY, variables: { id: 'g1' } },
  result: { data: { livestockGroup: data } },
});

function renderWith(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={['/groups/g1']} future={routerFuture}>
        <Routes>
          <Route path="/groups/:id" element={<GroupPage />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('GroupPage', () => {
  it('flags the group "In withdrawal" in words, with end dates (FR-6.2)', async () => {
    renderWith([groupMock(group({ inWithdrawal: true, meatEnds: '2026-06-29', milkEnds: null }))]);
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('In withdrawal');
    expect(status).toHaveTextContent('Meat: ends Mon 29 Jun');
  });

  it('says when the group is clear', async () => {
    renderWith([groupMock(group({ inWithdrawal: false, meatEnds: null, milkEnds: null }))]);
    expect(await screen.findByRole('status')).toHaveTextContent('Not in withdrawal');
  });

  it('lists treatments and checks, newest first (FR-6.1, FR-6.6)', async () => {
    renderWith([groupMock(group({ inWithdrawal: false, meatEnds: null, milkEnds: null }))]);
    const treatments = await screen.findByRole('list', { name: 'Treatments' });
    expect(within(treatments).getByText(/Product from label/)).toBeInTheDocument();
    expect(within(treatments).getByText(/12 animals · given by Ann/)).toBeInTheDocument();
    const checks = screen.getByRole('list', { name: 'Checks' });
    expect(within(checks).getByText(/Herd check/)).toBeInTheDocument();
    expect(within(checks).getByText(/2 lame cows/)).toBeInTheDocument();
  });

  it('records a treatment for this group', async () => {
    const input = {
      groupId: 'g1',
      date: '2026-06-01',
      productName: 'Product from label',
      batchNumber: null,
      quantityUsed: null,
      animalsTreated: 5,
      administeredBy: 'Ann',
      reason: null,
      meatWithdrawalDays: 7,
      milkWithdrawalDays: null,
    };
    const recorded = vi.fn(() => ({
      data: { recordTreatment: { __typename: 'Treatment', id: 't2' } },
    }));
    const empty = group({ inWithdrawal: false, meatEnds: null, milkEnds: null });
    renderWith([
      groupMock(empty),
      { request: { query: RECORD_TREATMENT, variables: { input } }, result: recorded },
      groupMock(empty),
    ]);

    await screen.findByRole('status');
    fireEvent.change(screen.getByLabelText('Date given'), { target: { value: '2026-06-01' } });
    await userEvent.type(screen.getByLabelText('Product name'), 'Product from label');
    fireEvent.change(screen.getByLabelText('Animals treated'), { target: { value: '5' } });
    await userEvent.type(screen.getByLabelText('Administered by'), 'Ann');
    fireEvent.change(screen.getByLabelText('Meat withdrawal (days)'), { target: { value: '7' } });
    await userEvent.click(screen.getByRole('button', { name: 'Record treatment' }));

    await vi.waitFor(() => expect(recorded).toHaveBeenCalled());
  });

  it('says when the group doesn’t exist or isn’t yours', async () => {
    renderWith([groupMock(null)]);
    expect(await screen.findByText('Group not found')).toBeInTheDocument();
  });
});
