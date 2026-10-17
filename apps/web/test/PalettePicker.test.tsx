import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { applyStoredPalette, PalettePicker, PALETTE_KEY } from '../src/components/PalettePicker';

describe('PalettePicker (v3.3)', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-palette');
  });

  it('offers the four colour schemes by name, Pasture first', () => {
    render(<PalettePicker />);
    const options = screen.getAllByRole('radio');
    expect(options.map((o) => o.getAttribute('aria-label'))).toEqual([
      'Pasture',
      'Heather',
      'Loch',
      'Peat',
    ]);
    expect(screen.getByRole('radio', { name: 'Pasture' })).toBeChecked();
  });

  it('switches the whole app’s colours and remembers the choice', async () => {
    render(<PalettePicker />);
    await userEvent.click(screen.getByRole('radio', { name: 'Heather' }));
    expect(document.documentElement).toHaveAttribute('data-palette', 'heather');
    expect(localStorage.getItem(PALETTE_KEY)).toBe('heather');

    await userEvent.click(screen.getByRole('radio', { name: 'Pasture' }));
    expect(document.documentElement).not.toHaveAttribute('data-palette');
  });

  it('applies a remembered choice before the app draws, and ignores unknown values', () => {
    localStorage.setItem(PALETTE_KEY, 'loch');
    applyStoredPalette();
    expect(document.documentElement).toHaveAttribute('data-palette', 'loch');
    localStorage.setItem(PALETTE_KEY, 'neon');
    applyStoredPalette();
    expect(document.documentElement).not.toHaveAttribute('data-palette');
  });
});
