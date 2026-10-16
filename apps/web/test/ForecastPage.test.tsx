import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { FORECAST_QUERY } from '../src/graphql/queries';
import { ForecastPage } from '../src/pages/ForecastPage';
import { routerFuture } from '../src/routerFuture';
import { petForecast, withTypenames } from './fixtures';

function renderAt(url: string, mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={[url]} future={routerFuture}>
        <Routes>
          <Route path="/forecast/:kind" element={<ForecastPage />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

const variables = { postcode: 'UB8 3PH', category: 'PET', highExposureHabitat: false };

describe('ForecastPage', () => {
  it('shows loading, then the forecast with the disclaimer', async () => {
    renderAt('/forecast/pet?postcode=UB8%203PH', [
      {
        request: { query: FORECAST_QUERY, variables },
        result: { data: { forecast: withTypenames(petForecast) } },
      },
    ]);

    expect(screen.getByText('Loading forecast…')).toBeInTheDocument();
    expect(await screen.findByRole('article', { name: 'Tick activity' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/not veterinary advice/);
  });

  it('shows the API error message', async () => {
    renderAt('/forecast/pet?postcode=UB8%203PH', [
      {
        request: { query: FORECAST_QUERY, variables },
        error: new Error('Weather forecast is unavailable'),
      },
    ]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Weather forecast is unavailable');
  });

  it('asks for a postcode when none is given', () => {
    renderAt('/forecast/farm', []);
    expect(screen.getByRole('heading', { name: 'Farm forecast' })).toBeInTheDocument();
    expect(screen.getByText(/no postcode given/i)).toBeInTheDocument();
  });
});
