import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DELETE_ANIMAL, PET_QUERY, UPDATE_LOG_ENTRY } from '../src/graphql/queries';
import { PetPage } from '../src/pages/PetPage';
import { routerFuture } from '../src/routerFuture';
import { petForecast, withTypenames } from './fixtures';

const log = (id: string, extra: Record<string, unknown>) => ({
  __typename: 'LogEntry',
  id,
  date: '2026-05-01',
  type: 'Tick check',
  note: null,
  nextDueDate: null,
  ...extra,
});

const pet = (forecast: unknown) => ({
  __typename: 'Animal',
  id: 'p1',
  name: 'Bella',
  species: 'dog',
  category: 'PET',
  postcode: forecast ? 'UB8 3PH' : null,
  highExposureHabitat: true,
  forecast,
  logs: [
    log('l1', { type: 'Treatment given', nextDueDate: '2000-01-01' }),
    log('l2', { type: 'Vet visit', note: 'Booster', nextDueDate: '2999-01-01' }),
  ],
});

const petMock = (data: unknown): MockedResponse => ({
  request: { query: PET_QUERY, variables: { id: 'p1' } },
  result: { data: { animal: data } },
});

function renderWith(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={['/pets/p1']} future={routerFuture}>
        <Routes>
          <Route path="/pets/:id" element={<PetPage />} />
          <Route path="/animals" element={<p>Pets list</p>} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('PetPage', () => {
  it("shows the pet's own forecast with the disclaimer", async () => {
    renderWith([petMock(pet(withTypenames(petForecast)))]);
    expect(await screen.findByRole('heading', { name: 'Bella' })).toBeInTheDocument();
    expect(screen.getByText('Tick activity')).toBeInTheDocument();
    expect(screen.getByText(/not veterinary advice/i)).toBeInTheDocument();
    expect(screen.getByText(/walks in long grass or woodland/i)).toBeInTheDocument();
  });

  it('asks for a postcode when there is none', async () => {
    renderWith([petMock(pet(null))]);
    expect(await screen.findByText(/Add a home postcode/)).toBeInTheDocument();
  });

  it('highlights overdue entries in words', async () => {
    renderWith([petMock(pet(null))]);
    const overdue = await screen.findByText(/Overdue: /);
    expect(overdue.closest('li')).toHaveTextContent('Treatment given');
    expect(screen.getByText(/Next due: /).closest('li')).toHaveTextContent('Vet visit');
  });

  it('edits a log entry in place', async () => {
    const update: MockedResponse = {
      request: {
        query: UPDATE_LOG_ENTRY,
        variables: {
          id: 'l2',
          input: { date: '2026-05-01', type: 'Vet visit', note: 'Booster', nextDueDate: null },
        },
      },
      result: { data: { updateLogEntry: log('l2', { type: 'Vet visit', note: 'Booster' }) } },
    };
    renderWith([petMock(pet(null)), update, petMock(pet(null))]);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Vet visit entry' }));
    const form = screen.getByRole('form', { name: 'Edit log entry' });
    await userEvent.clear(within(form).getByLabelText('Next due'));
    await userEvent.click(within(form).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('button', { name: /Edit Vet visit/ })).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Edit log entry' })).not.toBeInTheDocument();
  });

  it('deletes the pet after confirming, then goes back to the list', async () => {
    const remove: MockedResponse = {
      request: { query: DELETE_ANIMAL, variables: { id: 'p1' } },
      result: { data: { deleteAnimal: true } },
    };
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWith([petMock(pet(null)), remove]);

    await userEvent.click(await screen.findByRole('button', { name: 'Delete Bella' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(await screen.findByText('Pets list')).toBeInTheDocument();
  });

  it('says when the pet is not found', async () => {
    renderWith([petMock(null)]);
    expect(await screen.findByText(/Pet not found/)).toBeInTheDocument();
  });
});
