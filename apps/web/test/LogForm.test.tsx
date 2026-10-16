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

  it('edits an existing entry: starts from its values and can clear the next due date', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(
      <LogForm
        initial={{
          date: '2026-05-01',
          type: 'Vet visit',
          note: 'Booster',
          nextDueDate: '2027-05-01',
        }}
        submitLabel="Save changes"
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByLabelText('Type')).toHaveValue('Vet visit');
    expect(screen.getByLabelText('Note')).toHaveValue('Booster');
    fireEvent.change(screen.getByLabelText('Next due'), { target: { value: '' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSubmit).toHaveBeenCalledWith({
      date: '2026-05-01',
      type: 'Vet visit',
      note: 'Booster',
      nextDueDate: null,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('keeps a typed-in type that is not in the list', () => {
    render(
      <LogForm
        initial={{ date: '2026-05-01', type: 'Groomed', note: null, nextDueDate: null }}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Type')).toHaveValue('Groomed');
  });
});
