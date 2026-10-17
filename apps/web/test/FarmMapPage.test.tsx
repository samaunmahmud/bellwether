import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../src/components/Toasts';
import { MAP_QUERY, SET_FIELD_PIN } from '../src/graphql/v3';
import { FarmMapPage, grazingText } from '../src/pages/FarmMapPage';
import { routerFuture } from '../src/routerFuture';

// Leaflet needs a real browser; stand in a button that "clicks the map" at a fixed point.
vi.mock('../src/components/FieldMap', () => ({
  FieldMap: ({ onPick }: { onPick?: (lat: number, lon: number) => void }) => (
    <button type="button" onClick={() => onPick?.(54.31234, -2.74321)}>
      Map
    </button>
  ),
}));

const field = (id: string, name: string, grazing: object, extra = {}) => ({
  __typename: 'Field',
  id,
  name,
  postcode: null,
  latitude: null,
  longitude: null,
  grazing: { __typename: 'Grazing', ...grazing },
  ...extra,
});

const mapMock: MockedResponse = {
  request: { query: MAP_QUERY, variables: { id: 'f1' } },
  result: {
    data: {
      farm: {
        __typename: 'Farm',
        id: 'f1',
        name: 'Hill Farm',
        myRole: 'OWNER',
        location: { __typename: 'GeoPoint', latitude: 54.3, longitude: -2.7 },
        fields: [
          field(
            'a',
            'Top Fell',
            { status: 'GRAZED', days: 18, groups: ['Ewes'] },
            { latitude: 54.3, longitude: -2.7 },
          ),
          field('b', 'Beck Meadow', { status: 'RESTING', days: 30, groups: [] }),
        ],
      },
    },
  },
};

describe('FarmMapPage (v3)', () => {
  it('describes grazing in words', () => {
    expect(grazingText({ status: 'GRAZED', days: 1, groups: ['Ewes', 'Tups'] })).toBe(
      'Ewes, Tups in for 1 day',
    );
    expect(grazingText({ status: 'RESTING', days: 30, groups: [] })).toBe('Rested for 30 days');
    expect(grazingText({ status: 'NEVER_USED', days: null, groups: [] })).toBe('No moves recorded');
  });

  it('lists fields with grazing, and pins one by clicking the map', async () => {
    const pinned = vi.fn(() => ({
      data: {
        updateField: { __typename: 'Field', id: 'b', latitude: 54.3123, longitude: -2.7432 },
      },
    }));
    render(
      <MockedProvider
        mocks={[
          mapMock,
          {
            request: {
              query: SET_FIELD_PIN,
              variables: { id: 'b', input: { latitude: 54.3123, longitude: -2.7432 } },
            },
            result: pinned,
          },
          mapMock,
        ]}
      >
        <ToastProvider>
          <MemoryRouter initialEntries={['/farms/f1/map']} future={routerFuture}>
            <Routes>
              <Route path="/farms/:id/map" element={<FarmMapPage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </MockedProvider>,
    );
    expect(await screen.findByText(/Longest rested: Beck Meadow \(30 days\)/)).toBeInTheDocument();
    const beck = screen.getByText('Beck Meadow').closest('li')!;
    expect(within(beck).getByText('Resting')).toBeInTheDocument();
    await userEvent.click(within(beck).getByRole('button', { name: 'Pin Beck Meadow' }));
    expect(screen.getByText(/Click the map where/)).toHaveTextContent(
      'Click the map where Beck Meadow is',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Map' }));
    await vi.waitFor(() => expect(pinned).toHaveBeenCalled());
  });
});
