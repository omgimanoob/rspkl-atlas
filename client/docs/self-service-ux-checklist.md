# UI/UX Checklist — User Self‑Service

Scope: Design and implement client flows for a signed‑in user to manage their own profile and password, and for signed‑out password reset flows.

## Phase 1 — Pages & Navigation
- [x] Add a Profile page (`/account`) under the authenticated shell.
- [x] Link to Profile from the user menu (AppSidebar → NavUser dropdown).
- [ ] Keep Profile read‑only by default with Edit actions per section. (Current: inline editing with Save.)
  - [x] Sidebar shows `display_name` when available.

## Phase 2 — Profile (Display Name)
- [x] Show current user: email (read‑only), display name (editable).
- [x] Inline input with Save to update display name.
- [x] Save via `PUT /me` body `{ display_name }`; UI updates on success.
- [x] Disable save button while pending; show success/error toasts.
- [~] Validation: trim; allow blank to keep current. (Enhance to enforce non‑empty when required.)
  - [x] Prevent sending empty updates (no‑op) from UI.

## Phase 3 — Change Password (Authenticated)
- [x] Change Password section on Profile.
- [x] Form fields: `current_password`, `new_password`, `confirm_password`.
- [x] Save via `POST /me/password`.
- [x] Client‑side validation: required, min length (>= 8), confirmation match.
- [x] Server error mapping: `invalid_current_password`, `weak_password` → friendly messages.
- [x] Wrap inputs in `<form>`; proper `autocomplete`/`name` per field; hidden `username` input for password managers.
- [x] Enforce strong password policy (uppercase + lowercase + number + symbol) on both client and server.
- [x] UX: add password visibility toggles and strength/requirements hint.

## Phase 4 — Password Reset (Signed‑out)
- [x] Add a “Forgot password?” link on the Login page → `/reset/request`.
- [x] Reset Request page: single email field; call `POST /auth/password-reset/request`.
- [x] Show success state regardless of account existence (no enumeration).
- [x] Reset Confirm page `/reset?token=…`: fields `new_password`, `confirm_password`.
- [x] Call `POST /auth/password-reset/confirm` with `{ token, new_password }`.
- [x] Handle errors: `invalid_token`, `token_used`, `token_expired`, `weak_password`.
- [x] Success → route to Login with success toast.

## Phase 5 — API Integration
- [x] API methods:
  - [x] `api.me()` — GET `/me`.
  - [x] `api.updateMe({ display_name })` — PUT `/me`.
  - [x] `api.changePassword({ current_password, new_password })` — POST `/me/password`.
  - [x] `api.requestPasswordReset({ email })` — POST `/auth/password-reset/request`.
  - [x] `api.confirmPasswordReset({ token, new_password })` — POST `/auth/password-reset/confirm`.
- [x] Ensure `credentials: 'include'` is set (already in api wrapper).
- [x] Avoid conditional 304 by using `cache: 'no-store'` in fetch.
- [x] Add structured error parsing helper (`extractApiReason`) for `{ error, reason }` payloads.
- [x] Add centralized 401 handler (session expiry) to prompt re‑login.

## Phase 6 — UX, States, and Feedback
- [x] Loading state for Profile; disable buttons during save.
- [x] Success toasts; error mapping to inline messages (both Change Password and Reset Confirm).
- [x] Map backend error reasons to inline messages consistently.
- [x] Rate‑limit copy for 429 (reset request).
- [x] Consistent spacing, labels, and button ordering.
  - [x] Add `autocomplete` attributes to login and account forms to remove console warnings.

## Phase 7 — Security & Privacy
- [x] Do not auto‑fill or log sensitive fields (passwords/tokens).
- [x] Use `type="password"` with optional visibility toggle.
- [x] Never display whether an email exists during reset request.
- [x] Ensure redirect after reset does not leak token in referrer (new navigation).
- [~] Respect SameSite/HttpOnly cookie constraints from server (enforced server‑side; client honors cookie flow).
  - [x] Use proper `autocomplete` tokens (`current-password`/`new-password`/`username`).

