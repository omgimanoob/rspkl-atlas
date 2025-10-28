type Counters = {
  rbac: {
    decisions: { allow: number; deny: number };
    adminMutations: number;
  };
  auth: {
    passwordChange: { success: number; fail: number };
    passwordReset: { request: number; confirmSuccess: number; confirmFail: number };
  };
  mail: {
    sent: { success: number; fail: number };
    disabled: number;
  };
  overrides: {
    statusUpdate: number;
    upsert: number;
    prospective: { create: number; link: number };
  };
};

const counters: Counters = {
  rbac: {
    decisions: { allow: 0, deny: 0 },
    adminMutations: 0,
  },
  auth: {
    passwordChange: { success: 0, fail: 0 },
    passwordReset: { request: 0, confirmSuccess: 0, confirmFail: 0 },
  },
  mail: {
    sent: { success: 0, fail: 0 },
    disabled: 0,
  },
  overrides: {
    statusUpdate: 0,
    upsert: 0,
    prospective: { create: 0, link: 0 },
  },
};

export function incRbacDecision(decision: 'allow' | 'deny') {
  if (decision === 'allow') counters.rbac.decisions.allow++;
  else counters.rbac.decisions.deny++;
}

export function incAdminMutation() {
  counters.rbac.adminMutations++;
}

export function metricsSnapshot() {
  return { ...counters };
}

export function incPasswordChange(success: boolean) {
  if (success) counters.auth.passwordChange.success++;
  else counters.auth.passwordChange.fail++;
}

export function incPasswordResetRequest() {
  counters.auth.passwordReset.request++;
}

export function incPasswordResetConfirm(success: boolean) {
  if (success) counters.auth.passwordReset.confirmSuccess++;
  else counters.auth.passwordReset.confirmFail++;
}

// Sync metrics aggregated from DB (replica counts + last_run state)
import { atlasPool } from '../../db';
export async function syncMetrics() {
  const keys = [
    'sync.projects.last_run',
    'sync.timesheets.last_modified_at',
    'sync.customers.last_run',
    'sync.users.last_run',
    'sync.activities.last_run',
    'sync.tags.last_run',
    'sync.teams.last_run',
    'sync.teams_users.last_run',
  ];
  let state: Record<string, any> = {};
  try {
    const [stateRows]: any = await atlasPool.query(
      `SELECT state_key, state_value, updated_at FROM sync_state WHERE state_key IN (${keys.map(() => '?').join(',')})`,
      keys
    );
    state = {};
    for (const r of stateRows) state[r.state_key] = { value: r.state_value, updated_at: r.updated_at };
  } catch {}
  let counts: Record<string, number> = {};
  try {
    const countsSql = `SELECT 'projects' as name, COUNT(*) as cnt FROM replica_kimai_projects
      UNION ALL SELECT 'timesheets', COUNT(*) FROM replica_kimai_timesheets
      UNION ALL SELECT 'users', COUNT(*) FROM replica_kimai_users
      UNION ALL SELECT 'activities', COUNT(*) FROM replica_kimai_activities
      UNION ALL SELECT 'tags', COUNT(*) FROM replica_kimai_tags
      UNION ALL SELECT 'timesheet_tags', COUNT(*) FROM replica_kimai_timesheet_tags
      UNION ALL SELECT 'customers', COUNT(*) FROM replica_kimai_customers
      UNION ALL SELECT 'teams', COUNT(*) FROM replica_kimai_teams
      UNION ALL SELECT 'users_teams', COUNT(*) FROM replica_kimai_users_teams`;
    const [rows]: any = await atlasPool.query(countsSql);
    counts = {};
    for (const r of rows) counts[r.name] = Number(r.cnt) || 0;
  } catch {}
  return { state, counts };
}

export function incMailSent(success: boolean) {
  if (success) counters.mail.sent.success++;
  else counters.mail.sent.fail++;
}

export function incMailDisabled() {
  counters.mail.disabled++;
}

// Overrides project mutations
export function incOverrideStatusUpdate() {
  counters.overrides.statusUpdate++;
}

export function incOverrideUpsert() {
  counters.overrides.upsert++;
}

export function incProspectiveCreate() {
  counters.overrides.prospective.create++;
}

export function incProspectiveLink() {
  counters.overrides.prospective.link++;
}
