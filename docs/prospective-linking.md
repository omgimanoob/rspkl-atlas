# Linking Prospective Projects to Kimai

This document explains how linking works between Atlas-native Prospective projects and Kimai projects, the integrity guarantees in place, and the prerequisites to use the feature reliably.

## Concepts

- Prospective project (Atlas): A project created in Atlas before it exists in Kimai. Stored in `atlas_projects`.
- Kimai project: A project that already exists in Kimai (`kimai2_projects`, read via replicas).
- Project overrides: Optional Atlas overlay for Kimai projects (status, notes, money). Stored in `project_overrides`.

## Prerequisites

- Database migrations applied:
  - `atlas_projects` and `project_overrides` (created by `ProjectsV2Schema.ensure()` / migrations).
  - Unique keys:
    - `atlas_projects.kimai_project_id` has a unique index.
    - `project_overrides.kimai_project_id` has a unique index.
  - Statuses lookup table present (`project_statuses`). If seeding, run `npm run db:seed:statuses`.
- Kimai connection configured in `.env` (KIMAI_DB_* env vars) so the API can verify target Kimai project IDs.
- Permissions:
  - Linking requires `prospective:link` (see RBAC).
  - Creating/Editing Prospective requires `prospective:create` / `prospective:update`.

## How Linking Works

Linking ties a Prospective (Atlas) project record to an existing Kimai project by setting `atlas_projects.kimai_project_id` and timestamping `linked_at`.

### UI Flow (Projects V2)

1. Open Projects and filter to show Prospective rows (Origin: Atlas) as needed.
2. Use the row action “Link” on the Prospective to open the dialog.
3. Enter a numeric Kimai project ID and confirm.
4. On success, the Prospective row is linked to the specified Kimai project.

### API Flow

- Endpoint: `POST /api/v2/prospective/:id/link`
- Body: `{ "kimai_project_id": number }`
- Required permission: `prospective:link`

### Validation and Integrity Checks

The server enforces the following checks (in this order):

1. Valid IDs: The Prospective `:id` and `kimai_project_id` must be numeric.
2. Kimai existence: The target `kimai_project_id` must exist in `kimai2_projects` (verified via the Kimai DB).
3. Prospective existence and state: The `atlas_projects` row must exist and must not be already linked (`kimai_project_id` is NULL).
4. Override conflict check: Linking is rejected if an override already exists for the target Kimai project (prevents two sources competing for the same Kimai id). The API checks legacy overrides and the schema ensures uniqueness in `project_overrides`.
5. Link write: `UPDATE atlas_projects SET kimai_project_id = ?, linked_at = CURRENT_TIMESTAMP WHERE id = ?`.

On any failure, the API returns a 4xx response with a reason code (examples below).

## Reason Codes (Troubleshooting)

- `invalid_id`: The Prospective `:id` path parameter is not a valid number.
- `invalid_kimai_project_id`: The payload `kimai_project_id` is missing or not a valid number.
- `unknown_kimai_project`: The given Kimai ID does not exist in Kimai.
- `already_linked`: The Prospective already has `kimai_project_id` set.
- `override_exists_for_project`: An override already exists for this Kimai project.

## Data Model and Integrity

- `atlas_projects`
  - `kimai_project_id BIGINT NULL` — unique (one Prospective can link to at most one Kimai, and a Kimai project can be linked by at most one Prospective).
  - `linked_at TIMESTAMP NULL` — set when linking occurs.
- `project_overrides`
  - `kimai_project_id BIGINT NOT NULL` — unique (only one overrides row per Kimai project).
  - Holds optional `status_id`, `notes`, and `money_collected` for the Kimai project.

These uniqueness constraints ensure a consistent 1:1 mapping between Atlas and Kimai identifiers at both the “Prospective link” level and the “Overrides” level.

## Operational Notes

- Linking does not create or delete Kimai projects; it only annotates Prospective records in Atlas with the corresponding Kimai ID.
- If you need to overlay status/notes for a Kimai project, use `project_overrides`. The linking operation will reject creating a link that conflicts with an existing override.
- After linking, use the “Overrides” dialog (on Kimai rows) to manage status/notes/money. Prospective notes remain on the Atlas side.

## Recommended Practices

- Always link to the correct Kimai ID. If uncertain, verify in Kimai first.
- Avoid direct SQL changes to `atlas_projects.kimai_project_id` and `project_overrides.kimai_project_id`. Use the API to preserve audit logs and validation.
- Keep both Atlas and Kimai in sync by running regular sync jobs, especially `sync:projects`, so names/comments are fresh for discovery.

## Example: Linking via curl

```
curl -i -X POST \
  http://localhost:$PORT/api/v2/prospective/123/link \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  --data '{ "kimai_project_id": 4567 }'
```

Expected response on success: `200 { ok: true, atlasId: 123, kimaiId: 4567 }`.

