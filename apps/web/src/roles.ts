import type { FarmRole } from './types';

export const ROLE_LABELS: Record<FarmRole, string> = {
  OWNER: 'Owner',
  WORKER: 'Worker',
  VIEWER: 'Viewer',
};

export const ROLE_HELP: Record<FarmRole, string> = {
  OWNER: 'Can do everything, including fields, groups, people and farm settings',
  WORKER: 'Can record treatments and checks, move groups and do tasks',
  VIEWER: 'Can look at everything but change nothing',
};

/** Mirrors the API's rules (FR-8.2), only to hide buttons that would be refused. */
export const canWork = (role: FarmRole | undefined) => role === 'OWNER' || role === 'WORKER';
export const canManage = (role: FarmRole | undefined) => role === 'OWNER';
