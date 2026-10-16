import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ObservationForm } from '../src/components/ObservationForm';

describe('ObservationForm (FR-6.6)', () => {
  it('records a check with an optional note', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ObservationForm species="SHEEP" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-06-10' } });
    await userEvent.selectOptions(screen.getByLabelText('Check'), 'Flock inspected');
    await userEvent.type(screen.getByLabelText('What you found'), '2 struck ewes found');
    await userEvent.click(screen.getByRole('button', { name: 'Record check' }));

    expect(onSubmit).toHaveBeenCalledWith({
      date: '2026-06-10',
      type: 'Flock inspected',
      note: '2 struck ewes found',
    });
  });

  it('offers checks that suit the species', () => {
    const { unmount } = render(<ObservationForm species="CATTLE" onSubmit={vi.fn()} />);
    expect(screen.getByRole('option', { name: 'Herd inspected' })).toBeInTheDocument();
    unmount();
    render(<ObservationForm species="SHEEP" onSubmit={vi.fn()} />);
    expect(screen.getByRole('option', { name: 'Flock inspected' })).toBeInTheDocument();
  });
});
