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

export function incMailSent(success: boolean) {
  if (success) counters.mail.sent.success++;
  else counters.mail.sent.fail++;
}

export function incMailDisabled() {
  counters.mail.disabled++;
}
