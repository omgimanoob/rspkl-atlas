export function validatePasswordClient(pwd: string): string | null {
  const s = String(pwd || '')
  if (s.length < 8) return 'Password must be at least 8 characters'
  const lower = s.toLowerCase()
  const common = new Set(['password','password1','qwerty','admin','welcome','abc123','12345678','123456789','123123123'])
  if (common.has(lower)) return 'Password is too common'
  const hasUpper = /[A-Z]/.test(s)
  const hasLower = /[a-z]/.test(s)
  const hasNumber = /[0-9]/.test(s)
  const hasSymbol = /[^A-Za-z0-9]/.test(s)
  const numericOnly = /^[0-9]+$/.test(s)
  if (numericOnly) return 'Password cannot be numbers only'
  if (!(hasUpper && hasLower && hasNumber && hasSymbol)) return 'Include uppercase, lowercase, number, and symbol'
  // very simple sequential numeric detection
  if (/^(\d)\1{5,}$/.test(s) || /^(\d{2,})\1+$/.test(s) || '0123456789'.includes(s)) return 'Password pattern is too simple'
  return null
}
