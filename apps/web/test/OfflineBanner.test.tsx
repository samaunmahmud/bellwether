import { act, render, screen } from '@testing-library/react';
import { OfflineBanner } from '../src/components/OfflineBanner';

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

describe('OfflineBanner', () => {
  afterEach(() => setOnline(true));

  it('says when the device goes offline and what still works', () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    act(() => setOnline(false));
    expect(screen.getByRole('status')).toHaveTextContent(/offline/i);
    expect(screen.getByRole('status')).toHaveTextContent(/can’t be saved/);
    act(() => setOnline(true));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows straight away when the page opens offline', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toHaveTextContent(/offline/i);
  });
});
