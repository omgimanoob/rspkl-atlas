import { mergeProjectFields } from '../../src/services/api/overridesMerge';

describe('mergeProjectFields', () => {
  it('upstream + null override -> upstream', () => {
    const up = { money_collected: 100, status: 'active', is_prospective: false };
    const ov = { money_collected: null, status: null, is_prospective: null } as any;
    const res = mergeProjectFields(up, ov);
    expect(res.money_collected).toBe(100);
    expect(res.status).toBe('active');
    expect(res.is_prospective).toBe(false);
  });

  it('upstream + non-null override -> override', () => {
    const up = { money_collected: 100, status: 'active', is_prospective: false };
    const ov = { money_collected: 200, status: 'tender', is_prospective: 1 };
    const res = mergeProjectFields(up, ov);
    expect(res.money_collected).toBe(200);
    expect(res.status).toBe('tender');
    expect(res.is_prospective).toBe(true);
  });

  it('no upstream + non-null override -> override', () => {
    const up = { money_collected: null, status: null, is_prospective: null };
    const ov = { money_collected: 50, status: 'design', is_prospective: 0 };
    const res = mergeProjectFields(up, ov);
    expect(res.money_collected).toBe(50);
    expect(res.status).toBe('design');
    expect(res.is_prospective).toBe(false);
  });

  it('both null -> null', () => {
    const up = { money_collected: null, status: null, is_prospective: null };
    const ov = { money_collected: null, status: null, is_prospective: null };
    const res = mergeProjectFields(up, ov);
    expect(res.money_collected).toBeNull();
    expect(res.status).toBeNull();
    expect(res.is_prospective).toBeNull();
  });
});