## Phase 8 — Accessibility
- [x] Labels tied to inputs; aria‑describedby for hints/errors (Profile/Change Password).
- [ ] Keyboard navigation: focus management on dialog open/close.
  - [ ] Verify focus trap and return on shadcn/Dialog when opening Save flow.
  - [ ] Ensure Escape closes dialog and focus returns to triggering button.
- [ ] Sufficient color contrast and visible focus states.
  - [ ] Audit primary/outline Button focus rings on dark and light backgrounds.
  - [ ] Ensure Input focus is clearly visible (meets WCAG 2.1 AA).
- [ ] Announce success/error via ARIA live regions or toast role attributes.
  - [ ] Add a visually hidden `<div role="status" aria-live="polite">` in the app shell for success messages.
  - [ ] Map error to `role="alert"` with `aria-live="assertive"` or pass `role` to toast component.

Acceptance Criteria
- Tabbing cycles within modal content until closed; Shift+Tab works.
- Visible focus ring on all focusable controls (Inputs, Buttons, Links, Selects).
- Screen reader announces “Password changed” and reset successes; inline field errors are read when focusing fields.

## Phase 9 — Testing
- [ ] Manual sanity: edit name, change password, request+confirm reset.
  - [ ] Edit display name → Save → visible immediately in sidebar and on /account.
  - [ ] Change password (valid) → success toast and inline cleared errors.
  - [ ] Request reset → success copy regardless of account existence.
  - [ ] Confirm reset with token → success then redirect to Login.
- [ ] Edge: wrong current password, weak password, expired/used token.
  - [ ] Show inline error under the appropriate field.
  - [ ] Strong policy enforced on both flows (upper+lower+number+symbol).
- [ ] Verify no account enumeration (always success on request).
- [ ] Verify rate limit copy appears on 429.
- [ ] Deep-link URLs `/reset?token=…` and `/account` load as SPA routes (history fallback in prod).

## Phase 11 — Password Reset UI
- [x] Add `Forgot password?` link on Login to `/reset/request`.
- [x] Reset Request page: submit email to `POST /auth/password-reset/request`; always show success state.
- [x] Reset Confirm page `/reset?token=…`: form for `new_password` + confirmation; submit to `POST /auth/password-reset/confirm`.
- [x] Error handling for `invalid_token`, `token_used`, `token_expired`, `weak_password` with toasts.
- [x] Success → route to Login with toast.

## Phase 12 — SPA Deep‑Linking & Dev Ergonomics
- [x] Public router entries for `/reset/request` and `/reset` so deep links resolve pre‑auth.
- [x] Client path normalization to collapse duplicate slashes (e.g., `//reset/request`).
- [x] Backend auto‑downgrades `https://localhost` to `http://localhost` for `APP_BASE_URL` in non‑prod to avoid TLS errors in dev.
- [x] Document production rewrites (history API fallback) to ensure `/reset` serves the SPA index.html. See `client/docs/spa-history-fallback.md`.

---

Next Steps
- [ ] Phase 1: Consider read‑only Profile with explicit Edit actions (accessibility + UX clarity).
- [ ] Phase 8: Keyboard focus management and ARIA live updates for toasts (announce changes).
- [ ] Phase 8: Validate color contrast and visible focus for custom components.
- [ ] Phase 9: Execute manual test pass; capture gifs/screens for QA.
- [ ] Phase 12: Add hosting‑specific history fallback docs (Nginx, Netlify/Vercel, etc.).

## Phase 10 — Optional Enhancements
- [~] Password requirements checklist implemented; strength meter optional.
- [ ] Two‑step confirmation (re‑enter current password) for sensitive actions.
- [ ] Client‑side throttling for reset requests to reduce hammering.
- [ ] Link to support or escalation if reset fails repeatedly.

## References
- Server endpoints are documented in `README.md` and `quick-sanity-tests.md`.
- Backend behavior (rate limits, error codes) in `src/controllers/selfController.ts`.
