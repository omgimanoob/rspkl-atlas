# UI Migration Checklist — Project Status via `status_id`

Goal: Move the client from free-text `status` updates to using `status_id` from the server lookup (`/admin/statuses`) while keeping status names visible in the UI.

## Phase 1 — API Layer
- [x] Add `api.listStatuses(): GET /admin/statuses` (returns `{ id, name, code, is_active, sort_order }[]`).
- [x] Add `api.updateProjectStatusById(id, statusId)` to send `{ id, status_id }` (non-breaking addition).
- [x] Add `api.updateProjectOverridesById(id, { statusId?, moneyCollected?, isProspective? })` to send `{ id, status_id, money_collected, is_prospective }`.
- [x] Keep legacy string-based methods temporarily (marked deprecated) to avoid breaking the UI until Phase 4.

## Phase 2 — Data Shape + State
- [x] Extend `ProjectRow` to include optional `statusId?: number` for editing convenience.
- [x] Load statuses in ProjectsTable (initial pass); consider lifting to context for reuse.
- [x] Map `statusId` ↔ `status` name as needed for display and form defaults.

## Phase 3 — UI Controls (ProjectsTable)
- [x] Replace hardcoded status list with options from `api.listStatuses()` (filter `is_active === 1`).
- [x] Track `editStatusId` (number) instead of `editStatus` (string); show the selected option’s name.
- [x] Default `editStatusId` from row.statusId when present, else infer from row.status name.
- [x] On Save, call `onSaveOverrides({ id, statusId, moneyCollected, isProspective })`.

## Phase 4 — Pages Wiring
- [x] Update `Projects.tsx` and `Dashboard.tsx` save handlers to accept `statusId` and call new API shapes.
- [x] After save, refresh the edited row from response; use returned `status` (name) for display and set `statusId` from response if present.

## Phase 5 — Access & Fallbacks
- [ ] Confirm read access to `/admin/statuses` for non-admin editors (HR/Directors). If not available, either:
  - [ ] Expose a read-only public/authorized endpoint for statuses, or
  - [ ] Cache status list client-side (seeded via build or env) and periodically refresh when admin cookie is present.
- [ ] Handle empty or failed status fetch (disable selector and show hint).

## Phase 6 — UX & Validation
- [ ] Disable inactive statuses (`is_active === 0`) in the selector or hide them.
- [ ] Show friendly error toasts when server returns `status_id_required` or `invalid_status_id`.
- [ ] Preserve money formatting and input validation.

## Phase 7 — Testing & Verification
- [ ] Manual sanity: edit status via selector → request sends `status_id` → server responds 200 → table shows updated status name.
- [ ] Regression: editing money/prospective without changing status still works.
- [ ] Error path: simulate invalid `status_id` (e.g., 404/400) and verify UI messaging.

## Phase 8 — Cleanup
- [ ] Remove dead code: hardcoded status arrays, string-based status setters.
- [ ] Update README/quick-sanity docs to mention UI now uses lookup for status.
- [ ] Optional: centralize statuses in a small client store/context for reuse and future admin screen.

Notes
- Server denormalizes `status` (name) from `status_id`. The client should treat `status` as display-only and always send `status_id` on writes.
- If later we expose more status metadata (color, category), extend the selector UI accordingly.
