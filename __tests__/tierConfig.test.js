import {
  TIER_FREE, TIER_PRO, TIER_PROMAX, TIER_LIMITS,
  resolveTier, getTierLimits, hasFeature, canAdd, limitText,
} from '../lib/tierConfig';

describe('resolveTier', () => {
  it('defaults to free for empty/undefined metadata', () => {
    expect(resolveTier(undefined)).toBe(TIER_FREE);
    expect(resolveTier({})).toBe(TIER_FREE);
  });

  it('reads the new `tier` field', () => {
    expect(resolveTier({ tier: 'pro' })).toBe(TIER_PRO);
    expect(resolveTier({ tier: 'promax' })).toBe(TIER_PROMAX);
  });

  it('treats legacy is_pro=true as pro', () => {
    expect(resolveTier({ is_pro: true })).toBe(TIER_PRO);
  });

  it('prefers explicit tier over legacy is_pro', () => {
    expect(resolveTier({ is_pro: true, tier: 'promax' })).toBe(TIER_PROMAX);
  });

  it('admins always resolve to promax', () => {
    expect(resolveTier({ tier: 'free' }, true)).toBe(TIER_PROMAX);
  });
});

describe('getTierLimits', () => {
  it('returns the matching limit set', () => {
    expect(getTierLimits(TIER_PRO)).toBe(TIER_LIMITS[TIER_PRO]);
  });

  it('falls back to free limits for unknown tiers', () => {
    expect(getTierLimits('nonsense')).toBe(TIER_LIMITS[TIER_FREE]);
  });

  it('exposes limits for the Maps feature entities', () => {
    expect(TIER_LIMITS[TIER_FREE].storageItems).toBe(200);
    expect(TIER_LIMITS[TIER_FREE].courses).toBe(100);
    expect(TIER_LIMITS[TIER_PROMAX].courses).toBe(Infinity);
  });
});

describe('hasFeature', () => {
  it('gates pro-only features', () => {
    expect(hasFeature(TIER_FREE, 'linkHealthCheck')).toBe(false);
    expect(hasFeature(TIER_PRO, 'linkHealthCheck')).toBe(true);
    expect(hasFeature(TIER_PROMAX, 'linkHealthCheck')).toBe(true);
  });

  it('allows ungated features for everyone', () => {
    expect(hasFeature(TIER_FREE, 'aiSuggest')).toBe(true);
    expect(hasFeature(TIER_FREE, 'doesNotExist')).toBe(true);
  });
});

describe('canAdd', () => {
  it('blocks when at the limit and reports remaining', () => {
    const atLimit = canAdd(TIER_FREE, 'courses', 100);
    expect(atLimit.allowed).toBe(false);
    expect(atLimit.remaining).toBe(0);

    const under = canAdd(TIER_FREE, 'courses', 40);
    expect(under.allowed).toBe(true);
    expect(under.remaining).toBe(60);
  });

  it('always allows on unlimited (promax) tiers', () => {
    const res = canAdd(TIER_PROMAX, 'sites', 9_999_999);
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(Infinity);
  });
});

describe('limitText', () => {
  it('renders Unlimited for Infinity and a localized number otherwise', () => {
    expect(limitText(Infinity)).toBe('Unlimited');
    expect(limitText(1000)).toBe((1000).toLocaleString());
  });
});
