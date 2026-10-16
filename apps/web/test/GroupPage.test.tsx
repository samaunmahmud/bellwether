import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ARCHIVE_GROUP, RESTORE_GROUP } from '../src/graphql/farms';
import { GROUP_QUERY, RECORD_TREATMENT, VOID_TREATMENT } from '../src/graphql/records';
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
  voided: false,
  voidReason: null,
  history: [] as unknown[],
};

const group = (
  withdrawal: {
    inWithdrawal: boolean;
    meatEnds: string | null;
    milkEnds: string | null;
  },
  extra: Record<string, unknown> = {},
) => ({
  __typename: 'LivestockGroup',
  id: 'g1',
  name: 'Dairy herd',
  species: 'CATTLE',
  livestockClass: 'DAIRY_COWS',
  headCount: 80,
  housed: true,
  currentField: null,
  lastShearingDate: null,
  lambingStart: null,
  lambingEnd: null,
  lambsAtGrassThisSpring: false,
  cattleType: 'DAIRY',
  calvingStart: null,
  calvingEnd: null,
  archivedOn: null,
  archiveReason: null,
  farm: { __typename: 'Farm', id: 'farm1', name: 'Hill Farm', myRole: 'OWNER' },
  withdrawal: { __typename: 'WithdrawalStatus', ...withdrawal },
  treatments: [treatment],
  observations: [
    {
      __typename: 'Observation',
      id: 'o1',
      date: '2026-06-10',
      type: 'Herd check',
      note: '2 lame cows',
      voided: false,
      voidReason: null,
      history: [],
    },
  ],
  ...extra,
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

  describe('corrections and voids (FR-6.5)', () => {
    const clear = { inWithdrawal: false, meatEnds: null, milkEnds: null };
    const revision = {
      __typename: 'RecordRevision',
      id: 'r1',
      action: 'EDITED',
      at: '2026-06-02T10:00:00.000Z',
      by: 'ann@example.com',
      reason: 'Typo in batch',
      changes: [{ __typename: 'FieldChange', field: 'Batch number', from: 'B12', to: 'B123' }],
    };

    it('shows a voided treatment struck through, labelled in words, with no actions', async () => {
      renderWith([
        groupMock(
          group(clear, {
            treatments: [{ ...treatment, voided: true, voidReason: 'Entered twice' }],
          }),
        ),
      ]);
      const list = await screen.findByRole('list', { name: 'Treatments' });
      expect(within(list).getByText('Voided: Entered twice')).toBeInTheDocument();
      expect(within(list).queryByRole('button', { name: /Correct/ })).not.toBeInTheDocument();
    });

    it("shows a record's history: who, when, why and what changed", async () => {
      renderWith([
        groupMock(group(clear, { treatments: [{ ...treatment, history: [revision] }] })),
      ]);
      const list = await screen.findByRole('list', { name: 'Treatments' });
      await userEvent.click(within(list).getByText('History (1)'));
      expect(within(list).getByText(/Corrected by ann@example.com/)).toBeInTheDocument();
      expect(within(list).getByText(/Typo in batch/)).toBeInTheDocument();
      expect(within(list).getByText('Batch number: B12 → B123')).toBeInTheDocument();
    });

    it('voids a treatment with a reason', async () => {
      const voided = vi.fn(() => ({
        data: { voidTreatment: { __typename: 'Treatment', id: 't1' } },
      }));
      renderWith([
        groupMock(group(clear)),
        {
          request: { query: VOID_TREATMENT, variables: { id: 't1', reason: 'Entered twice' } },
          result: voided,
        },
        groupMock(group(clear)),
      ]);
      const list = await screen.findByRole('list', { name: 'Treatments' });
      await userEvent.click(within(list).getByRole('button', { name: /^Void/ }));
      await userEvent.type(within(list).getByLabelText('Why void this record?'), 'Entered twice');
      await userEvent.click(within(list).getByRole('button', { name: 'Void record' }));
      await vi.waitFor(() => expect(voided).toHaveBeenCalled());
    });

    it('opens a correction form filled in from the record', async () => {
      renderWith([groupMock(group(clear))]);
      const list = await screen.findByRole('list', { name: 'Treatments' });
      await userEvent.click(within(list).getByRole('button', { name: /^Correct/ }));
      const form = screen.getByRole('form', { name: 'Correct treatment' });
      expect(within(form).getByLabelText('Batch number')).toHaveValue('B123');
    });
  });

  describe('editing and archiving the group', () => {
    const clear = { inWithdrawal: false, meatEnds: null, milkEnds: null };

    it("opens the group's details for editing", async () => {
      renderWith([groupMock(group(clear))]);
      await userEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
      const form = screen.getByRole('form', { name: 'Edit livestock group' });
      expect(within(form).getByLabelText('Head count')).toHaveValue(80);
    });

    it('archives the group with a date and reason', async () => {
      const archived = vi.fn(() => ({
        data: {
          archiveLivestockGroup: {
            __typename: 'LivestockGroup',
            id: 'g1',
            archivedOn: '2026-06-01',
          },
        },
      }));
      renderWith([
        groupMock(group(clear)),
        {
          request: {
            query: ARCHIVE_GROUP,
            variables: { id: 'g1', input: { archivedOn: '2026-06-01', reason: 'Sold' } },
          },
          result: archived,
        },
        groupMock(group(clear)),
      ]);
      await userEvent.click(await screen.findByRole('button', { name: 'Archive group' }));
      const form = screen.getByRole('form', { name: 'Archive group' });
      fireEvent.change(within(form).getByLabelText('Date'), { target: { value: '2026-06-01' } });
      await userEvent.type(within(form).getByLabelText('Reason'), 'Sold');
      await userEvent.click(within(form).getByRole('button', { name: 'Archive' }));
      await vi.waitFor(() => expect(archived).toHaveBeenCalled());
    });

    it('shows an archived group as archived, in words, with restore', async () => {
      const restored = vi.fn(() => ({
        data: {
          restoreLivestockGroup: { __typename: 'LivestockGroup', id: 'g1', archivedOn: null },
        },
      }));
      const archivedGroup = group(clear, { archivedOn: '2026-05-30', archiveReason: 'Sold' });
      renderWith([
        groupMock(archivedGroup),
        { request: { query: RESTORE_GROUP, variables: { id: 'g1' } }, result: restored },
        groupMock(archivedGroup),
      ]);
      expect(await screen.findByText(/Archived 30 May · Sold/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Archive group' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Restore group' }));
      await vi.waitFor(() => expect(restored).toHaveBeenCalled());
    });
  });

  describe('what each role can do (FR-8.2)', () => {
    const as = (myRole: string) =>
      group(
        { inWithdrawal: false, meatEnds: null, milkEnds: null },
        { farm: { __typename: 'Farm', id: 'farm1', name: 'Hill Farm', myRole } },
      );

    it('lets a worker record, correct and edit details, but not archive', async () => {
      renderWith([groupMock(as('WORKER'))]);
      expect(await screen.findByRole('button', { name: 'Edit details' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Archive group' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('form').length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: /^Correct / }).length).toBeGreaterThan(0);
    });

    it('shows a viewer the records with nothing to change', async () => {
      renderWith([groupMock(as('VIEWER'))]);
      const treatments = await screen.findByRole('list', { name: 'Treatments' });
      expect(within(treatments).getByText(/Product from label/)).toBeInTheDocument();
      expect(screen.queryAllByRole('button')).toHaveLength(0);
      expect(screen.queryAllByRole('form')).toHaveLength(0);
    });
  });
});
