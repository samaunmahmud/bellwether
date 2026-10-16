import { render, screen } from '@testing-library/react';
import { ForecastView } from '../src/components/ForecastView';
import { petForecast } from './fixtures';

describe('ForecastView', () => {
  it('shows the location and one card per risk', () => {
    render(<ForecastView forecast={petForecast} />);
    expect(screen.getByText('UB8 3PH')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });

  it('always shows the "not veterinary advice" disclaimer', () => {
    render(<ForecastView forecast={petForecast} />);
    expect(screen.getByRole('note')).toHaveTextContent(
      'This is an awareness tool, not veterinary advice. Speak to your vet.',
    );
  });
});
