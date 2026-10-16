import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TreatmentForm } from '../src/components/TreatmentForm';

async function fillRequired() {
  fireEvent.change(screen.getByLabelText('Date given'), { target: { value: '2026-06-01' } });
  await userEvent.type(screen.getByLabelText('Product name'), 'Product from label');
  fireEvent.change(screen.getByLabelText('Animals treated'), { target: { value: '12' } });
  await userEvent.type(screen.getByLabelText('Administered by'), 'Ann');
  fireEvent.change(screen.getByLabelText('Meat withdrawal (days)'), { target: { value: '28' } });
}

describe('TreatmentForm (FR-6.1, FR-6.3)', () => {
  it('tells the farmer where withdrawal periods must come from (FR-6.3)', () => {
    render(<TreatmentForm headCount={80} onSubmit={vi.fn()} />);
    expect(
      screen.getByText('Withdrawal periods must come from the product label or your vet.'),
    ).toBeInTheDocument();
  });

  it('submits numbers as numbers and blanks as null', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TreatmentForm headCount={80} onSubmit={onSubmit} />);
    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Record treatment' }));

    expect(onSubmit).toHaveBeenCalledWith({
      date: '2026-06-01',
      productName: 'Product from label',
      batchNumber: null,
      quantityUsed: null,
      animalsTreated: 12,
      administeredBy: 'Ann',
      reason: null,
      meatWithdrawalDays: 28,
      milkWithdrawalDays: null,
    });
  });

  it('sends a milk withdrawal when one is entered', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TreatmentForm headCount={80} onSubmit={onSubmit} />);
    await fillRequired();
    fireEvent.change(screen.getByLabelText('Milk withdrawal (days)'), { target: { value: '3' } });
    await userEvent.click(screen.getByRole('button', { name: 'Record treatment' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ milkWithdrawalDays: 3 }));
  });

  it('stops more animals than the group has', async () => {
    const onSubmit = vi.fn();
    render(<TreatmentForm headCount={10} onSubmit={onSubmit} />);
    await fillRequired(); // 12 animals
    await userEvent.click(screen.getByRole('button', { name: 'Record treatment' }));
    expect(screen.getByRole('alert')).toHaveTextContent('1 to 10');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('never suggests a product or a withdrawal period', () => {
    render(<TreatmentForm headCount={80} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Product name')).toHaveValue('');
    expect(screen.getByLabelText('Meat withdrawal (days)')).toHaveValue(null);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
