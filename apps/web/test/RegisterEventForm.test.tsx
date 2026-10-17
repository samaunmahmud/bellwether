import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterEventForm } from '../src/components/RegisterEventForm';

const groups = [
  { id: 'g1', name: 'Ewes', headCount: 100 },
  { id: 'g2', name: 'Lambs', headCount: 40 },
];

describe('RegisterEventForm (v3)', () => {
  it('records a death with its cause, sending only the fields a death has', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RegisterEventForm groups={groups} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-06-01' } });
    await userEvent.type(screen.getByLabelText('Animals'), '2');
    await userEvent.type(screen.getByLabelText('Cause, if known'), 'Found dead');
    await userEvent.click(screen.getByRole('button', { name: 'Save death or loss' }));
    expect(onSubmit).toHaveBeenCalledWith({
      groupId: 'g1',
      kind: 'DEATH',
      date: '2026-06-01',
      count: 2,
      bornDead: null,
      value: null,
      otherParty: null,
      reference: null,
      cause: 'Found dead',
      note: null,
    });
    expect(screen.getByLabelText('Animals')).toHaveValue(null);
  });

  it('changes its fields with the kind of entry', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RegisterEventForm groups={groups} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByLabelText('Weighing'));
    expect(screen.queryByLabelText('Cause, if known')).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Group'), 'g2');
    await userEvent.type(screen.getByLabelText('Animals weighed'), '20');
    await userEvent.type(screen.getByLabelText('Average weight (kg)'), '31.5');
    await userEvent.click(screen.getByRole('button', { name: 'Save weighing' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'g2', kind: 'WEIGHING', count: 20, value: 31.5 }),
    );
  });

  it('asks where animals moved off to, and shows server errors', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("That's more than the 100 in Ewes."));
    render(<RegisterEventForm groups={groups} initialKind="MOVE_OFF" onSubmit={onSubmit} />);
    expect(screen.getByLabelText('Went to (holding, market or abattoir)')).toBeRequired();
    await userEvent.type(screen.getByLabelText('Animals'), '5');
    await userEvent.type(screen.getByLabelText('Went to (holding, market or abattoir)'), 'Market');
    await userEvent.click(screen.getByRole('button', { name: 'Save moved off' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('more than the 100');
  });

  it('asks for a group first when there are none', () => {
    render(<RegisterEventForm groups={[]} onSubmit={vi.fn()} />);
    expect(screen.getByText(/Add a livestock group first/)).toBeInTheDocument();
  });
});
