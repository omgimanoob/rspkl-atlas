export function validateProspectiveConsistency(kimaiProjectId: any, isProspective: any): { ok: boolean; reason?: string } {
  const hasKimai = kimaiProjectId !== null && kimaiProjectId !== undefined && kimaiProjectId !== ''
  const pros = isProspective === undefined || isProspective === null ? 0 : Number(isProspective)
  // New Rule 1: Atlas-native (no Kimai id) must be marked prospective (1)
  if (!hasKimai && pros !== 1) return { ok: false, reason: 'atlas_native_must_be_prospective' }
  // New Rule 2: Kimai-backed (has id) must NOT be prospective (0)
  if (hasKimai && pros !== 0) return { ok: false, reason: 'kimai_backed_cannot_be_prospective' }
  return { ok: true }
}
