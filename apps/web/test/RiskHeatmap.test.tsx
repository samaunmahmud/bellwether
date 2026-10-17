import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RiskHeatmap } from '../src/components/RiskHeatmap';
import { routerFuture } from '../src/routerFuture';

const groups = [
  {
    id: 'g1',
    name: 'Ewes',
    forecast: {
      risks: [
        {
          riskId: 'blowfly',
          name: 'Blowfly strike',
          days: [
            { date: '2026-06-01', level: 'HIGH' as const, reason: 'Warm and humid' },
            { date: '2026-06-02', level: 'LOW' as const, reason: 'Cool' },
          ],
        },
      ],
    },
  },
];

describe('RiskHeatmap (v3)', () => {
  it('shows each level as a letter, not colour alone, and explains a day on tap', async () => {
    render(
      <MemoryRouter future={routerFuture}>
        <RiskHeatmap groups={groups} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Ewes' })).toHaveAttribute('href', '/groups/g1');
    const cell = screen.getByRole('button', { name: /Ewes, Blowfly strike, Mon 1 Jun: High/ });
    expect(cell).toHaveTextContent('H');
    await userEvent.click(cell);
    expect(screen.getByText(/Warm and humid/, { selector: 'p' })).toBeInTheDocument();
    expect(cell).toHaveAttribute('aria-pressed', 'true');
  });

  it('says when there are no groups', () => {
    render(
      <MemoryRouter future={routerFuture}>
        <RiskHeatmap groups={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Add a livestock group/)).toBeInTheDocument();
  });
});
