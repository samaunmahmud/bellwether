import { fireEvent, render, screen, within } from '@testing-library/react';
import { BarChart } from '../src/components/charts/BarChart';
import { labelIndices, niceTicks } from '../src/components/charts/chartUtils';
import { LineChart } from '../src/components/charts/LineChart';

describe('chart helpers', () => {
  it('makes clean ticks covering the data', () => {
    expect(niceTicks(3, 27)).toEqual([0, 10, 20, 30]);
    expect(niceTicks(5, 5)).toEqual([4, 4.5, 5, 5.5, 6]);
  });

  it('labels the first and last point and a few between', () => {
    expect(labelIndices(14, 6)).toEqual([0, 3, 5, 8, 10, 13]);
    expect(labelIndices(3, 6)).toEqual([0, 1, 2]);
    expect(labelIndices(7, 6)).toHaveLength(7);
  });
});

describe('LineChart', () => {
  const props = {
    title: 'Temperature',
    labels: ['Mon', 'Tue', 'Wed'],
    series: [
      { name: 'High', color: 'red', values: [18, 21, 19] },
      { name: 'Low', color: 'blue', values: [8, null, 9] },
    ],
    unit: '°C',
  };

  it('has a legend for two series and a table view with every value', () => {
    render(<LineChart {...props} />);
    expect(
      within(screen.getByRole('list', { name: 'Legend' })).getAllByRole('listitem'),
    ).toHaveLength(2);
    const table = screen.getByRole('table');
    expect(within(table).getByRole('row', { name: /Tue 21 °C –/ })).toBeInTheDocument();
  });

  it('reads values with the arrow keys', () => {
    render(<LineChart {...props} />);
    const chart = screen.getByRole('img', { name: /Temperature/ });
    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    expect(screen.getByRole('status')).toHaveTextContent('TueHigh: 21 °CLow: –');
  });

  it('says when there is nothing to chart', () => {
    render(<LineChart {...props} series={[{ name: 'x', color: 'red', values: [null] }]} />);
    expect(screen.getByText('No data to chart yet.')).toBeInTheDocument();
  });
});

describe('BarChart', () => {
  it('gives every column a focusable label and a tooltip', () => {
    render(<BarChart title="Rain" labels={['Mon', 'Tue']} values={[0, 4.25]} unit="mm" />);
    const tue = screen.getByLabelText('Tue: 4.3 mm');
    fireEvent.focus(tue);
    expect(screen.getByRole('status')).toHaveTextContent('Tue4.3 mm');
  });
});
