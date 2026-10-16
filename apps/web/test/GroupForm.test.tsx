import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GroupForm } from '../src/components/GroupForm';

const fields = [
  { id: 'f1', name: 'Top field' },
  { id: 'f2', name: 'Lower field' },
];

const optionsOf = (label: string) =>
  within(screen.getByLabelText(label))
    .getAllByRole('option')
    .map((o) => o.textContent);

describe('GroupForm (FR-2.3, FR-2.5)', () => {
  it('offers the classes for the chosen species', async () => {
    render(<GroupForm fields={fields} onSubmit={vi.fn()} />);
    expect(optionsOf('Class')).toEqual(['Ewes', 'Lambs', 'Rams']);

    await userEvent.selectOptions(screen.getByLabelText('Species'), 'CATTLE');
    expect(optionsOf('Class')).toEqual(['Dairy cows', 'Beef cattle', 'Calves']);
  });

  it('shows sheep details for sheep and cattle details for cattle', async () => {
    render(<GroupForm fields={fields} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Last shearing')).toBeInTheDocument();
    expect(screen.queryByLabelText('Calving starts')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Species'), 'CATTLE');
    expect(screen.queryByLabelText('Last shearing')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Calving starts')).toBeInTheDocument();
  });

  it('asks dairy or beef only for calves (A6)', async () => {
    render(<GroupForm fields={fields} onSubmit={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText('Species'), 'CATTLE');
    expect(screen.queryByLabelText('Dairy or beef')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Class'), 'CALVES');
    expect(screen.getByLabelText('Dairy or beef')).toBeInTheDocument();
  });

  it('submits a sheep group with blanks sent as null', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<GroupForm fields={fields} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Group name'), 'North flock');
    fireEvent.change(screen.getByLabelText('Head count'), { target: { value: '120' } });
    await userEvent.selectOptions(screen.getByLabelText('Field'), 'f2');
    fireEvent.change(screen.getByLabelText('Lambing starts'), { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByLabelText('Lambing ends'), { target: { value: '2026-04-15' } });
    await userEvent.click(screen.getByLabelText('Lambs at grass this spring'));
    await userEvent.click(screen.getByRole('button', { name: 'Add group' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'North flock',
      species: 'SHEEP',
      livestockClass: 'EWES',
      headCount: 120,
      currentFieldId: 'f2',
      housed: false,
      lastShearingDate: null,
      lambingStart: '2026-03-01',
      lambingEnd: '2026-04-15',
      lambsAtGrassThisSpring: true,
    });
  });

  it('submits a housed cattle group with no field', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<GroupForm fields={fields} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Group name'), 'Dairy herd');
    await userEvent.selectOptions(screen.getByLabelText('Species'), 'CATTLE');
    fireEvent.change(screen.getByLabelText('Head count'), { target: { value: '80' } });
    await userEvent.click(screen.getByLabelText('Housed'));
    await userEvent.click(screen.getByRole('button', { name: 'Add group' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Dairy herd',
      species: 'CATTLE',
      livestockClass: 'DAIRY_COWS',
      headCount: 80,
      currentFieldId: null,
      housed: true,
      cattleType: null,
      calvingStart: null,
      calvingEnd: null,
    });
  });

  it('needs both lambing dates, end on or after start', async () => {
    const onSubmit = vi.fn();
    render(<GroupForm fields={fields} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Group name'), 'Flock');
    fireEvent.change(screen.getByLabelText('Head count'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Lambing starts'), { target: { value: '2026-03-02' } });
    fireEvent.change(screen.getByLabelText('Lambing ends'), { target: { value: '2026-03-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Add group' }));

    expect(screen.getByRole('alert')).toHaveTextContent('on or after');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
