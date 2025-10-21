import { validateProspectiveConsistency } from '../../src/services/validators/projectConsistency'

describe('validateProspectiveConsistency', () => {
  it('requires atlas-native to be prospective (1)', () => {
    const res = validateProspectiveConsistency(null, 1)
    expect(res.ok).toBe(true)
  })
  it('rejects atlas-native when is_prospective != 1', () => {
    const res = validateProspectiveConsistency(null, 0)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('atlas_native_must_be_prospective')
  })
  it('rejects kimai-backed when is_prospective != 0', () => {
    const res = validateProspectiveConsistency(123, 1)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('kimai_backed_cannot_be_prospective')
  })
  it('allows kimai-backed when is_prospective = 0', () => {
    const res = validateProspectiveConsistency(123, 0)
    expect(res.ok).toBe(true)
  })
})
