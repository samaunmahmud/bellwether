import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldForm } from '../src/components/FieldForm';

describe('FieldForm (FR-2.2)', () => {
  it('uses the farm postcode by default', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<FieldForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Field name'), 'Top field');
    await userEvent.click(screen.getByRole('button', { name: 'Add field' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Top field',
      postcode: null,
      latitude: null,
      longitude: null,
    });
  });

  it('sends its own postcode', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<FieldForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Field name'), 'Meadow');
    await userEvent.click(screen.getByLabelText('Its own postcode'));
    await userEvent.type(screen.getByLabelText('Postcode'), 'SW1A 1AA');
    await userEvent.click(screen.getByRole('button', { name: 'Add field' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Meadow',
      postcode: 'SW1A 1AA',
      latitude: null,
      longitude: null,
    });
  });

  it('sends a map pin as numbers', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<FieldForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Field name'), 'Fell');
    await userEvent.click(screen.getByLabelText('A map pin'));
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '54.1234' } });
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '-2.5432' } });
    await userEvent.click(screen.getByRole('button', { name: 'Add field' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Fell',
      postcode: null,
      latitude: 54.1234,
      longitude: -2.5432,
    });
  });

  it('needs both coordinates for a pin', async () => {
    const onSubmit = vi.fn();
    render(<FieldForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Field name'), 'Fell');
    await userEvent.click(screen.getByLabelText('A map pin'));
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '54.1' } });
    await userEvent.click(screen.getByRole('button', { name: 'Add field' }));

    expect(screen.getByRole('alert')).toHaveTextContent('both latitude and longitude');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('edits a field, starting from its location', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <FieldForm
        initial={{ name: 'Fell', postcode: null, latitude: 54.1, longitude: -2.5 }}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Latitude')).toHaveValue(54.1);
    await userEvent.click(screen.getByLabelText('The farm postcode'));
    await userEvent.click(screen.getByRole('button', { name: 'Save field' }));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Fell',
      postcode: null,
      latitude: null,
      longitude: null,
    });
  });
});
