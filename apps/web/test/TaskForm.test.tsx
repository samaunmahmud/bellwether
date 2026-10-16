import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskForm } from '../src/components/TaskForm';

const groups = [
  { id: 'g1', name: 'Ewes' },
  { id: 'g2', name: 'Dairy herd' },
];

describe('TaskForm (FR-5.3)', () => {
  it('adds a farm-wide task by default, with blanks as null', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TaskForm groups={groups} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Task'), ' Service the quad ');
    fireEvent.change(screen.getByLabelText('Due'), { target: { value: '2026-06-20' } });
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Service the quad',
      dueDate: '2026-06-20',
      groupId: null,
      note: null,
      repeatEveryDays: null,
    });
  });

  it('sets a group and a weekly repeat', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TaskForm groups={groups} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Task'), 'Check troughs');
    fireEvent.change(screen.getByLabelText('Due'), { target: { value: '2026-06-20' } });
    await userEvent.selectOptions(screen.getByLabelText('For'), 'Ewes');
    await userEvent.selectOptions(screen.getByLabelText('Repeat'), 'Every week');
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'g1', repeatEveryDays: 7 }),
    );
  });

  it('takes a custom number of days', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TaskForm groups={groups} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Task'), 'Weigh lambs');
    fireEvent.change(screen.getByLabelText('Due'), { target: { value: '2026-06-20' } });
    await userEvent.selectOptions(screen.getByLabelText('Repeat'), 'Every … days');
    fireEvent.change(screen.getByLabelText('Repeat every (days)'), { target: { value: '10' } });
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ repeatEveryDays: 10 }));
  });

  it('edits a task, starting from its values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskForm
        groups={groups}
        initial={{
          title: 'Check troughs',
          dueDate: '2026-06-20',
          groupId: 'g2',
          note: null,
          repeatEveryDays: 14,
        }}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('For')).toHaveValue('g2');
    expect(screen.getByLabelText('Repeat')).toHaveValue('14');
    await userEvent.click(screen.getByRole('button', { name: 'Save task' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ groupId: 'g2' }));
  });

  it('shows a server error', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Task title must be 1 to 200 characters'));
    render(<TaskForm groups={groups} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Task'), 'X');
    fireEvent.change(screen.getByLabelText('Due'), { target: { value: '2026-06-20' } });
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('1 to 200');
  });
});
