import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TREATMENTS_QUERY } from '../src/graphql/records';
import { RecordsPage } from '../src/pages/RecordsPage';
import { routerFuture } from '../src/routerFuture';

const row = {
  __typename: 'Treatment',
  id: 't1',
  date: '2026-06-01',
  productName: 'Product from label',
  batchNumber: 'B123',
  quantityUsed: '400 ml',
  animalsTreated: 12,
  administeredBy: 'Ann',
  reason: null,
  meatWithdrawalDays: 28,
  milkWithdrawalDays: null,
  meatWithdrawalEnds: '2026-06-29',
  milkWithdrawalEnds: null,
  group: { __typename: 'LivestockGroup', id: 'g1', name: 'Dairy herd' },
};

const variables = { farmId: 'farm1', from: '2026-06-01', to: '2026-06-30' };

function renderWith(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter
        initialEntries={['/farms/farm1/records?from=2026-06-01&to=2026-06-30']}
        future={routerFuture}
      >
        <Routes>
          <Route path="/farms/:id/records" element={<RecordsPage />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('RecordsPage (FR-6.4)', () => {
  it('shows the treatments for the chosen dates in a printable table', async () => {
    renderWith([
      { request: { query: TREATMENTS_QUERY, variables }, result: { data: { treatments: [row] } } },
    ]);
    const table = await screen.findByRole('table', { name: 'Treatment records' });
    const cells = within(table).getAllByRole('row')[1]!;
    expect(cells).toHaveTextContent('Dairy herd');
    expect(cells).toHaveTextContent('Product from label');
    expect(cells).toHaveTextContent('2026-06-29');
  });

  it('offers a CSV download of exactly those records', async () => {
    renderWith([
      { request: { query: TREATMENTS_QUERY, variables }, result: { data: { treatments: [row] } } },
    ]);
    const link = await screen.findByRole('link', { name: 'Download CSV' });
    expect(link).toHaveAttribute('download', 'treatments-2026-06-01-to-2026-06-30.csv');
    const csv = decodeURIComponent(
      link.getAttribute('href')!.replace('data:text/csv;charset=utf-8,', ''),
    );
    expect(csv).toContain('2026-06-01,Dairy herd,Product from label,B123');
  });

  it('prints the page', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderWith([
      { request: { query: TREATMENTS_QUERY, variables }, result: { data: { treatments: [row] } } },
    ]);
    await userEvent.click(await screen.findByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalled();
  });

  it('says when there are no records in the range', async () => {
    renderWith([
      { request: { query: TREATMENTS_QUERY, variables }, result: { data: { treatments: [] } } },
    ]);
    expect(await screen.findByText(/no treatments recorded/i)).toBeInTheDocument();
  });
});
