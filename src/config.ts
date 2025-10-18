function parseIdList(value?: string | null): number[] {
  if (!value) return [];
  return String(value)
    .split(/[,\s]+/)
    .map(v => v.trim())
    .filter(Boolean)
    .map(v => Number(v))
    .filter(n => Number.isFinite(n));
}

const defaultExcludedProjects = [92, 93, 94, 95, 140, 141, 142, 145, 157];
const defaultExcludedCustomers = [43, 84, 85, 86];
const defaultExcludedUsers = [155, 156, 157, 158, 168, 169, 170, 173];
const defaultIncludedProjects = [20]; // keep current behavior; can override via env

export const config = {
  auth: {
    jwtSecret: process.env.AUTH_JWT_SECRET || 'dev-secret-change-me',
    cookieName: process.env.AUTH_COOKIE_NAME || 'atlas_token',
    tokenTtlSeconds: Number(process.env.AUTH_TOKEN_TTL_SECONDS || 60 * 60 * 8), // 8h
  },
  web: {
    // Base URL for links sent to users (e.g., password reset)
    // Examples: https://app.rspkl.com or http://localhost:5173
    baseUrl:
      process.env.APP_BASE_URL ||
      process.env.WEB_APP_URL ||
      (process.env.NODE_ENV === 'production' ? 'https://app.rspkl.com' : 'http://localhost:5173'),
    // Path on the web app that handles password reset and accepts ?token=
    resetPath: process.env.RESET_PATH || '/reset',
  },
  rbac: {
    shadowEval: /^(1|true)$/i.test(String(process.env.RBAC_SHADOW_EVAL || 'false')),
    enforceReads: /^(1|true)$/i.test(String(process.env.RBAC_ENFORCE_READS || 'true')),
    enforceWrites: /^(1|true)$/i.test(String(process.env.RBAC_ENFORCE_WRITES || 'true')),
  },
  adminSeed: {
    email: process.env.ADMIN_EMAIL || '',
    password: process.env.ADMIN_PASSWORD || '',
    displayName: process.env.ADMIN_DISPLAY_NAME || 'Administrator',
  },
  filters: {
    excludedProjectIds: parseIdList(process.env.EXCLUDED_PROJECT_IDS).length
      ? parseIdList(process.env.EXCLUDED_PROJECT_IDS)
      : defaultExcludedProjects,
    excludedCustomerIds: parseIdList(process.env.EXCLUDED_CUSTOMER_IDS).length
      ? parseIdList(process.env.EXCLUDED_CUSTOMER_IDS)
      : defaultExcludedCustomers,
    excludedUserIds: parseIdList(process.env.EXCLUDED_USER_IDS).length
      ? parseIdList(process.env.EXCLUDED_USER_IDS)
      : defaultExcludedUsers,
    includedProjectIds: parseIdList(process.env.INCLUDED_PROJECT_IDS).length
      ? parseIdList(process.env.INCLUDED_PROJECT_IDS)
      : defaultIncludedProjects,
  },
};
