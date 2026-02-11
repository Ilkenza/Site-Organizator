/**
 * @fileoverview Tier configuration for Free / Pro / Pro Max plans.
 * Single source of truth for limits and feature gates.
 *
 * Tier values stored in user_metadata.tier:
 *   - undefined / 'free'  → Free
 *   - 'pro'               → Pro
 *   - 'promax'            → Pro Max
 *
 * Legacy: user_metadata.is_pro === true is treated as 'pro'.
 * Admins always get 'promax' level access.
 */

// ─── Tier keys ─────────────────────────────────────────────────────────────────
export const TIER_FREE = 'free';
export const TIER_PRO = 'pro';
export const TIER_PROMAX = 'promax';

export const TIERS = [TIER_FREE, TIER_PRO, TIER_PROMAX];

// ─── Display info ──────────────────────────────────────────────────────────────
export const TIER_LABELS = {
    [TIER_FREE]: 'Free',
    [TIER_PRO]: 'Pro',
    [TIER_PROMAX]: 'Pro Max',
};

export const TIER_COLORS = {
    [TIER_FREE]: { bg: 'bg-gray-500/20', text: 'text-gray-400', badge: 'FREE' },
    [TIER_PRO]: { bg: 'bg-gradient-to-r from-amber-500/20 to-transparent', text: 'text-amber-400', badge: 'PRO' },
    [TIER_PROMAX]: { bg: 'bg-gradient-to-r from-purple-500/20 to-transparent', text: 'text-purple-400', badge: 'PRO MAX' },
};

// ─── Limits per tier ───────────────────────────────────────────────────────────
export const TIER_LIMITS = {
    [TIER_FREE]: { sites: 1000, categories: 100, tags: 300, aiSuggestsPerMonth: 30 },
    [TIER_PRO]: { sites: 10000, categories: 500, tags: 1000, aiSuggestsPerMonth: 500 },
    [TIER_PROMAX]: { sites: Infinity, categories: Infinity, tags: Infinity, aiSuggestsPerMonth: Infinity },
};

// ─── Feature gates ─────────────────────────────────────────────────────────────
// Minimum tier required for each feature
export const FEATURE_GATES = {
    aiSuggest: TIER_FREE,      // AI category/tag/pricing suggestions (free: 10/mo)
    linkHealthCheck: TIER_PRO, // Link health check in settings
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve tier string from user_metadata (handles legacy is_pro boolean) */
export function resolveTier(userMetadata, isAdmin = false) {
    if (isAdmin) return TIER_PROMAX;
    const meta = userMetadata || {};
    // New field: tier
    if (meta.tier === TIER_PROMAX) return TIER_PROMAX;
    if (meta.tier === TIER_PRO) return TIER_PRO;
    // Legacy: is_pro boolean → treat as 'pro'
    if (meta.is_pro === true && !meta.tier) return TIER_PRO;
    return TIER_FREE;
}

/** Get limits for a tier */
export function getTierLimits(tier) {
    return TIER_LIMITS[tier] || TIER_LIMITS[TIER_FREE];
}

/** Check if a feature is available for a given tier */
export function hasFeature(tier, featureKey) {
    const requiredTier = FEATURE_GATES[featureKey];
    if (!requiredTier) return true; // no gate = available to all
    const tierOrder = { [TIER_FREE]: 0, [TIER_PRO]: 1, [TIER_PROMAX]: 2 };
    return (tierOrder[tier] || 0) >= (tierOrder[requiredTier] || 0);
}

/** Check if user can add more items of a type */
export function canAdd(tier, type, currentCount) {
    const limits = getTierLimits(tier);
    const limit = limits[type];
    if (limit === Infinity) return { allowed: true, remaining: Infinity, limit };
    const remaining = Math.max(0, limit - currentCount);
    return { allowed: currentCount < limit, remaining, limit };
}

/** Get human-readable limit text */
export function limitText(limit) {
    return limit === Infinity ? 'Unlimited' : limit.toLocaleString();
}
