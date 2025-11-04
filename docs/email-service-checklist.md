# Email Service Implementation Checklist

Actionable tasks to introduce a minimal, production-safe email delivery service with environment-driven configuration. Supports disabling via `MAILER_URL=null://null`.

## Phase 1 – Configuration & Parsing
- [x] Add environment variables in `.env` (documented in README):
  - [x] `MAILER_FROM` (e.g., `timesheet@rspkl.com` or `Display Name <timesheet@rspkl.com>`) 
  - [x] `MAILER_FROM_NAME` (optional; combines with `MAILER_FROM` as `Name <address>`) 
  - [x] `MAILER_URL` (e.g., `smtp://timesheet%40rspkl.com:MYPASSWORD@mail.rspkl.com:587?verify_peer=0`)
  - [x] Disable delivery via `MAILER_URL=null://null`
- [x] Implement config parser:
  - [x] Accept URL formats: `smtp://user:pass@host:port?verify_peer=0|1` and `null://null`
  - [x] Percent-decoding of user info (e.g., `%40` → `@`)
  - [x] TLS options: map `verify_peer=0` → `tls: { rejectUnauthorized: false }`
  - [ ] Validate `MAILER_FROM` format (basic email regexp)
  - [x] Sanitize logs (never print credentials)

## Phase 2 – Mailer Abstraction
- [x] Create `src/services/mailer.ts` exporting an interface:
  - [x] `send({ to, subject, text?, html?, from? })`
  - [x] `isEnabled(): boolean`
- [x] Implement providers:
  - [x] `NullMailer` (for `MAILER_URL=null://null`): logs/metrics only; no-op send
  - [x] `SmtpMailer` using Nodemailer SMTP transport with parsed options (graceful degrade if not installed)
  - [x] `DevLogMailer` using `dev://log` to console-log emails
- [x] Factory: `createMailerFromEnv()` that returns the correct implementation
- [ ] Add lightweight health check method `verify()` for SMTP (optional, used in `/healthz`)

## Phase 3 – Integration Points
- [x] Password reset: send reset emails when not in test
  - [x] Hook into `AuthService.requestPasswordReset(email, origin)` to call `mailer.send()`
  - [x] Subject: `Reset your RSPKL Atlas password`
  - [x] Body: include secure link; avoid leaking sensitive context
- [ ] Optional notifications
  - [ ] Admin: notify on RBAC admin mutations (feature-flagged)
  - [ ] Alert on repeated 403 denials spikes (future)

## Phase 4 – Observability & Error Handling
- [x] Metrics
  - [x] `mail.sent.success`
  - [x] `mail.sent.fail`
  - [x] `mail.disabled` (increment when `NullMailer` is used)
- [x] Audit/logging
  - [x] Log one-liners: to, subject, provider (no content, no secrets)
  - [ ] Log warnings for transient failures with reason code (throttled)
- [ ] Retries/backoff (optional)
  - [ ] Simple retry with limited attempts for SMTP transient errors

## Phase 5 – Security & Privacy
- [x] Never log `MAILER_URL` or credentials; mask sensitive fields in errors
- [x] Enforce `from` to default to `MAILER_FROM` (override only if explicit and allowed)
- [x] Support plaintext + HTML bodies
- [ ] Strip or sanitize dangerous HTML if templates are dynamic
- [ ] Ensure DSNs/timeouts are conservative to avoid hanging requests (e.g., 10s)

## Phase 6 – Developer Ergonomics
- [x] Add a `dev://log` pseudo-URL to log emails to console without SMTP (optional)
  - [ ] Provide a small helper `sendPasswordResetEmail(to, link)` in `mailer.ts`
  - [ ] README section with examples and `.env` snippet (include MAILER_FROM_NAME and `npm run mail:test`)
- [x] Add an npm script to send a test email to `DEVELOPER_EMAIL` (from `.env`) via SMTP if configured, e.g. `npm run mail:test`

---

## Testing Checklist

Unit Tests
- [x] Config parser
  - [x] Parses SMTP URL with percent-encoded user
  - [x] Maps `verify_peer=0` → `rejectUnauthorized: false`
  - [x] `MAILER_URL=null://null` selects `NullMailer`
  - [ ] Invalid URL or missing host → throws configuration error
- [x] Mailer factory
  - [x] Returns `NullMailer` when disabled
  - [ ] Returns `SmtpMailer` when `MAILER_URL` is smtp (mock nodemailer)

Integration Tests
- [ ] Null mode
  - [ ] With `MAILER_URL=null://null`, calls to `mailer.send` are no-op and increment `mail.disabled`
- [ ] SMTP mode (mock)
  - [ ] Stub Nodemailer transport `sendMail` to resolve; assert success metrics/logs
  - [ ] Stub to reject transient error; assert failure metrics/logs
- [ ] Password reset flow
  - [ ] When enabled, calling request reset triggers `mailer.send` with expected to/subject
  - [ ] When disabled (`null://null`), flow still returns 200 and does not throw

Performance/Resilience
- [ ] Verify `verify()` health check does not block app startup
- [ ] Timeouts set and honored (no hangs)

---

## .env Examples

Production SMTP
```
MAILER_FROM=timesheet@rspkl.com
MAILER_FROM_NAME=RSPKL Timesheets
MAILER_URL=smtp://timesheet%40rspkl.com:MYPASSWORD@mail.rspkl.com:587?verify_peer=0
```

Disable mailer (no-op)
```
MAILER_URL=null://null
```

(Optional) Dev log mode (if implemented)
```
MAILER_URL=dev://log
```

Test send
```
DEVELOPER_EMAIL=you@example.com
npm run mail:test
```

Notes
- Use `%40` to encode `@` in usernames inside URLs.
- Do not commit real SMTP passwords.
- `verify_peer=0` disables TLS peer verification; use only if required by your SMTP server.
