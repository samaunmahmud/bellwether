import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogForm } from '../src/components/LogForm';

describe('LogForm', () => {
  it('submits the entered values, with blanks sent as null', async () => {
    const onSubmit = vi.fn();
    render(<LogForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-06-01' } });
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'Treatment given');
    fireEvent.change(screen.getByLabelText('Next due'), { target: { value: '2026-07-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Add entry' }));

    expect(onSubmit).toHaveBeenCalledWith({
      date: '2026-06-01',
      type: 'Treatment given',
      note: null,
      nextDueDate: '2026-07-01',
    });
  });

  it('rejects a next due date before the log date', async () => {
    const onSubmit = vi.fn();
    render(<LogForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-06-10' } });
    fireEvent.change(screen.getByLabelText('Next due'), { target: { value: '2026-06-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Add entry' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/on or after/);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
