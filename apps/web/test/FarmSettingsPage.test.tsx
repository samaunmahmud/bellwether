import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  DELETE_FARM,
  FARM_SETTINGS_QUERY,
  RESTORE_GROUP,
  SET_FIELD_ARCHIVED,
  UPDATE_FARM,
} from '../src/graphql/farms';
import { FarmSettingsPage } from '../src/pages/FarmSettingsPage';
import { routerFuture } from '../src/routerFuture';

const field = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  __typename: 'Field',
  id,
  name,
  postcode: null,
  latitude: null,
  longitude: null,
  archivedOn: null,
  ...extra,
});

const settings = {
  __typename: 'Farm',
  id: 'farm1',
  name: 'Hill Farm',
  postcode: 'UB8 3PH',
  fields: [field('f1', 'Fell')],
  archivedFields: [field('f2', 'Old orchard', { archivedOn: '2026-01-10' })],
  archivedGroups: [
    {
      __typename: 'LivestockGroup',
      id: 'g9',
      name: 'Store lambs 2025',
      archivedOn: '2026-02-01',
      archiveReason: 'Sold at market',
    },
  ],
};

const settingsMock: MockedResponse = {
  request: { query: FARM_SETTINGS_QUERY, variables: { id: 'farm1' } },
  result: { data: { farm: settings } },
};

function renderWith(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={['/farms/farm1/settings']} future={routerFuture}>
        <Routes>
          <Route path="/farms/:id/settings" element={<FarmSettingsPage />} />
          <Route path="/farms" element={<p>All farms</p>} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('FarmSettingsPage', () => {
  it('saves new farm details', async () => {
    const saved = vi.fn(() => ({
      data: {
        updateFarm: { __typename: 'Farm', id: 'farm1', name: 'High Farm', postcode: 'UB8 3PH' },
      },
    }));
    renderWith([
      settingsMock,
      {
        request: {
          query: UPDATE_FARM,
          variables: { id: 'farm1', input: { name: 'High Farm', postcode: 'UB8 3PH' } },
        },
        result: saved,
      },
      settingsMock,
    ]);
    const form = await screen.findByRole('form', { name: 'Farm details' });
    await userEvent.clear(within(form).getByLabelText('Farm name'));
    await userEvent.type(within(form).getByLabelText('Farm name'), 'High Farm');
    await userEvent.click(within(form).getByRole('button', { name: 'Save details' }));
    await vi.waitFor(() => expect(saved).toHaveBeenCalled());
  });

  it('archives a field', async () => {
    const archived = vi.fn(() => ({
      data: { setFieldArchived: { __typename: 'Field', id: 'f1', archivedOn: '2026-06-01' } },
    }));
    renderWith([
      settingsMock,
      {
        request: { query: SET_FIELD_ARCHIVED, variables: { id: 'f1', archived: true } },
        result: archived,
      },
      settingsMock,
    ]);
    await userEvent.click(await screen.findByRole('button', { name: 'Archive Fell' }));
    await vi.waitFor(() => expect(archived).toHaveBeenCalled());
  });

  it('lists archived fields and groups, with restore', async () => {
    const restored = vi.fn(() => ({
      data: { restoreLivestockGroup: { __typename: 'LivestockGroup', id: 'g9', archivedOn: null } },
    }));
    renderWith([
      settingsMock,
      { request: { query: RESTORE_GROUP, variables: { id: 'g9' } }, result: restored },
      settingsMock,
    ]);
    expect(await screen.findByText(/Old orchard/)).toBeInTheDocument();
    const groups = screen.getByRole('list', { name: 'Archived groups' });
    expect(within(groups).getByText(/Sold at market/)).toBeInTheDocument();
    expect(within(groups).getByRole('link', { name: 'Store lambs 2025' })).toHaveAttribute(
      'href',
      '/groups/g9',
    );
    await userEvent.click(within(groups).getByRole('button', { name: 'Restore Store lambs 2025' }));
    await vi.waitFor(() => expect(restored).toHaveBeenCalled());
  });

  it('only deletes the farm once its name is typed, then goes to the farm list', async () => {
    renderWith([
      settingsMock,
      {
        request: { query: DELETE_FARM, variables: { id: 'farm1', confirmName: 'Hill Farm' } },
        result: { data: { deleteFarm: true } },
      },
    ]);
    const form = await screen.findByRole('form', { name: 'Delete farm' });
    const button = within(form).getByRole('button', { name: 'Delete farm for good' });
    expect(button).toBeDisabled();
    fireEvent.change(within(form).getByLabelText(/Type the farm name/), {
      target: { value: 'Hill Farm' },
    });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(await screen.findByText('All farms')).toBeInTheDocument();
  });
});
