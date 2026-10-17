import { useApolloClient, useMutation, useQuery } from '@apollo/client';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LOG_OUT, ME_QUERY } from '../graphql/auth';
import { FARMS_QUERY } from '../graphql/farms';
import { clearOfflineData } from '../offline/registerOffline';
import type { FarmSummary } from '../types';
import { CommandPalette } from './CommandPalette';
import { FARM_PAGES } from './farmPages';
import { Icon } from './Icon';
import { NavBar } from './NavBar';
import { OfflineBanner } from './OfflineBanner';

const LAST_FARM_KEY = 'bellwether:lastFarm';
const THEME_KEY = 'bellwether:theme';

/** Storage can be missing or blocked (private windows, previews); the app works without it. */
function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not remembered this time; nothing else depends on it.
  }
}

type Theme = 'light' | 'dark';

function useTheme() {
  const [theme, setTheme] = useState<Theme | null>(() => stored(THEME_KEY) as Theme | null);
  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
  }, [theme]);
  const current: Theme =
    theme ??
    (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light');
  const toggle = () => {
    const next = current === 'dark' ? 'light' : 'dark';
    store(THEME_KEY, next);
    setTheme(next);
  };
  return { theme: current, toggle };
}

/** The farm the user is looking at: from the address, else the last one they opened. */
function useCurrentFarm(farms: FarmSummary[]) {
  const { pathname } = useLocation();
  const fromPath = /^\/farms\/([^/]+)/.exec(pathname)?.[1] ?? null;
  useEffect(() => {
    if (fromPath) store(LAST_FARM_KEY, fromPath);
  }, [fromPath]);
  const remembered = stored(LAST_FARM_KEY);
  const id =
    fromPath ?? (farms.some((f) => f.id === remembered) ? remembered : farms[0]?.id) ?? null;
  return { id, subPath: fromPath ? pathname.slice(`/farms/${fromPath}`.length) : '' };
}

/**
 * Signed in: a sidebar with the farm switcher and every farm page, collapsing to a menu on
 * phones, plus the command palette. Signed out: the simple top bar.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const client = useApolloClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: meData } = useQuery<{ me: { id: string; email: string } | null }>(ME_QUERY);
  const me = meData?.me;
  const { data } = useQuery<{ farms: FarmSummary[] }>(FARMS_QUERY, { skip: !me });
  const farms = data?.farms ?? [];
  const { id: farmId, subPath } = useCurrentFarm(farms);
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [logOut] = useMutation(LOG_OUT);

  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!me)
    return (
      <div className="shell">
        <NavBar />
        <OfflineBanner />
        <main className="content">{children}</main>
      </div>
    );

  async function handleLogOut() {
    await logOut();
    await clearOfflineData();
    await client.resetStore();
    navigate('/');
  }

  const farm = farms.find((f) => f.id === farmId);
  const themeLabel = theme === 'dark' ? 'Light mode' : 'Dark mode';

  return (
    <div className={`app${menuOpen ? ' app--menu-open' : ''}`}>
      <header className="mobilebar">
        <button
          type="button"
          className="icon-button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="sidebar"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} />
        </button>
        <Link to={farm ? `/farms/${farm.id}` : '/farms'} className="brand">
          <BrandMark /> Bellwether
        </Link>
        <button
          type="button"
          className="icon-button"
          aria-label="Search"
          onClick={() => setPaletteOpen(true)}
        >
          <Icon name="search" />
        </button>
      </header>

      <aside className="sidebar" id="sidebar" aria-label="Main">
        <Link to={farm ? `/farms/${farm.id}` : '/farms'} className="brand sidebar__brand">
          <BrandMark /> Bellwether
        </Link>

        <button type="button" className="sidebar__search" onClick={() => setPaletteOpen(true)}>
          <Icon name="search" size={18} />
          <span>Go to…</span>
          <kbd>⌘K</kbd>
        </button>

        {farms.length > 0 && farmId && (
          <label className="sidebar__switcher">
            <span className="sidebar__heading">Farm</span>
            <select
              value={farmId}
              onChange={(e) => navigate(`/farms/${e.target.value}${subPath}`)}
              aria-label="Switch farm"
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <nav className="sidebar__nav">
          {farmId && (
            <ul aria-label="This farm">
              {FARM_PAGES.map((page) => (
                <li key={page.path}>
                  <NavLink to={`/farms/${farmId}${page.path}`} end={page.path === ''}>
                    <Icon name={page.icon} />
                    {page.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
          <p className="sidebar__heading">Everything</p>
          <ul aria-label="Everything">
            <li>
              <NavLink to="/farms" end>
                <Icon name="farms" />
                My farms
              </NavLink>
            </li>
            <li>
              <NavLink to="/animals">
                <Icon name="pets" />
                My pets
              </NavLink>
            </li>
            <li>
              <NavLink to="/" end>
                <Icon name="forecast" />
                Postcode forecast
              </NavLink>
            </li>
          </ul>
        </nav>

        <div className="sidebar__footer">
          <button type="button" className="sidebar__action" onClick={toggle}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            {themeLabel}
          </button>
          <p className="sidebar__user" title={me.email}>
            {me.email}
          </p>
          <button type="button" className="sidebar__action" onClick={handleLogOut}>
            <Icon name="logout" />
            Log out
          </button>
        </div>
      </aside>
      {menuOpen && <div className="sidebar__scrim" onClick={() => setMenuOpen(false)} />}

      <main className="app__main content" id="main">
        <OfflineBanner />
        {children}
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} farmId={farmId} />
    </div>
  );
}

/** A bell with a sheep's ear: the Bellwether mark. */
export function BrandMark() {
  return (
    <svg className="brand__mark" width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="var(--accent)" />
      <path
        d="M10 21c0-6 2.5-10 6-10s6 4 6 10H10zm4.5 2.5a1.5 1.5 0 0 0 3 0"
        fill="none"
        stroke="var(--accent-text)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16 11V8" stroke="var(--accent-text)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
