import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PetForm } from '../src/components/PetForm';

describe('PetForm', () => {
  it('adds a pet with species, optional postcode and the long-grass setting', async () => {
    const onSubmit = vi.fn();
    render(<PetForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Name'), ' Tom ');
    await userEvent.selectOptions(screen.getByLabelText('Species'), 'cat');
    await userEvent.type(screen.getByLabelText(/Home postcode/), 'ub8 3ph');
    await userEvent.click(screen.getByLabelText('Walks in long grass or woodland'));
    await userEvent.click(screen.getByRole('button', { name: 'Add pet' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Tom',
      species: 'cat',
      postcode: 'ub8 3ph',
      highExposureHabitat: true,
    });
  });

  it('sends a blank postcode as null', async () => {
    const onSubmit = vi.fn();
    render(<PetForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Name'), 'Bella');
    await userEvent.click(screen.getByRole('button', { name: 'Add pet' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ species: 'dog', postcode: null, highExposureHabitat: false }),
    );
  });

  it('edits a pet without changing its species', async () => {
    const onSubmit = vi.fn();
    render(
      <PetForm
        initial={{ name: 'Bella', species: 'dog', postcode: 'UB8 3PH', highExposureHabitat: true }}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.queryByLabelText('Species')).not.toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(/Home postcode/));
    await userEvent.click(screen.getByRole('button', { name: 'Save pet' }));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Bella',
      species: 'dog',
      postcode: null,
      highExposureHabitat: true,
    });
  });

  it('shows an error from the server, such as an unknown postcode', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Postcode ZZ1 1ZZ was not found'));
    render(<PetForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Name'), 'Bella');
    await userEvent.click(screen.getByRole('button', { name: 'Add pet' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Postcode ZZ1 1ZZ was not found');
  });
});
