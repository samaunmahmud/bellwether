import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoveGroupForm } from '../src/components/MoveGroupForm';

const fields = [
  { id: 'f1', name: 'Top field' },
  { id: 'f2', name: 'Lower field' },
  { id: 'f3', name: 'Fell' },
];

describe('MoveGroupForm (FR-2.4)', () => {
  it('only offers fields the group is not already in', () => {
    render(
      <MoveGroupForm groupName="Ewes" fields={fields} currentFieldId="f1" onSubmit={vi.fn()} />,
    );
    const options = within(screen.getByLabelText('Move Ewes to'))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual(['Lower field', 'Fell']);
  });

  it('submits the field and date', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <MoveGroupForm groupName="Ewes" fields={fields} currentFieldId="f1" onSubmit={onSubmit} />,
    );

    await userEvent.selectOptions(screen.getByLabelText('Move Ewes to'), 'f3');
    fireEvent.change(screen.getByLabelText('Moved on'), { target: { value: '2026-06-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Move' }));

    expect(onSubmit).toHaveBeenCalledWith({ toFieldId: 'f3', movedOn: '2026-06-01' });
  });

  it('says so when there is nowhere else to move', () => {
    render(
      <MoveGroupForm
        groupName="Ewes"
        fields={[fields[0]!]}
        currentFieldId="f1"
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText(/add another field/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Move' })).not.toBeInTheDocument();
  });
});
