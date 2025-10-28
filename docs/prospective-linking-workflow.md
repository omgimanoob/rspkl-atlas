# Prospective → Kimai Linking Workflow

This document describes the lifecycle for Atlas-native Prospective Projects and the mechanism to link them to a Kimai project, including validation and an optional create-and-link orchestration.

## Terms
- Prospective (Atlas-native): Row in `project_overrides` with `kimai_project_id = NULL`, `is_prospective = 0`, and `extras_json.name` for display.
- Kimai project: Row in `kimai2_projects` (Kimai DB) or a project created via Kimai’s API.

## Goals
- Prevent orphan links by verifying the Kimai id exists before linking.
- Support an operator-only flow to create a project in Kimai and then link the Prospective row in one action.
- Keep Kimai as the system of record — Atlas never directly writes to Kimai DB; use Kimai API when creating.

## API Endpoints
- `POST /prospective` (create Atlas-native)
- `GET /prospective` (list Atlas-native)
- `POST /prospective/:id/link` (link to existing Kimai id)
  - Validates the provided `kimai_project_id` exists in `kimai2_projects` before update.
  - Rejects with 409 if another override already references the id.
- `POST /prospective/:id/kimai-create-link` (optional orchestration)
  - Creates project in Kimai (via Kimai API), verifies the new id, then links.
  - On any failure, Atlas row is not mutated.

## Permissions
- `prospective:create` — create Atlas-native rows.
- `prospective:read` — list Atlas-native rows (optional UI tab).
- `prospective:link` — link to an existing Kimai id.
- `kimai:project:create` — operator-only permission to create in Kimai and link.

## Sequences

Link to existing Kimai project:
1) Client calls `POST /prospective/:id/link` with `kimai_project_id`.
2) Server checks `kimai2_projects` for existence.
3) If exists and no conflict, sets `kimai_project_id`, forces `is_prospective = 0`, audits, returns 200.
4) UI hides the Prospective row; the project will appear in `/projects` after next sync.

Create in Kimai and link (optional):
1) Client calls `POST /prospective/:id/kimai-create-link` with `{ name, customer_id, ... }`.
2) Server (with `kimai:project:create`) calls Kimai API to create project.
3) Verify/poll for the new project id in `kimai2_projects` or Kimai API.
4) Link Prospective row as above, audit, return 201/200 with new ids.
5) On any failure/timeout → return error, do not mutate Atlas; allow retry.

## Error Responses (examples)
- 400 `{ reason: 'unknown_kimai_project' }` — target id not found.
- 409 `{ reason: 'override_exists_for_project' }` — duplicate override exists.
- 502 `{ reason: 'kimai_create_failed' }` — upstream create failed.
- 504 `{ reason: 'kimai_verify_timeout' }` — couldn’t confirm new id in time.

## UI Notes
- Surface clear labels: Private/Shared/Org visibility (via grants), and Prospective badge.
- Provide two link actions depending on permissions: “Link to Kimai” and “Create in Kimai & Link”.
- After linking, show a success toast and remove the row from Prospective list.

## Auditing
- Record actor, route, method, status, and payload hash on create/link/orchestrate APIs.
- Consider including Kimai project id in audit metadata when linking succeeds.

## Non-Goals
- Atlas should not write directly to Kimai DB.
- No unlinking flow (documented as unsupported).

Refer to:
- `docs/overrides-projects.md` for data model and UI plan.
- `docs/rbac-implementation-plan.md` and checklist for permissions and wiring.
- `quick-sanity-tests.md` for sample cURL flows.

## Testing Notes
- Prefer validating Kimai existence against the live Kimai DB (`kimaiPool` → `kimai2_projects`) in tests to avoid replica lag.
- In integration tests, insert a temporary row in `kimai2_projects` and use its id for linking; clean up after.
- Add a negative case for unknown Kimai id (expect 400 `unknown_kimai_project`) and a conflict case (expect 409 `override_exists_for_project`).
