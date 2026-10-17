import { render, screen, within } from '@testing-library/react';
import { DayStrip, dayIcon } from '../src/components/DayStrip';

const day = (date: string, tempMaxC: number, precipitationMm: number) => ({
  date,
  tempMaxC,
  tempMinC: 4,
  precipitationMm,
});

describe('DayStrip (v3.2)', () => {
  it('shows each day with its high, low and rain, starting with today', () => {
    render(<DayStrip days={[day('2026-10-17', 12.4, 0), day('2026-10-18', 9.6, 8.44)]} />);
    const items = within(screen.getByRole('list', { name: 'Each day' })).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Today');
    expect(items[0]).toHaveTextContent('12°');
    expect(items[1]).toHaveTextContent('Sun');
    expect(items[1]).toHaveTextContent('8.4 mm');
  });

  it.each([
    [day('x', 20, 0), 'sun'],
    [day('x', 20, 1), 'drop'],
    [day('x', 10, 0.5), 'forecast'],
  ])('picks an icon from rain and warmth', (d, icon) => {
    expect(dayIcon(d)).toBe(icon);
  });
});
