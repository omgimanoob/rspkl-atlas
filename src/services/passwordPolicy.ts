// Simple password strength policy used by both change and reset flows.
// Rules:
// - Minimum length 8
// - Must not be purely numeric
// - Must contain all four character classes: uppercase, lowercase, number, symbol
// - Reject a few obvious common/sequential patterns

const COMMON_WEAK = new Set([
  'password', 'password1', 'passw0rd', 'qwerty', 'letmein', 'admin',
  'welcome', 'iloveyou', 'abc123', '12345678', '123456789', '123123123'
]);

function hasUpper(s: string) { return /[A-Z]/.test(s); }
function hasLower(s: string) { return /[a-z]/.test(s); }
function hasNumber(s: string) { return /[0-9]/.test(s); }
function hasSymbol(s: string) { return /[^A-Za-z0-9]/.test(s); }
function isNumericOnly(s: string) { return /^[0-9]+$/.test(s); }

function looksSequentialNumeric(s: string) {
  // detect repeated blocks like 123123, 11111111, ascending sequences like 12345678
  if (!/^[0-9]+$/.test(s)) return false;
  // repeated same digit
  if (/^(\d)\1{5,}$/.test(s)) return true;
  // repeated block (e.g., 123123, 121212)
  if (/^(\d{2,})\1+$/.test(s)) return true;
  // ascending sequence length >= 5
  const asc = '0123456789';
  return s.length >= 5 && asc.includes(s);
}

export function validatePasswordStrength(pwd: string): { ok: true } | { ok: false; reason: 'weak_password' } {
  const str = String(pwd || '').trim();
  if (str.length < 8) return { ok: false, reason: 'weak_password' };
  const lower = str.toLowerCase();
  if (COMMON_WEAK.has(lower)) return { ok: false, reason: 'weak_password' };
  if (isNumericOnly(str)) return { ok: false, reason: 'weak_password' };
  if (looksSequentialNumeric(str)) return { ok: false, reason: 'weak_password' };
  // Require all four classes
  if (!(hasUpper(str) && hasLower(str) && hasNumber(str) && hasSymbol(str))) {
    return { ok: false, reason: 'weak_password' };
  }
  return { ok: true };
}
