# Project Payments

Record payments received for Kimai projects, keep a searchable audit trail, and maintain a running total on each project override.

Key points:
- Each payment references a Kimai project (`replica_kimai_projects.id`).
- Fields: id, kimai_project_id, amount, notes, payment_date, created_at, created_by.
- On create/update/delete, recalculate and store total in `project_overrides.money_collected`.
- RBAC controls who can create and view payments.
- UI provides a Payments page with search, sorting, and a create dialog.

## Decisions
- Table name: use `project_overrides` (not `overrides` / `overrides_projects`).
- Aggregation column: `project_overrides.money_collected` already exists; no migration required.
- Scope: only create and list payments (no edit/delete).
- Currency: single currency for all amounts; normal decimal handling.
- Access: any user with `payments:view` can view all payments.

## Implementation Checklist

### Schema
- [ ] Create `project_payments` table
  - [ ] Columns: `id` (PK), `kimai_project_id` (FK to `replica_kimai_projects.id`), `amount` (DECIMAL), `notes` (TEXT), `payment_date` (DATE), `created_at` (TIMESTAMP default now), `created_by` (FK to users)
  - [ ] Indexes: `kimai_project_id`, `payment_date`
- [ ] Add FK `project_payments.kimai_project_id` → `replica_kimai_projects.id`
- [ ] Ensure `project_overrides.money_collected` exists (DECIMAL); add migration if missing

### RBAC and Seeding
- [ ] Add permissions: `payments:create`, `payments:view`
- [ ] Seed permissions and assign to appropriate roles (e.g., Admin, Finance)

### Backend: Validation and Logic
- [ ] Pre-insert validation: referenced `kimai_project_id` exists AND has a matching record in `project_overrides`
- [ ] Validate inputs: amount (numeric; allow negatives), payment_date (required), notes (optional)
- [ ] On create: recalc sum of payments for the project and update `project_overrides.money_collected`
  - [ ] Perform create + aggregate update in a single transaction
- [ ] If supporting edit/delete: recalc aggregate after change

### API Endpoints
- [ ] `POST /api/payments` (create)
  - [ ] Body: `kimai_project_id`, `amount`, `payment_date`, `notes`
  - [ ] AuthZ: require `payments:create`
- [ ] `GET /api/payments` (list + search/sort/pagination)
  - [ ] Search text matches: `replica_kimai_projects.comment`, `project_overrides.notes`, `replica_kimai_projects.name`
  - [ ] Include joins to return project name, comment, and overrides notes
  - [ ] AuthZ: require `payments:view`
- [ ] (Optional) `PATCH /api/payments/:id`, `DELETE /api/payments/:id` with corresponding recalc

### Search
- [ ] Implement combined search across:
  - [ ] `replica_kimai_projects.comment`
  - [ ] `project_overrides.notes`
  - [ ] `replica_kimai_projects.name`
- [ ] Add indexes if needed to keep queries fast

### Client: Navigation
- [ ] Add “Payments” to the sidebar; link to Payments page

### Client: Payments Page
- [ ] Use `client/src/pages/ProjectsV2.tsx` as layout/design reference
- [ ] Controls
  - [ ] “Enter payment” button (like “New Prospective”)
  - [ ] “Customize Columns” with persisted preferences (e.g., `payments:cols` in localStorage)
  - [ ] Search textbox; Enter submits; no separate Search button
- [ ] Table columns (initial suggestions)
  - [ ] Project ID (Kimai)
  - [ ] Project Name
  - [ ] Amount
  - [ ] Payment Date
  - [ ] Notes
  - [ ] Created By (optional)
  - [ ] Created At (optional)
- [ ] Sortable column headers with icons consistent with ProjectsV2

### Client: Create Payment Dialog
- [ ] Date picker: Payment received date (required)
- [ ] Searchable dropdown for project selection (source = `project_overrides` joined to Kimai projects)
  - [ ] Single textbox filters across `replica_kimai_projects.comment`, `project_overrides.notes`, `replica_kimai_projects.name`
- [ ] Amount input (allow negative)
- [ ] Notes textbox
- [ ] Save button with disabled/loading state and validation messages

### Service Layer
- [ ] Payment service to encapsulate CRUD and aggregate updates
- [ ] Ensure transactional behavior around create/edit/delete + aggregate recalc

### Data Consistency
- [ ] Prevent orphan rows if Kimai project is removed (FK constraints or guarded delete)
- [ ] (Optional) Backfill script to recompute `money_collected` from existing payments

### Testing
- [ ] Unit tests: create payment validations; aggregate update correctness
- [ ] API tests: create/list, search behavior, permissions
- [ ] UI tests (manual or automated): create flow, search, sorting, column toggles

### Documentation
- [ ] Update this doc with finalized schema, endpoints, and screenshots/flows
- [ ] Document permissions model, refund handling (negative amounts), reconciliation practices

## UI Notes (from initial spec)
- Payments appears in the sidebar and links to the Payments page.
- Payments page mimics ProjectsV2 page patterns (toolbar, table, sorting, column customize).
- Search covers Kimai project comment, override notes, and Kimai project name.
- Create Payment dialog includes: date picker, searchable project dropdown (comment/notes/name), amount (negative acceptable), notes, Save.
