export type ProjectUpstream = {
  money_collected?: number | null;
  status?: string | null;
  is_prospective?: boolean | number | null;
};

export type ProjectOverride = {
  money_collected?: number | null;
  status?: string | null;
  is_prospective?: boolean | number | null;
} | null;

export function mergeProjectFields(upstream: ProjectUpstream, override: ProjectOverride) {
  const ov = override || {};
  const upstreamProspective = upstream.is_prospective;
  const overrideProspective = ov.is_prospective;

  const pick = <T>(upVal: T | null | undefined, ovVal: T | null | undefined): T | null => {
    if (ovVal !== undefined && ovVal !== null) return ovVal;
    if (upVal !== undefined && upVal !== null) return upVal;
    return null as any;
  };

  return {
    money_collected: pick(upstream.money_collected ?? null, ov.money_collected ?? null),
    status: pick(upstream.status ?? null, ov.status ?? null),
    is_prospective: pick(
      normalizeBool(upstreamProspective),
      normalizeBool(overrideProspective)
    ),
  };
}

function normalizeBool(v: boolean | number | null | undefined): boolean | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return v ? true : false;
  return v;
}

