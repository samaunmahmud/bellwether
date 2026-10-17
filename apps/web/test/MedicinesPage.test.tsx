import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../src/components/Toasts';
import { ADD_MEDICINE, MEDICINES_QUERY } from '../src/graphql/v3';
import { MedicinesPage, relativeDays } from '../src/pages/MedicinesPage';
import { routerFuture } from '../src/routerFuture';

const item = (id: string, productName: string, status: string, extra = {}) => ({
  __typename: 'MedicineItem',
  id,
  productName,
  batchNumber: null,
  quantity: null,
  expiryDate: '2026-07-01',
  supplier: null,
  purchasedOn: null,
  meatWithdrawalDays: 28,
  milkWithdrawalDays: null,
  note: null,
  finishedOn: null,
  status,
  ...extra,
});

const mock = (medicines: unknown[]): MockedResponse => ({
  request: { query: MEDICINES_QUERY, variables: { farmId: 'f1' } },
  result: {
    data: {
      farm: { __typename: 'Farm', id: 'f1', name: 'Hill Farm', myRole: 'OWNER' },
      medicines,
    },
  },
});

function renderWith(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/farms/f1/medicines']} future={routerFuture}>
          <Routes>
            <Route path="/farms/:id/medicines" element={<MedicinesPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </MockedProvider>,
  );
}

describe('MedicinesPage (v3)', () => {
  it('counts days in words', () => {
    expect(relativeDays('2026-06-11', '2026-06-01')).toBe('in 10 days');
    expect(relativeDays('2026-06-01', '2026-06-01')).toBe('today');
    expect(relativeDays('2026-05-31', '2026-06-01')).toBe('1 day ago');
  });

  it('labels out-of-date and expiring stock in words, and hides finished items', async () => {
    renderWith([
      mock([
        item('m1', 'Old wormer', 'EXPIRED'),
        item('m2', 'Pour-on', 'EXPIRING'),
        item('m3', 'Used up', 'FINISHED', { finishedOn: '2026-05-01' }),
      ]),
    ]);
    expect(
      await screen.findByText('2 in stock · 1 out of date · 1 expiring within 30 days'),
    ).toBeInTheDocument();
    const old = screen.getByRole('heading', { name: 'Old wormer' }).closest('li')!;
    expect(within(old).getByText('Out of date')).toBeInTheDocument();
    expect(within(old).getByText('Meat 28 days')).toBeInTheDocument();
    expect(screen.queryByText('Used up')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Show finished (1)'));
    expect(screen.getByText('Used up')).toBeInTheDocument();
  });

  it('adds a product typed from the label', async () => {
    const added = vi.fn(() => ({
      data: { addMedicine: { __typename: 'MedicineItem', id: 'm9' } },
    }));
    renderWith([
      mock([]),
      {
        request: { query: ADD_MEDICINE },
        // The purchase date is today, so match everything else exactly.
        variableMatcher: (v: Record<string, unknown>) => {
          const { purchasedOn, ...input } = v.input as Record<string, unknown>;
          return (
            v.farmId === 'f1' &&
            typeof purchasedOn === 'string' &&
            JSON.stringify(input) ===
              JSON.stringify({
                productName: 'Label product',
                batchNumber: 'B7',
                quantity: null,
                expiryDate: '2027-01-31',
                supplier: null,
                meatWithdrawalDays: 14,
                milkWithdrawalDays: null,
              })
          );
        },
        result: added,
      },
      mock([]),
    ]);
    await userEvent.click(await screen.findByRole('button', { name: 'Add a medicine' }));
    await userEvent.type(screen.getByLabelText('Product name (from the label)'), 'Label product');
    await userEvent.type(screen.getByLabelText('Batch number'), 'B7');
    await userEvent.type(screen.getByLabelText('Expiry date'), '2027-01-31');
    await userEvent.type(screen.getByLabelText('Meat withdrawal (days, from label)'), '14');
    await userEvent.click(screen.getByRole('button', { name: 'Add to cabinet' }));
    await vi.waitFor(() => expect(added).toHaveBeenCalled());
  });
});
