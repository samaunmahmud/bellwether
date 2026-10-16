import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RiskCard } from '../src/components/RiskCard';
import { tickForecast } from './fixtures';

describe('RiskCard', () => {
  it("shows the risk name, animals, today's level as text, and the reason", () => {
    render(<RiskCard risk={tickForecast} />);
    const card = screen.getByRole('article', { name: 'Tick activity' });

    expect(within(card).getByText('dog, cat')).toBeInTheDocument();
    expect(within(card).getAllByText('High').length).toBeGreaterThan(0);
    expect(within(card).getAllByText('Mild and humid: ticks likely active').length).toBeGreaterThan(
      0,
    );
  });

  it('shows 3 days by default and expands to all 14', async () => {
    render(<RiskCard risk={tickForecast} />);
    const rows = () =>
      screen.getAllByRole('listitem').filter((li) => li.classList.contains('days__row'));

    expect(rows()).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'Show all 14 days' }));
    expect(rows()).toHaveLength(14);
    await userEvent.click(screen.getByRole('button', { name: 'Show fewer days' }));
    expect(rows()).toHaveLength(3);
  });
});
