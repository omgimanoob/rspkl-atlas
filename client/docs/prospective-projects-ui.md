# Projects Page — Prospective Projects (UI Plan)

Goal: Allow permitted users to create a Prospective Project directly from the Projects page, without creating/modifying Kimai data. Optionally show/list Prospective entries and provide a linking action once a Kimai project exists.

## Phase 1 — Create Prospective (MVP)
- Implemented:
  - API: `listStatusesPublic()` and `createProspective(...)` in `client/src/lib/api.ts`.
  - Projects page: `New Prospective Project` button (visible to `hr|directors|admins`).
  - Dialog fields: Name (required), Status (optional via `listStatusesPublic()`), Notes (optional).
  - Submit calls `api.createProspective`; success toast and closes dialog. No table mutation in MVP.

## Phase 2 — List & Link (Optional Follow‑up)
- Add an optional “Prospective” tab on Projects page:
  - API: `GET /api/prospective` to list Atlas‑native rows.
  - Display minimal columns: `name`, `status`, `notes`, `updated_at`.
  - Add `Link to Kimai` dialog: input `kimai_project_id` → `POST /api/prospective/:id/link`.
    - Validation: surface errors for unknown Kimai id (400) or conflict (409).
  - (Optional) Add `Create in Kimai & Link` action for users with `kimai:project:create`:
    - Fields: `name` and `customer` selector; calls `POST /api/prospective/:id/kimai-create-link`.
    - Show progress/pending state while creating; on success, hide item (it will appear as Kimai-backed after sync).
  - After linking, hide the item from the Prospective list and let it surface via the main Projects table when Kimai project appears (after sync) with overrides applied.

## States & Validation
- Disable submit while pending; inline field errors (length, required name).
- Friendly mapping of backend reasons: `invalid_status_id`, `invalid_id`, `invalid_kimai_project_id`, `already_linked`, `override_exists_for_project`.
- Toasts on success/error; debug JSON gated by `DEV`.

## Access Control (UI)
- MVP: gate the create button behind roles: `hr`, `directors`, `admins`.
- Future: add an endpoint to fetch effective permissions and gate by `prospective:create`.

## Acceptance Criteria
- Users with `hr|directors|admins` see and can use `New Prospective Project` on Projects.
- `POST /api/prospective` returns 201; UI toasts and clears form.
- (Phase 2) Prospective tab lists items; link action works with correct permissions.

## Notes
 - Atlas‑native rows are stored with `is_prospective=1` and `kimai_project_id=NULL`.
- Status list is read‑only and sourced from the non‑admin endpoint.
 - Mixed list semantics: the Projects page uses `GET /api/projects?includeProspective=1` and shows both types with an `origin` badge (Kimai vs Prospective). Prospective rows use negative virtual ids.
