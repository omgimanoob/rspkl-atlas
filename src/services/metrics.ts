type Counters = {
  rbac: {
    decisions: { allow: number; deny: number };
    adminMutations: number;
  };
};

const counters: Counters = {
  rbac: {
    decisions: { allow: 0, deny: 0 },
    adminMutations: 0,
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

