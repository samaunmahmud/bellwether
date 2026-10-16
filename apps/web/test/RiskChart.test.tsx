import { render, screen } from '@testing-library/react';
import { RiskChart } from '../src/components/RiskChart';
import { tickForecast } from './fixtures';

describe('RiskChart', () => {
  it('draws one labelled bar per day with height from the score', () => {
    render(<RiskChart days={tickForecast.days} title="Tick activity" />);

    expect(
      screen.getByRole('figure', { name: 'Tick activity: 14-day risk chart' }),
    ).toBeInTheDocument();
    const bars = screen.getAllByLabelText(/risk$/);
    expect(bars).toHaveLength(14);
    expect(bars[0]).toHaveAttribute('aria-label', expect.stringMatching(/high risk/));
    expect(bars[0]).toHaveStyle({ height: '85%' });
  });

  it('renders nothing on the axis for an empty forecast', () => {
    const { container } = render(<RiskChart days={[]} title="Empty" />);
    expect(container.querySelector('figcaption')).toBeNull();
  });
});
