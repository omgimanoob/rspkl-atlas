export const ALLOWED_PROJECT_STATUSES = [
  'Unassigned',
  'Schematic Design',
  'Design Development',
  'Tender',
  'Under construction',
  'Post construction',
  'KIV',
  'Others',
] as const;

export type ProjectStatus = typeof ALLOWED_PROJECT_STATUSES[number];

export function isValidProjectStatus(status: any): status is ProjectStatus {
  return typeof status === 'string' && ALLOWED_PROJECT_STATUSES.includes(status as ProjectStatus);
}

