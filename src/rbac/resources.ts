const allowedTypes = new Set<string>(['project']);

export function normalizeResourceType(t?: string | null): string | null {
  if (!t) return null;
  const v = String(t).trim().toLowerCase();
  return allowedTypes.has(v) ? v : null;
}

export function normalizeResourceId(type: string | null, value: any): number | null {
  if (!type) return null;
  // For now, only 'project' is supported and expects a numeric ID
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function isValidResource(type?: string | null, id?: any): boolean {
  const t = normalizeResourceType(type);
  if (!t) return false;
  const n = normalizeResourceId(t, id);
  return n !== null;
}

export const ResourceRegistry = {
  allowed: Array.from(allowedTypes),
  normalizeResourceType,
  normalizeResourceId,
  isValidResource,
};

