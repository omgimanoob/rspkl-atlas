# RBAC Feature Flags and Observability

This document summarizes environment flags and observability controls for RBAC, how to use them in different environments, and their current defaults.

## Flags

- `RBAC_ENFORCE_READS` (default: `true`)
  - When `true`, read routes guarded by `requirePermission` will enforce 403 on deny.
  - When `false`, read routes will not block on permission deny (decisions can still be logged if enabled).

- `RBAC_ENFORCE_WRITES` (default: `true`)
  - When `true`, write routes guarded by `requirePermission` will enforce 403 on deny.
  - When `false`, write routes will not block on permission deny (decisions can still be logged if enabled).

- `RBAC_SHADOW_EVAL` (default: `false`)
  - Informational flag. The system always computes RBAC decisions; use this flag to signal a shadow-eval phase in logs/dashboards.
  - Combine with `RBAC_ENFORCE_* = false` to run in shadow mode.

- `RBAC_DECISIONS_LOG` (default: `false`)
  - When `true`, permission decisions (allow/deny with reasons and optional resource) are written to `rbac_audit_logs` by the `requirePermission` middleware.
  - Non-blocking; concise warnings if logging fails.

## Recommended configurations

- Local development
  - `RBAC_ENFORCE_READS=true`, `RBAC_ENFORCE_WRITES=true` (default)
  - `RBAC_DECISIONS_LOG=false` (keep logs quiet unless diagnosing)

- Staging (shadow evaluation)
  - `RBAC_ENFORCE_READS=false`, `RBAC_ENFORCE_WRITES=false`
  - `RBAC_DECISIONS_LOG=true` (collect allow/deny decisions for analysis)
  - `RBAC_SHADOW_EVAL=true`

- Production (enforced)
  - `RBAC_ENFORCE_READS=true`, `RBAC_ENFORCE_WRITES=true`
  - `RBAC_DECISIONS_LOG=true` (optional but recommended initially)
  - `RBAC_SHADOW_EVAL=false`

## Observability

- Decisions: enable `RBAC_DECISIONS_LOG` to write to `rbac_audit_logs` (user, permission, resource, decision, reason, route, method, IP).
- Metrics: `GET /metrics` returns in-memory counters:
  - `rbac.decisions.allow`
  - `rbac.decisions.deny`
  - `rbac.adminMutations`
  - `auth.passwordChange.success`
  - `auth.passwordChange.fail`
  - `auth.passwordReset.request`
  - `auth.passwordReset.confirmSuccess`
  - `auth.passwordReset.confirmFail`

## Notes

- Admin endpoints are permission-only (no role fallback) and respect `RBAC_ENFORCE_WRITES/READS`.
- Missing DB tables for auditing do not block requests; you may see concise one-line warnings until migrations are applied.

## Example .env snippets

Staging (shadow-eval):
```
RBAC_ENFORCE_READS=false
RBAC_ENFORCE_WRITES=false
RBAC_SHADOW_EVAL=true
RBAC_DECISIONS_LOG=true
```

Production (enforced with decision logs):
```
RBAC_ENFORCE_READS=true
RBAC_ENFORCE_WRITES=true
RBAC_SHADOW_EVAL=false
RBAC_DECISIONS_LOG=true
```
