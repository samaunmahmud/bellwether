import type { IconName } from './Icon';

/** The pages every farm has, in sidebar order. Paths are relative to /farms/:id. */
export const FARM_PAGES: ReadonlyArray<{ label: string; path: string; icon: IconName }> = [
  { label: 'Dashboard', path: '', icon: 'dashboard' },
  { label: 'Morning briefing', path: '/briefing', icon: 'briefing' },
  { label: 'Farm map', path: '/map', icon: 'map' },
  { label: 'Livestock', path: '/livestock', icon: 'livestock' },
  { label: 'Tagged animals', path: '/animals', icon: 'tag' },
  { label: 'Weather and risk', path: '/outlook', icon: 'outlook' },
  { label: 'Calendar', path: '/calendar', icon: 'calendar' },
  { label: 'Tasks', path: '/tasks', icon: 'tasks' },
  { label: 'Holding register', path: '/register', icon: 'register' },
  { label: 'Medicine cabinet', path: '/medicines', icon: 'medicine' },
  { label: 'Treatment records', path: '/records', icon: 'records' },
  { label: 'Contacts', path: '/contacts', icon: 'phone' },
  { label: 'People', path: '/people', icon: 'people' },
  { label: 'Farm settings', path: '/settings', icon: 'settings' },
];
