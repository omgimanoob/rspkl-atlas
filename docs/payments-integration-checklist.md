# Payments Integration Checklist

Goal: Enhance Payments and Projects V2 to manage payments cleanly, make money_collected read-only and derived, and add convenient entry points to view/enter payments.

## Payments Page (/payments)
- [x] Add Created By column: show `users.display_name` (fallback to email) for `project_payments.created_by`.
- [x] Row click opens View Payment dialog with: Project ID/Name, Amount, Date, Notes, Created By, Created At.
- [x] Extract Enter Payment dialog to a reusable component `PaymentDialog`.
- [x] Project picker UX inside dialog:
  - [x] Search box appears above options.
  - [x] Filter options as the user types (client-side and server search).
  - [x] Ensure long notes/comments are truncated within the dialog; list scrolls instead of overflowing.
- [x] Support linking into Payments with a project filter (e.g., `?kimai=123`).

## Projects V2 Table
- [x] Show Money Collected column after Status.
- [x] Actions menu additions:
  - [x] Enter Payment: opens reusable PaymentDialog with project preselected.
  - [x] Recalculate: sums `project_payments` and updates `project_overrides.money_collected` for that project.

## Update Overrides Dialog (Kimai)
- [x] Make Money Collected read-only (disabled UI field).
- [x] Stop accepting `money_collected` updates in API controllers (ignore or reject input). (Both v2 and legacy /overrides now reject)
- [x] Provide Recaculate button to recompute and update `money_collected`.
- [x] Provide quick link to Payments page filtered for this project.
- [x] Provide Enter Payment button that opens reusable PaymentDialog preselecting the project.

## Backend
- [x] Payments list includes `created_by_display` via LEFT JOIN on `users`.
- [x] Support filter by `kimai_project_id` (query `kimai=` param) in list API.
- [x] Add `POST /payments/recalc/:kimaiId` to recompute and persist `money_collected`.
- [x] Ensure v2 overrides update ignores (or rejects) `money_collected` field.

## Client API
- [x] Add `api.payments.recalc(kimaiId)`.
- [x] Extend `api.payments.list()` types to include `created_by_display` and support `kimai` filter.

## Nice-to-haves (later)
- [x] Pagination UI consistent with Projects V2.
- [ ] Indexes for payments search (notes, created_by) if needed for performance.

## Next Steps
- [ ] Tests: add integration tests for payments list filter, recalc endpoint, and legacy /overrides rejection.
- [ ] UI polish: debounce search in PaymentDialog; show selected project summary; add keyboard navigation in list.
- [ ] Accessibility: aria labels for PaymentDialog list and view dialog.
- [ ] Docs: add short usage blurb to README and link from Projects V2.
