/**
 * @fileoverview Admin Dashboard page — Full-featured admin panel
 * Features: Stats, Growth Chart, Pricing Chart, Sites/User Stats, Most Active Users,
 * Popular Domains, Duplicate Sites, Empty Accounts, Recent Activity, Broken Links,
 * Export CSV, User List with Ban/Delete, Top Categories/Tags
 * Protected: only accessible to emails listed in NEXT_PUBLIC_ADMIN_EMAILS env var
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { SearchIcon, CrownIcon, StarIcon, ShieldCheckIcon, BanIcon, TrashIcon, RefreshIcon } from '../components/ui/Icons';
import { TIER_FREE, TIER_PRO, TIER_PROMAX, TIER_LABELS, TIER_COLORS } from '../lib/tierConfig';

// ========================================
// Constants
// ========================================
const REFRESH_INTERVAL = 60000;
const TABS = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'users', label: 'Users', icon: '👥' },
    { key: 'content', label: 'Content', icon: '🌐' },
    { key: 'tools', label: 'Tools', icon: '🔧' },
];

// ========================================
// Helper: Get auth token
// ========================================
async function getToken() {
    const session = await supabase.auth.getSession();
    return session?.data?.session?.access_token;
}

// ========================================
// Stat Card
// ========================================
function StatCard({ label, value, icon, color = 'blue', subtitle }) {
    const colors = {
        blue: 'from-blue-600/20 to-blue-900/10 border-blue-500/30',
        green: 'from-emerald-600/20 to-emerald-900/10 border-emerald-500/30',
        purple: 'from-purple-600/20 to-purple-900/10 border-purple-500/30',
        amber: 'from-amber-600/20 to-amber-900/10 border-amber-500/30',
        rose: 'from-rose-600/20 to-rose-900/10 border-rose-500/30',
        cyan: 'from-cyan-600/20 to-cyan-900/10 border-cyan-500/30',
        indigo: 'from-indigo-600/20 to-indigo-900/10 border-indigo-500/30',
        teal: 'from-teal-600/20 to-teal-900/10 border-teal-500/30',
    };

    return (
        <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-4 sm:p-5 transition-all hover:scale-[1.02]`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-app-text-muted text-[10px] sm:text-xs uppercase tracking-wider font-medium">{label}</p>
                    <p className="text-2xl sm:text-3xl font-bold text-app-text-primary mt-1">
                        {typeof value === 'number' ? value.toLocaleString() : value ?? '—'}
                    </p>
                    {subtitle && <p className="text-app-text-muted text-[10px] mt-0.5">{subtitle}</p>}
                </div>
                <span className="text-2xl sm:text-3xl opacity-60">{icon}</span>
            </div>
        </div>
    );
}

// ========================================
// Top Items List (Categories / Tags)
// ========================================
function TopItemsList({ items }) {
    if (!items?.length) return <p className="text-app-text-muted text-sm">No data</p>;
    return (
        <div className="space-y-2">
            {items.map((item, i) => (
                <div key={`${item.name}-${i}`} className="flex items-center gap-3 group">
                    <span className="text-app-text-muted text-xs w-5 text-right">{i + 1}.</span>
                    <span className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-white/10"
                        style={{ backgroundColor: item.color || '#667eea' }} />
                    <span className="text-app-text-primary text-sm flex-1 truncate">{item.name}</span>
                    <span className="text-app-text-muted text-xs bg-app-bg-light px-2 py-0.5 rounded-full">
                        {item.usage} {item.usage === 1 ? 'site' : 'sites'}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ========================================
// Pricing Donut Chart
// ========================================
const PRICING_CONFIG = [
    { key: 'fully_free', label: 'Fully Free', color: '#10b981', icon: '✓' },
    { key: 'freemium', label: 'Freemium', color: '#3b82f6', icon: '◐' },
    { key: 'free_trial', label: 'Free Trial', color: '#f59e0b', icon: '⏱' },
    { key: 'paid', label: 'Paid', color: '#ef4444', icon: '$' }
];

function PricingChart({ data }) {
    if (!data) return null;
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    if (total === 0) return <p className="text-app-text-muted text-sm">No sites yet</p>;

    const size = 120, strokeWidth = 24;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    const segments = PRICING_CONFIG.map(p => ({ ...p, count: data[p.key] || 0 })).filter(p => p.count > 0);

    return (
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
            <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
                    {segments.map(seg => {
                        const pct = seg.count / total;
                        const dashLength = pct * circumference;
                        const el = (
                            <circle key={seg.key} cx={size / 2} cy={size / 2} r={radius} fill="none"
                                stroke={seg.color} strokeWidth={strokeWidth}
                                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                                strokeDashoffset={-offset} className="transition-all duration-500" />
                        );
                        offset += dashLength;
                        return el;
                    })}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-app-text-primary">{total}</span>
                </div>
            </div>
            <div className="space-y-2 flex-1">
                {PRICING_CONFIG.map(p => {
                    const count = data[p.key] || 0;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                        <div key={p.key} className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                            <span className="text-app-text-secondary text-xs flex-1">{p.icon} {p.label}</span>
                            <span className="text-app-text-primary text-xs font-semibold">{count}</span>
                            <span className="text-app-text-muted text-[10px] w-8 text-right">{pct}%</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ========================================
// Growth Chart
// ========================================
const GROWTH_PERIODS = [
    { key: 'hourly', label: '24 Hours', short: '24h', icon: '🕐' },
    { key: 'daily', label: '30 Days', short: '30d', icon: '📅' },
    { key: 'monthly', label: '12 Months', short: '12m', icon: '📊' },
    { key: 'yearly', label: 'All Years', short: 'All', icon: '📈' },
];

function GrowthChart({ data, period, onPeriodChange }) {
    const chartData = data?.[period] || [];
    if (!chartData.length) return <p className="text-app-text-muted text-sm">No data</p>;
    // Use cumulative totals for chart bars (real growth curve)
    const hasCumulative = chartData[0]?.totalUsers !== undefined;
    const maxVal = hasCumulative
        ? Math.max(...chartData.map(d => Math.max(d.totalUsers || 0, d.totalSites || 0)), 1)
        : Math.max(...chartData.map(d => Math.max(d.users, d.sites)), 1);
    const newUsers = chartData.reduce((s, d) => s + d.users, 0);
    const newSites = chartData.reduce((s, d) => s + d.sites, 0);
    const lastEntry = chartData[chartData.length - 1];
    const cumulativeUsers = lastEntry?.totalUsers ?? newUsers;
    const cumulativeSites = lastEntry?.totalSites ?? newSites;
    // Helper to get bar values
    const getBarUsers = (d) => hasCumulative ? (d.totalUsers || 0) : d.users;
    const getBarSites = (d) => hasCumulative ? (d.totalSites || 0) : d.sites;

    return (
        <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-blue-500/20 to-blue-900/10 border border-blue-500/30 rounded-xl p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">👥</span>
                        <span className="text-blue-400/70 text-[11px] font-semibold uppercase tracking-wide">Users Adding Sites</span>
                    </div>
                    <p className="text-3xl sm:text-4xl font-bold text-blue-400">{cumulativeUsers.toLocaleString()}</p>
                    {newUsers > 0 && <p className="text-xs text-blue-400/60 mt-1">{newUsers} users added sites this period</p>}
                </div>
                <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-900/10 border border-emerald-500/30 rounded-xl p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🌐</span>
                        <span className="text-emerald-400/70 text-[11px] font-semibold uppercase tracking-wide">Total Sites</span>
                    </div>
                    <p className="text-3xl sm:text-4xl font-bold text-emerald-400">{cumulativeSites.toLocaleString()}</p>
                    {newSites > 0 && <p className="text-xs text-emerald-400/60 mt-1">+{newSites} sites added this period</p>}
                </div>
            </div>

            {/* Period Selector */}
            <div className="grid grid-cols-4 gap-1.5 bg-app-bg-primary rounded-xl p-1.5 border border-app-border/50">
                {GROWTH_PERIODS.map(p => (
                    <button key={p.key}
                        onClick={() => onPeriodChange(p.key)}
                        className={`px-2 py-2.5 sm:py-2 rounded-lg transition-all font-bold flex items-center justify-center gap-1.5 ${period === p.key
                            ? 'bg-gradient-to-r from-app-accent to-blue-500 text-white shadow-lg'
                            : 'text-app-text-muted hover:text-app-text-primary hover:bg-app-bg-light'
                            }`}>
                        <span className="text-sm">{p.icon}</span>
                        <span className="text-xs sm:text-sm">{p.short}</span>
                    </button>
                ))}
            </div>

            {/* Horizontal Bar Chart - works on ALL screen sizes */}
            {/* Mobile/Tablet: Horizontal Bars */}
            <div className="lg:hidden bg-gradient-to-br from-app-bg-primary to-app-bg-light rounded-xl p-3 sm:p-5 border border-app-border/50 space-y-2">
                {chartData.map((d, i) => {
                    const bUsers = getBarUsers(d);
                    const bSites = getBarSites(d);
                    const userPct = (bUsers / maxVal) * 100;
                    const sitePct = (bSites / maxVal) * 100;

                    const hasData = d.users > 0 || d.sites > 0;
                    return (
                        <div key={i} className="group">
                            {/* Label Row */}
                            <div className="flex items-center justify-between mb-1">
                                <span className={`text-[11px] sm:text-xs font-semibold truncate max-w-[40%] ${hasData ? 'text-app-text-secondary' : 'text-app-text-muted/50'}`}>{d.label}</span>
                                {hasData ? (
                                    <div className="flex items-center gap-3 text-[10px] sm:text-[11px]">
                                        <span className="text-blue-400 font-bold">👥 {d.users}</span>
                                        <span className="text-emerald-400 font-bold">🌐 {d.sites}</span>
                                    </div>
                                ) : (
                                    <span className="text-[10px] text-app-text-muted/40">—</span>
                                )}
                            </div>
                            {hasData && (<>
                                {/* Users Bar */}
                                <div className="w-full bg-white/5 rounded-full h-3 sm:h-3.5 mb-1 overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-500 group-hover:from-blue-500 group-hover:to-blue-300"
                                        style={{ width: `${Math.max(userPct, bUsers > 0 ? 3 : 0)}%` }}>
                                    </div>
                                </div>
                                {/* Sites Bar */}
                                <div className="w-full bg-white/5 rounded-full h-3 sm:h-3.5 overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500 group-hover:from-emerald-500 group-hover:to-emerald-300"
                                        style={{ width: `${Math.max(sitePct, bSites > 0 ? 3 : 0)}%` }}>
                                    </div>
                                </div>
                            </>)}
                        </div>
                    );
                })}

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 pt-3 border-t border-app-border/30">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-600 to-blue-400"></div>
                        <span className="text-xs font-medium text-app-text-secondary">Users Adding Sites</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"></div>
                        <span className="text-xs font-medium text-app-text-secondary">Sites Added</span>
                    </div>
                </div>
            </div>

            {/* Desktop: Classic Vertical Bar Chart */}
            <div className="hidden lg:block bg-gradient-to-br from-app-bg-primary to-app-bg-light rounded-xl p-5 border border-app-border/50">
                {/* Y-axis labels + bars area */}
                <div className="flex gap-3" style={{ height: '320px' }}>
                    {/* Y-axis */}
                    <div className="flex flex-col justify-between text-[11px] text-app-text-muted font-medium w-8 text-right py-1">
                        {[maxVal, Math.round(maxVal * 0.75), Math.round(maxVal * 0.5), Math.round(maxVal * 0.25), 0].map((v, i) => (
                            <span key={i}>{v}</span>
                        ))}
                    </div>
                    {/* Bars grid */}
                    <div className="flex-1 relative">
                        {/* Grid lines */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                            {[0, 1, 2, 3, 4].map(i => (
                                <div key={i} className="w-full border-t border-white/5"></div>
                            ))}
                        </div>
                        {/* Bars */}
                        <div className="relative h-full flex items-end gap-1">
                            {chartData.map((d, i) => {
                                const bUsers = getBarUsers(d);
                                const bSites = getBarSites(d);
                                const userPct = (bUsers / maxVal) * 100;
                                const sitePct = (bSites / maxVal) * 100;
                                if (d.users === 0 && d.sites === 0) {
                                    return <div key={i} className="flex-1 h-full"></div>;
                                }
                                return (
                                    <div key={i} className="flex-1 flex items-end gap-0.5 h-full group relative">
                                        {/* Users bar */}
                                        <div className="flex-1 flex flex-col justify-end h-full">
                                            <div
                                                className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md transition-all duration-300 group-hover:from-blue-500 group-hover:to-blue-300 group-hover:shadow-lg group-hover:shadow-blue-500/30"
                                                style={{ height: `${Math.max(userPct, bUsers > 0 ? 2 : 0)}%` }}>
                                            </div>
                                        </div>
                                        {/* Sites bar */}
                                        <div className="flex-1 flex flex-col justify-end h-full">
                                            <div
                                                className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-md transition-all duration-300 group-hover:from-emerald-500 group-hover:to-emerald-300 group-hover:shadow-lg group-hover:shadow-emerald-500/30"
                                                style={{ height: `${Math.max(sitePct, bSites > 0 ? 2 : 0)}%` }}>
                                            </div>
                                        </div>
                                        {/* Tooltip */}
                                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                            <div className="bg-gray-900 border border-app-border rounded-lg px-3 py-2 shadow-2xl whitespace-nowrap">
                                                <p className="text-xs font-bold text-app-text-primary mb-1.5">{d.label}</p>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2.5 h-2.5 rounded bg-blue-500"></div>
                                                        <span className="text-xs text-blue-400 font-semibold">{d.users} {d.users === 1 ? 'user' : 'users'} added sites</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2.5 h-2.5 rounded bg-emerald-500"></div>
                                                        <span className="text-xs text-emerald-400 font-semibold">{d.sites} {d.sites === 1 ? 'site' : 'sites'} added</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                {/* X-axis labels */}
                <div className="flex gap-3 mt-2">
                    <div className="w-8"></div>
                    <div className="flex-1 flex">
                        {chartData.map((d, i) => (
                            <div key={i} className="flex-1 text-center">
                                <span className={`text-app-text-muted font-semibold ${period === 'hourly' ? 'text-[10px]' :
                                    period === 'daily' ? 'text-[10px]' :
                                        'text-[11px]'
                                    }`}>{d.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-app-border/30">
                    <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded bg-gradient-to-t from-blue-600 to-blue-400"></div>
                        <span className="text-sm font-medium text-app-text-secondary">Users Adding Sites</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded bg-gradient-to-t from-emerald-600 to-emerald-400"></div>
                        <span className="text-sm font-medium text-app-text-secondary">Sites Added</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ========================================
// User Row
// ========================================
function UserRow({ user, index, onDelete, onBan, onTogglePro, isCurrentUser }) {
    const timeAgo = (date) => {
        if (!date) return 'Never';
        const diff = Date.now() - new Date(date).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}d ago`;
        return new Date(date).toLocaleDateString();
    };

    return (
        <tr className={`border-b border-app-border/30 hover:bg-app-bg-light/30 transition-colors ${user.banned ? 'opacity-60' : ''}`}>
            <td className="px-4 py-3 text-app-text-muted text-sm">{index + 1}</td>
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    {user.avatar ? (
                        <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-app-accent/20 flex items-center justify-center text-app-accent text-xs font-bold">
                            {(user.username?.[0] || user.email?.[0] || '?').toUpperCase()}
                        </div>
                    )}
                    <div>
                        <div className="flex items-center gap-1.5">
                            <p className="text-app-text-primary text-sm font-medium">{user.username}</p>
                            {isCurrentUser && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full font-medium">ADMIN</span>
                            )}
                            {(() => {
                                const t = isCurrentUser ? TIER_PROMAX : (user.tier || TIER_FREE);
                                if (t === TIER_FREE) return null;
                                const c = TIER_COLORS[t];
                                return <span className={`text-[10px] px-1.5 py-0.5 ${c.bg} ${c.text} rounded-full font-medium`}>{c.badge}</span>;
                            })()}
                            {user.banned && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-full font-medium">BANNED</span>
                            )}
                        </div>
                        <p className="text-app-text-muted text-xs">{user.email}</p>
                    </div>
                </div>
            </td>
            <td className="px-4 py-3 text-center"><span className="font-semibold text-app-text-primary text-sm">{user.sites}</span></td>
            <td className="px-4 py-3 text-center"><span className="font-semibold text-app-text-primary text-sm">{user.categories}</span></td>
            <td className="px-4 py-3 text-center"><span className="font-semibold text-app-text-primary text-sm">{user.tags}</span></td>
            <td className="px-4 py-3 text-center">
                {user.aiUsageMonth > 0 ? (
                    <span className="font-semibold text-purple-400 text-sm" title={`Total: ${user.aiUsageTotal || 0}`}>{user.aiUsageMonth}</span>
                ) : (
                    <span className="text-app-text-muted text-sm">—</span>
                )}
            </td>
            <td className="px-4 py-3 text-app-text-muted text-xs">{new Date(user.created_at).toLocaleDateString()}</td>
            <td className="px-4 py-3 text-app-text-muted text-xs">{timeAgo(user.last_sign_in)}</td>
            <td className="px-4 py-3 text-center">
                {user.onboarded ? <span className="text-emerald-400 text-sm">✓</span> : <span className="text-app-text-muted text-sm">—</span>}
            </td>
            <td className="px-4 py-3 text-center">
                {(() => {
                    const t = isCurrentUser ? TIER_PROMAX : (user.tier || TIER_FREE);
                    if (t === TIER_PROMAX) return <CrownIcon className="w-4 h-4 text-purple-400 mx-auto" />;
                    if (t === TIER_PRO) return <CrownIcon className="w-4 h-4 text-amber-400 mx-auto" gradient />;
                    return <span className="text-app-text-muted text-sm">—</span>;
                })()}
            </td>
            <td className="px-4 py-3">
                {!isCurrentUser ? (
                    <div className="flex items-center justify-center gap-1">
                        <button onClick={() => onTogglePro(user)}
                            className="p-1 rounded transition-colors text-app-text-muted hover:text-amber-400 hover:bg-amber-900/20"
                            title={`Tier: ${TIER_LABELS[user.tier || TIER_FREE]}`}>
                            <CrownIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => onBan(user)}
                            className={`p-1 rounded transition-colors ${user.banned
                                ? 'text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-900/20'
                                : 'text-app-text-muted hover:text-amber-400 hover:bg-amber-900/20'
                                }`}
                            title={user.banned ? 'Unban user' : 'Ban user'}>
                            {user.banned ? (
                                <ShieldCheckIcon className="w-4 h-4" />
                            ) : (
                                <BanIcon className="w-4 h-4" />
                            )}
                        </button>
                        <button onClick={() => onDelete(user)}
                            className="text-app-text-muted hover:text-red-400 transition-colors p-1 rounded hover:bg-red-900/20"
                            title="Delete user">
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <span className="text-xs text-blue-400 font-medium flex items-center justify-center gap-1">
                        <ShieldCheckIcon className="w-3.5 h-3.5" />
                        You
                    </span>
                )}
            </td>
        </tr>
    );
}

// ========================================
// Section Card wrapper
// ========================================
function SectionCard({ title, children, className = '', action }) {
    return (
        <div className={`bg-app-bg-secondary/50 border border-app-border/30 rounded-xl p-3 sm:p-5 ${className}`}>
            <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
                <h3 className="text-xs sm:text-sm font-semibold text-app-text-muted uppercase tracking-wider">{title}</h3>
                {action}
            </div>
            {children}
        </div>
    );
}

// ========================================
// Shared Confirm Modal
// ========================================
function ConfirmModal({ target, onClose, busy, icon, title, children, onConfirm, confirmLabel, confirmClass, confirmDisabled }) {
    if (!target) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => !busy && onClose()}>
            <div className="bg-app-bg-secondary border border-app-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl"
                onClick={e => e.stopPropagation()}>
                <div className="text-center mb-4">
                    {icon}
                    <h3 className="text-lg font-bold text-app-text-primary">{title}</h3>
                </div>
                {children}
                <div className="flex gap-3">
                    <button onClick={onClose} disabled={busy}
                        className="flex-1 px-4 py-2 text-sm bg-app-bg-light text-app-text-secondary hover:text-app-text-primary rounded-lg transition-colors border border-app-border">
                        Cancel
                    </button>
                    <button onClick={onConfirm} disabled={busy || confirmDisabled}
                        className={`flex-1 px-4 py-2 text-sm text-white rounded-lg transition-colors font-medium disabled:opacity-50 ${confirmClass}`}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ========================================
// Main Admin Page
// ========================================
export default function AdminDashboard() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    // Data
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(null);

    // Tabs
    const [activeTab, setActiveTab] = useState('overview');

    // Users tab
    const [userSearch, setUserSearch] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortDir, setSortDir] = useState('desc');

    // Modals
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [banTarget, setBanTarget] = useState(null);
    const [banning, setBanning] = useState(false);
    const [proTarget, setProTarget] = useState(null);
    const [togglingPro, setTogglingPro] = useState(false);
    const [selectedTier, setSelectedTier] = useState(TIER_FREE);

    // Growth chart period
    const [growthPeriod, setGrowthPeriod] = useState('monthly');

    // Tools
    const [linkCheckResult, setLinkCheckResult] = useState(null);
    const [checkingLinks, setCheckingLinks] = useState(false);
    const [exporting, setExporting] = useState(null);

    // ========================================
    // Fetch main data
    // ========================================
    const fetchData = useCallback(async () => {
        try {
            setError(null);
            const token = await getToken();
            if (!token) { setError('Not authenticated'); setLoading(false); return; }

            const res = await fetch('/api/admin/stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();

            if (!res.ok) {
                setError(res.status === 403 ? 'ACCESS_DENIED' : json.error || 'Failed to load');
                setLoading(false);
                return;
            }

            setData(json);
            setLastRefresh(new Date());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (authLoading) return;
        if (!user) { router.replace('/login'); return; }
        fetchData();
        const interval = setInterval(fetchData, REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, [user, authLoading, fetchData, router]);

    // ========================================
    // User actions
    // ========================================
    const adminAction = useCallback(async (url, method, body, setTarget, setLoading) => {
        setLoading(true);
        try {
            const token = await getToken();
            const res = await fetch(url, {
                method,
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setTarget(null);
            fetchData();
        } catch (err) {
            alert(`Failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [fetchData]);

    const handleDeleteUser = () => deleteTarget && adminAction('/api/admin/delete-user', 'DELETE', { userId: deleteTarget.id }, setDeleteTarget, setDeleting);
    const handleBanUser = () => banTarget && adminAction('/api/admin/ban-user', 'POST', { userId: banTarget.id, ban: !banTarget.banned }, setBanTarget, setBanning);
    const handleTogglePro = () => proTarget && adminAction('/api/admin/toggle-pro', 'POST', { userId: proTarget.id, tier: selectedTier }, setProTarget, setTogglingPro);

    const handleExport = async (type) => {
        setExporting(type);
        try {
            const token = await getToken();
            const res = await fetch(`/api/admin/export?type=${type}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type}-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert(`Export failed: ${err.message}`);
        } finally {
            setExporting(null);
        }
    };

    const handleCheckLinks = async () => {
        setCheckingLinks(true);
        setLinkCheckResult(null);
        try {
            const token = await getToken();
            const res = await fetch('/api/admin/check-links', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setLinkCheckResult(json);
        } catch (err) {
            alert(`Link check failed: ${err.message}`);
        } finally {
            setCheckingLinks(false);
        }
    };

    // ========================================
    // User filtering + sorting
    // ========================================
    const filteredUsers = useMemo(() => {
        if (!data?.users) return [];
        let list = data.users;
        if (userSearch.trim()) {
            const q = userSearch.toLowerCase();
            list = list.filter(u => u.email?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q));
        }
        list = [...list].sort((a, b) => {
            let aVal, bVal;
            if (sortBy === 'created_at' || sortBy === 'last_sign_in') {
                aVal = new Date(a[sortBy] || 0).getTime();
                bVal = new Date(b[sortBy] || 0).getTime();
            } else {
                aVal = a[sortBy] ?? 0;
                bVal = b[sortBy] ?? 0;
            }
            return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
        });
        return list;
    }, [data?.users, userSearch, sortBy, sortDir]);

    const handleSort = (col) => {
        if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        else { setSortBy(col); setSortDir('desc'); }
    };

    const SortIcon = ({ col }) => {
        if (sortBy !== col) return <span className="text-app-text-muted/30 ml-1">↕</span>;
        return <span className="text-app-accent ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>;
    };

    // ========================================
    // Render States
    // ========================================
    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-app-bg-primary flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-2 border-app-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-app-text-muted">Loading admin dashboard...</p>
                </div>
            </div>
        );
    }

    if (error === 'ACCESS_DENIED') {
        return (
            <div className="min-h-screen bg-app-bg-primary flex items-center justify-center">
                <div className="text-center max-w-md">
                    <div className="text-6xl mb-4">🔒</div>
                    <h1 className="text-2xl font-bold text-app-text-primary mb-2">Access Denied</h1>
                    <p className="text-app-text-muted mb-6">Your account doesn&apos;t have admin access.</p>
                    <button onClick={() => router.push('/dashboard/sites')}
                        className="px-4 py-2 bg-app-accent text-white rounded-lg hover:bg-app-accentLight transition-colors">
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-app-bg-primary flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 mb-4">{error}</p>
                    <button onClick={fetchData} className="px-4 py-2 bg-app-accent rounded-lg text-white">Retry</button>
                </div>
            </div>
        );
    }

    const { overview, pricingBreakdown, topCategories, topTags, growthData, sitesPerUserStats,
        mostActiveUsers, popularDomains, duplicateSites, emptyAccountsCount, recentActivity, aiUsage } = data || {};

    // ========================================
    // Tab Content
    // ========================================
    const renderOverviewTab = () => (
        <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <StatCard label="Total Users" value={overview?.totalUsers} icon="👥" color="blue" />
                <StatCard label="Total Sites" value={overview?.totalSites} icon="🌐" color="green" />
                <StatCard label="Categories" value={overview?.totalCategories} icon="📁" color="purple" />
                <StatCard label="Tags" value={overview?.totalTags} icon="🏷️" color="amber" />
                <StatCard label="Active (7d)" value={overview?.activeUsers} icon="⚡" color="cyan" />
                <StatCard label="New (30d)" value={overview?.newUsersLast30Days} icon="📈" color="rose" />
                <StatCard label="Empty Accounts" value={emptyAccountsCount} icon="👻" color="indigo"
                    subtitle="Users with 0 sites" />
                <StatCard label="Sites/User"
                    value={sitesPerUserStats?.avg}
                    icon="📊" color="teal"
                    subtitle={`min: ${sitesPerUserStats?.min} / max: ${sitesPerUserStats?.max} / med: ${sitesPerUserStats?.median}`} />
            </div>

            {/* Growth Chart */}
            <SectionCard title="Growth">
                <GrowthChart data={growthData} period={growthPeriod} onPeriodChange={setGrowthPeriod} />
            </SectionCard>

            {/* Pricing + Top Items */}
            <div className="grid md:grid-cols-3 gap-4">
                <SectionCard title="Sites by Pricing">
                    <PricingChart data={pricingBreakdown} />
                </SectionCard>
                <SectionCard title="Top Categories">
                    <TopItemsList items={topCategories} />
                </SectionCard>
                <SectionCard title="Top Tags">
                    <TopItemsList items={topTags} />
                </SectionCard>
            </div>

            {/* Most Active + Popular Domains */}
            <div className="grid md:grid-cols-2 gap-4">
                <SectionCard title="Most Active Users (7d)">
                    {mostActiveUsers?.length ? (
                        <div className="space-y-2">
                            {mostActiveUsers.map((u, i) => (
                                <div key={u.id} className="flex items-center gap-3">
                                    <span className="text-app-text-muted text-xs w-5 text-right">{i + 1}.</span>
                                    {u.avatar ? (
                                        <img src={u.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-app-accent/20 flex items-center justify-center text-app-accent text-[10px] font-bold">
                                            {(u.username?.[0] || '?').toUpperCase()}
                                        </div>
                                    )}
                                    <span className="text-app-text-primary text-sm flex-1 truncate">{u.username}</span>
                                    <span className="text-emerald-400 text-xs font-semibold">+{u.recentSites} sites</span>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-app-text-muted text-sm">No activity in last 7 days</p>}
                </SectionCard>

                <SectionCard title="Popular Domains">
                    {popularDomains?.length ? (
                        <div className="space-y-1.5 max-h-64 overflow-y-auto">
                            {popularDomains.map((d, i) => (
                                <div key={d.domain} className="flex items-center gap-3">
                                    <span className="text-app-text-muted text-xs w-5 text-right">{i + 1}.</span>
                                    <img src={`https://www.google.com/s2/favicons?domain=${d.domain}&sz=16`}
                                        alt="" className="w-4 h-4 rounded-sm" />
                                    <span className="text-app-text-primary text-sm flex-1 truncate">{d.domain}</span>
                                    <span className="text-app-text-muted text-xs bg-app-bg-light px-2 py-0.5 rounded-full">
                                        {d.count}×
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-app-text-muted text-sm">No data</p>}
                </SectionCard>
            </div>
        </div>
    );

    const renderUsersTab = () => (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-app-text-muted uppercase tracking-wider">
                    Users ({filteredUsers.length})
                </h2>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button onClick={() => handleExport('users')} disabled={!!exporting}
                        className="px-3 py-1.5 text-xs bg-app-bg-light text-app-text-secondary hover:text-app-text-primary rounded-lg transition-colors border border-app-border disabled:opacity-50 flex-shrink-0">
                        {exporting === 'users' ? '⏳...' : '📥 CSV'}
                    </button>
                    <div className="relative flex-1 sm:flex-none">
                        <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" />
                        <input type="text" placeholder="Search users..." value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-app-bg-secondary border border-app-border/50 rounded-lg text-sm text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-app-accent sm:w-64" />
                    </div>
                </div>
            </div>

            {/* Sort controls - mobile */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none md:hidden pb-1">
                {[{ col: 'sites', label: 'Sites' }, { col: 'categories', label: 'Cat' }, { col: 'tags', label: 'Tags' },
                { col: 'aiUsageMonth', label: 'AI' },
                { col: 'created_at', label: 'Joined' }, { col: 'last_sign_in', label: 'Active' }].map(s => (
                    <button key={s.col} onClick={() => handleSort(s.col)}
                        className={`px-2.5 py-1 text-[10px] rounded-full whitespace-nowrap border transition-colors flex-shrink-0 ${sortBy === s.col
                            ? 'bg-app-accent/20 border-app-accent/50 text-app-accent'
                            : 'bg-app-bg-secondary border-app-border/30 text-app-text-muted'
                            }`}>
                        {s.label} {sortBy === s.col ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                    </button>
                ))}
            </div>

            {/* Mobile card layout */}
            <div className="md:hidden space-y-2">
                {filteredUsers.map((u, _i) => {
                    const isMe = u.email === user?.email;
                    return (
                        <div key={u.id} className={`bg-app-bg-secondary/50 border border-app-border/30 rounded-xl p-3 ${u.banned ? 'opacity-60' : ''}`}>
                            <div className="flex items-start gap-3">
                                {/* Avatar */}
                                {u.avatar ? (
                                    <img src={u.avatar} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-app-accent/20 flex items-center justify-center text-app-accent text-xs font-bold flex-shrink-0">
                                        {(u.username?.[0] || u.email?.[0] || '?').toUpperCase()}
                                    </div>
                                )}
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-app-text-primary text-sm font-medium truncate">{u.username}</p>
                                        {u.is_pro && <span className={`text-[9px] px-1.5 py-0.5 ${TIER_COLORS[u.tier || TIER_PRO].bg} ${TIER_COLORS[u.tier || TIER_PRO].text} rounded-full font-medium`}>{TIER_COLORS[u.tier || TIER_PRO].badge}</span>}
                                        {u.banned && <span className="text-[9px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-full font-medium">BANNED</span>}
                                        {isMe && <span className="text-[9px] px-1.5 py-0.5 bg-app-accent/20 text-app-accent rounded-full">You</span>}
                                    </div>
                                    <p className="text-app-text-muted text-xs truncate">{u.email}</p>
                                </div>
                                {/* Actions */}
                                {!isMe && (
                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                        <button onClick={() => { setSelectedTier(u.tier || TIER_FREE); setProTarget(u); }}
                                            className="p-1.5 rounded-lg transition-colors text-app-text-muted hover:text-amber-400 hover:bg-amber-900/20"
                                            title={`Tier: ${TIER_LABELS[u.tier || TIER_FREE]}`}>
                                            <CrownIcon className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => setBanTarget(u)}
                                            className={`p-1.5 rounded-lg transition-colors ${u.banned
                                                ? 'text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-900/20'
                                                : 'text-app-text-muted hover:text-amber-400 hover:bg-amber-900/20'
                                                }`}>
                                            {u.banned ? '✅' : '🚫'}
                                        </button>
                                        <button onClick={() => setDeleteTarget(u)}
                                            className="p-1.5 rounded-lg text-app-text-muted hover:text-red-400 hover:bg-red-900/20 transition-colors">
                                            🗑️
                                        </button>
                                    </div>
                                )}
                            </div>
                            {/* Stats row */}
                            <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-app-border/20">
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-app-text-muted">🌐</span>
                                    <span className="text-xs font-semibold text-app-text-primary">{u.sites}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-app-text-muted">📁</span>
                                    <span className="text-xs font-semibold text-app-text-primary">{u.categories}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-app-text-muted">🏷️</span>
                                    <span className="text-xs font-semibold text-app-text-primary">{u.tags}</span>
                                </div>
                                {(u.aiUsageMonth > 0 || u.aiUsageTotal > 0) && (
                                    <div className="flex items-center gap-1" title={`Total: ${u.aiUsageTotal || 0}`}>
                                        <span className="text-[10px] text-app-text-muted">🤖</span>
                                        <span className="text-xs font-semibold text-purple-400">{u.aiUsageMonth}</span>
                                    </div>
                                )}
                                <span className="text-app-text-muted text-[9px] ml-auto">
                                    {new Date(u.created_at).toLocaleDateString()}
                                </span>
                                {u.onboarded && <span className="text-emerald-400 text-[10px]">✓ Tour</span>}
                            </div>
                        </div>
                    );
                })}
                {filteredUsers.length === 0 && (
                    <div className="text-center py-8 text-app-text-muted text-sm">
                        {userSearch ? 'No users match your search' : 'No users found'}
                    </div>
                )}
            </div>

            {/* Desktop table layout */}
            <div className="hidden md:block bg-app-bg-secondary/50 border border-app-border/30 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-app-border/50 text-app-text-muted text-xs uppercase tracking-wider">
                                <th className="px-4 py-3 text-left w-10">#</th>
                                <th className="px-4 py-3 text-left">User</th>
                                <th className="px-4 py-3 text-center cursor-pointer hover:text-app-text-primary" onClick={() => handleSort('sites')}>Sites <SortIcon col="sites" /></th>
                                <th className="px-4 py-3 text-center cursor-pointer hover:text-app-text-primary" onClick={() => handleSort('categories')}>Cat <SortIcon col="categories" /></th>
                                <th className="px-4 py-3 text-center cursor-pointer hover:text-app-text-primary" onClick={() => handleSort('tags')}>Tags <SortIcon col="tags" /></th>
                                <th className="px-4 py-3 text-center cursor-pointer hover:text-app-text-primary" onClick={() => handleSort('aiUsageMonth')}>AI <SortIcon col="aiUsageMonth" /></th>
                                <th className="px-4 py-3 text-left cursor-pointer hover:text-app-text-primary" onClick={() => handleSort('created_at')}>Joined <SortIcon col="created_at" /></th>
                                <th className="px-4 py-3 text-left cursor-pointer hover:text-app-text-primary" onClick={() => handleSort('last_sign_in')}>Active <SortIcon col="last_sign_in" /></th>
                                <th className="px-4 py-3 text-center">Tour</th>
                                <th className="px-4 py-3 text-center">Tier</th>
                                <th className="px-4 py-3 text-center w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((u, i) => (
                                <UserRow key={u.id} user={u} index={i}
                                    onDelete={setDeleteTarget} onBan={setBanTarget}
                                    onTogglePro={(u) => { setSelectedTier(u.tier || TIER_FREE); setProTarget(u); }}
                                    isCurrentUser={u.email === user?.email} />
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr><td colSpan={11} className="px-4 py-8 text-center text-app-text-muted">
                                    {userSearch ? 'No users match your search' : 'No users found'}
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderContentTab = () => (
        <div className="space-y-6">
            {/* Recent Activity */}
            <SectionCard title="Recent Activity (Latest Sites Added)">
                {recentActivity?.length ? (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {recentActivity.map((a, i) => (
                            <div key={i} className="flex items-center gap-3 py-1.5 border-b border-app-border/20 last:border-0">
                                {a.user?.avatar ? (
                                    <img src={a.user.avatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                                ) : (
                                    <div className="w-6 h-6 rounded-full bg-app-accent/20 flex items-center justify-center text-app-accent text-[10px] font-bold flex-shrink-0">
                                        {(a.user?.username?.[0] || '?').toUpperCase()}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-app-text-primary text-sm font-medium truncate">{a.user?.username || 'Unknown'}</span>
                                        <span className="text-app-text-muted text-[10px]">added</span>
                                    </div>
                                    <a href={a.url} target="_blank" rel="noopener noreferrer"
                                        className="text-blue-400 text-xs hover:underline truncate block">{a.domain || a.url}</a>
                                </div>
                                <span className="text-app-text-muted text-[10px] flex-shrink-0">
                                    {new Date(a.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : <p className="text-app-text-muted text-sm">No recent activity</p>}
            </SectionCard>

            {/* Duplicate Sites */}
            <SectionCard title="Duplicate Sites (Same URL, Multiple Users)">
                {duplicateSites?.length ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {duplicateSites.map((d, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className="text-app-text-muted text-xs w-5 text-right">{i + 1}.</span>
                                <a href={d.url} target="_blank" rel="noopener noreferrer"
                                    className="text-blue-400 text-sm hover:underline flex-1 truncate">{d.url}</a>
                                <span className="text-amber-400 text-xs font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full">
                                    {d.userCount} users
                                </span>
                            </div>
                        ))}
                    </div>
                ) : <p className="text-app-text-muted text-sm">No duplicate sites found 🎉</p>}
            </SectionCard>

            {/* Export */}
            <div className="grid sm:grid-cols-2 gap-4">
                <SectionCard title="Export Sites">
                    <p className="text-app-text-muted text-sm mb-3">Download all sites as CSV with name, URL, pricing, owner.</p>
                    <button onClick={() => handleExport('sites')} disabled={!!exporting}
                        className="px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50">
                        {exporting === 'sites' ? '⏳ Exporting...' : '📥 Export Sites CSV'}
                    </button>
                </SectionCard>
                <SectionCard title="Export Users">
                    <p className="text-app-text-muted text-sm mb-3">Download all users as CSV with email, username, stats.</p>
                    <button onClick={() => handleExport('users')} disabled={!!exporting}
                        className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50">
                        {exporting === 'users' ? '⏳ Exporting...' : '📥 Export Users CSV'}
                    </button>
                </SectionCard>
            </div>
        </div>
    );

    const renderToolsTab = () => (
        <div className="space-y-6">
            {/* AI Usage */}
            <SectionCard title="AI Suggestions Usage" action={
                <span className="text-xs text-app-text-muted">
                    {aiUsage?.currentMonth?.month || 'N/A'}
                </span>
            }>
                {/* Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
                    <div className="text-center p-2.5 sm:p-3 bg-app-bg-light/30 rounded-lg">
                        <p className="text-lg sm:text-2xl font-bold text-app-text-primary">{aiUsage?.totalRequests || 0}</p>
                        <p className="text-app-text-muted text-[10px] sm:text-xs mt-0.5">All Time</p>
                    </div>
                    <div className="text-center p-2.5 sm:p-3 bg-app-bg-light/30 rounded-lg">
                        <p className="text-lg sm:text-2xl font-bold text-purple-400">{aiUsage?.currentMonth?.requests || 0}</p>
                        <p className="text-app-text-muted text-[10px] sm:text-xs mt-0.5">This Month</p>
                    </div>
                    <div className="text-center p-2.5 sm:p-3 bg-app-bg-light/30 rounded-lg">
                        <p className="text-lg sm:text-2xl font-bold text-amber-400">{aiUsage?.topUsers?.length || 0}</p>
                        <p className="text-app-text-muted text-[10px] sm:text-xs mt-0.5">Active Users</p>
                    </div>
                    <div className="text-center p-2.5 sm:p-3 bg-app-bg-light/30 rounded-lg">
                        <p className="text-lg sm:text-2xl font-bold text-emerald-400">
                            {(() => {
                                const tb = aiUsage?.tierBreakdown || {};
                                const total = (tb.free || 0) + (tb.pro || 0) + (tb.promax || 0);
                                return total > 0 ? Math.round(((tb.pro || 0) + (tb.promax || 0)) / total * 100) : 0;
                            })()}%
                        </p>
                        <p className="text-app-text-muted text-[10px] sm:text-xs mt-0.5">Pro Usage</p>
                    </div>
                </div>

                {/* Tier Breakdown */}
                <div className="mb-4">
                    <p className="text-app-text-secondary text-xs font-medium mb-2">This Month by Tier</p>
                    <div className="flex gap-2 sm:gap-3">
                        {[{ key: 'free', label: 'Free', color: 'gray', limit: 10 },
                        { key: 'pro', label: 'Pro', color: 'amber', limit: 200 },
                        { key: 'promax', label: 'Pro Max', color: 'purple', limit: 2000 }].map(t => (
                            <div key={t.key} className="flex-1 p-2 bg-app-bg-light/30 rounded-lg">
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`text-${t.color}-400 text-xs font-medium`}>{t.label}</span>
                                    <span className="text-app-text-muted text-[10px]">{t.limit}/mo</span>
                                </div>
                                <p className="text-app-text-primary text-sm font-bold">{aiUsage?.tierBreakdown?.[t.key] || 0}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top AI Users */}
                {aiUsage?.topUsers?.length > 0 ? (
                    <div>
                        <p className="text-app-text-secondary text-xs font-medium mb-2">Top AI Users</p>
                        <div className="space-y-1.5 max-h-64 overflow-y-auto">
                            {aiUsage.topUsers.map((u, i) => {
                                const tierColor = u.tier === 'promax' ? 'text-purple-400' : u.tier === 'pro' ? 'text-amber-400' : 'text-gray-400';
                                const tierLabel = u.tier === 'promax' ? 'Pro Max' : u.tier === 'pro' ? 'Pro' : 'Free';
                                const limit = u.tier === 'promax' ? 2000 : u.tier === 'pro' ? 200 : 10;
                                return (
                                    <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-app-bg-light/30 transition-colors">
                                        <span className="text-app-text-muted text-xs w-4 text-right">{i + 1}</span>
                                        {u.avatar ? (
                                            <img src={u.avatar} alt="" className="w-5 h-5 rounded-full" />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full bg-app-bg-light flex items-center justify-center">
                                                <span className="text-[10px] text-app-text-muted">{(u.username?.[0] || u.email?.[0] || '?').toUpperCase()}</span>
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <span className="text-app-text-primary text-xs truncate block">{u.username || u.email}</span>
                                        </div>
                                        <span className={`text-[10px] ${tierColor}`}>{tierLabel}</span>
                                        <span className="text-app-text-secondary text-xs font-mono">{u.currentMonth}<span className="text-app-text-muted">/{limit}</span></span>
                                        <span className="text-app-text-muted text-[10px]">({u.total} total)</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <p className="text-app-text-muted text-sm text-center py-3">No AI usage data yet</p>
                )}
            </SectionCard>
            {/* Broken Links Checker */}
            <SectionCard title="Broken Links Checker"
                action={
                    <button onClick={handleCheckLinks} disabled={checkingLinks}
                        className="px-3 py-1.5 text-xs bg-app-accent text-white hover:bg-app-accentLight rounded-lg transition-colors disabled:opacity-50">
                        {checkingLinks ? '⏳ Checking...' : '🔍 Run Check'}
                    </button>
                }>
                <p className="text-app-text-muted text-sm mb-3">
                    Scan all sites for broken links (404, timeout, DNS errors). This may take a while.
                </p>

                {checkingLinks && (
                    <div className="flex items-center gap-3 py-4">
                        <div className="w-5 h-5 border-2 border-app-accent border-t-transparent rounded-full animate-spin" />
                        <p className="text-app-text-secondary text-sm">Checking all site URLs...</p>
                    </div>
                )}

                {linkCheckResult && !checkingLinks && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-4 text-sm">
                            <span className="text-app-text-secondary">
                                Checked: <strong className="text-app-text-primary">{linkCheckResult.checked}</strong>
                            </span>
                            <span className={linkCheckResult.brokenCount > 0 ? 'text-red-400' : 'text-emerald-400'}>
                                Broken: <strong>{linkCheckResult.brokenCount}</strong>
                            </span>
                        </div>

                        {linkCheckResult.broken?.length > 0 ? (
                            <div className="space-y-2 max-h-80 overflow-y-auto">
                                {linkCheckResult.broken.map((b, i) => (
                                    <div key={i} className="flex flex-wrap sm:flex-nowrap items-start gap-2 sm:gap-3 py-2 border-b border-app-border/20 last:border-0">
                                        <span className={`text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0 ${b.status === 0 ? 'bg-gray-500/20 text-gray-400' :
                                            b.status >= 500 ? 'bg-red-500/20 text-red-400' :
                                                b.status >= 400 ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-gray-500/20 text-gray-400'
                                            }`}>
                                            {b.status || 'ERR'}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-app-text-primary text-sm truncate">{b.name}</p>
                                            <a href={b.url} target="_blank" rel="noopener noreferrer"
                                                className="text-blue-400 text-xs hover:underline truncate block">{b.url}</a>
                                            <p className="text-red-400/70 text-[10px] mt-0.5">{b.error}</p>
                                            <p className="text-app-text-muted text-[10px] sm:hidden">{b.ownerName || b.ownerEmail}</p>
                                        </div>
                                        <span className="text-app-text-muted text-[10px] flex-shrink-0 hidden sm:block">{b.ownerName || b.ownerEmail}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-emerald-400 text-sm">✓ All links are healthy!</p>
                        )}
                    </div>
                )}
            </SectionCard>

            {/* Quick Stats */}
            <SectionCard title="Platform Health">
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    <div className="text-center p-2.5 sm:p-4 bg-app-bg-light/30 rounded-lg">
                        <p className="text-xl sm:text-3xl font-bold text-app-text-primary">{sitesPerUserStats?.avg || 0}</p>
                        <p className="text-app-text-muted text-[10px] sm:text-xs mt-1">Avg Sites/User</p>
                    </div>
                    <div className="text-center p-2.5 sm:p-4 bg-app-bg-light/30 rounded-lg">
                        <p className="text-xl sm:text-3xl font-bold text-app-text-primary">{emptyAccountsCount || 0}</p>
                        <p className="text-app-text-muted text-[10px] sm:text-xs mt-1">Empty Accounts</p>
                    </div>
                    <div className="text-center p-2.5 sm:p-4 bg-app-bg-light/30 rounded-lg">
                        <p className="text-xl sm:text-3xl font-bold text-app-text-primary">{duplicateSites?.length || 0}</p>
                        <p className="text-app-text-muted text-[10px] sm:text-xs mt-1">Duplicate URLs</p>
                    </div>
                </div>
            </SectionCard>
        </div>
    );

    // ========================================
    // Main Render
    // ========================================
    return (
        <>
            <Head><title>Admin Dashboard — Site Organizer</title></Head>

            <div className="min-h-screen bg-app-bg-primary">
                {/* Header */}
                <header className="border-b border-app-border/50 bg-app-bg-secondary/50 backdrop-blur-sm sticky top-0 z-20">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-xl sm:text-2xl">🛡️</span>
                            <div>
                                <h1 className="text-lg sm:text-xl font-bold text-app-text-primary">Admin Dashboard</h1>
                                <p className="text-app-text-muted text-[10px] sm:text-xs">
                                    {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : 'Loading...'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                            <button onClick={fetchData}
                                className="p-2 text-app-text-muted hover:text-app-text-primary hover:bg-app-bg-light rounded-lg transition-colors"
                                title="Refresh">
                                <RefreshIcon className="w-5 h-5" />
                            </button>
                            <button onClick={() => router.push('/dashboard/sites')}
                                className="px-3 py-1.5 text-xs sm:text-sm bg-app-bg-light text-app-text-secondary hover:text-app-text-primary rounded-lg transition-colors border border-app-border">
                                ← Dashboard
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="max-w-7xl mx-auto px-4 sm:px-6">
                        <div className="flex gap-1 overflow-x-auto scrollbar-none -mb-px">
                            {TABS.map(tab => (
                                <button key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.key
                                        ? 'border-app-accent text-app-accent'
                                        : 'border-transparent text-app-text-muted hover:text-app-text-secondary'
                                        }`}>
                                    <span>{tab.icon}</span>
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                    {activeTab === 'overview' && renderOverviewTab()}
                    {activeTab === 'users' && renderUsersTab()}
                    {activeTab === 'content' && renderContentTab()}
                    {activeTab === 'tools' && renderToolsTab()}
                </main>

                {/* Delete Modal */}
                <ConfirmModal target={deleteTarget} onClose={() => setDeleteTarget(null)} busy={deleting}
                    icon={<div className="text-4xl mb-3">⚠️</div>} title="Delete User?"
                    onConfirm={handleDeleteUser} confirmLabel={deleting ? 'Deleting...' : 'Delete'}
                    confirmClass="bg-red-600 hover:bg-red-500">
                    <p className="text-app-text-secondary text-sm text-center mb-1">
                        Permanently delete <strong className="text-app-text-primary">{deleteTarget?.email}</strong>
                    </p>
                    <p className="text-app-text-muted text-xs text-center mb-5">
                        Including {deleteTarget?.sites} sites, {deleteTarget?.categories} categories, {deleteTarget?.tags} tags. Cannot be undone.
                    </p>
                </ConfirmModal>

                {/* Ban/Unban Modal */}
                <ConfirmModal target={banTarget} onClose={() => setBanTarget(null)} busy={banning}
                    icon={<div className="text-4xl mb-3">{banTarget?.banned ? '✅' : '🚫'}</div>}
                    title={`${banTarget?.banned ? 'Unban' : 'Ban'} User?`}
                    onConfirm={handleBanUser}
                    confirmLabel={banning ? 'Processing...' : banTarget?.banned ? 'Unban' : 'Ban'}
                    confirmClass={banTarget?.banned ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-amber-600 hover:bg-amber-500'}>
                    <p className="text-app-text-secondary text-sm text-center mb-1">
                        {banTarget?.banned ? 'Restore access for' : 'Disable access for'}{' '}
                        <strong className="text-app-text-primary">{banTarget?.email}</strong>
                    </p>
                    <p className="text-app-text-muted text-xs text-center mb-5">
                        {banTarget?.banned
                            ? 'This user will be able to log in again.'
                            : 'This user will not be able to log in. Their data will remain intact.'}
                    </p>
                </ConfirmModal>

                {/* Tier Change Modal */}
                <ConfirmModal target={proTarget} onClose={() => setProTarget(null)} busy={togglingPro}
                    icon={<div className="mb-3 flex justify-center"><CrownIcon className="w-10 h-10 text-amber-400" gradient /></div>}
                    title="Change Tier"
                    onConfirm={handleTogglePro}
                    confirmLabel={togglingPro ? 'Processing...' : `Set ${TIER_LABELS[selectedTier]}`}
                    confirmClass={selectedTier === TIER_PROMAX ? 'bg-purple-600 hover:bg-purple-500' : selectedTier === TIER_PRO ? 'bg-amber-600 hover:bg-amber-500' : 'bg-gray-600 hover:bg-gray-500'}
                    confirmDisabled={selectedTier === (proTarget?.tier || TIER_FREE)}>
                    <p className="text-app-text-secondary text-sm text-center mb-4">
                        Set tier for <strong className="text-app-text-primary">{proTarget?.email}</strong>
                    </p>
                    <div className="flex flex-col gap-2 mb-5">
                        {[TIER_FREE, TIER_PRO, TIER_PROMAX].map(t => {
                            const isSelected = selectedTier === t;
                            const isCurrent = (proTarget?.tier || TIER_FREE) === t;
                            return (
                                <button key={t} onClick={() => setSelectedTier(t)}
                                    className={`flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all ${isSelected
                                        ? t === TIER_FREE ? 'border-gray-500 bg-gray-500/10' : t === TIER_PRO ? 'border-amber-500 bg-amber-500/10' : 'border-purple-500 bg-purple-500/10'
                                        : 'border-app-border hover:border-app-border-hover bg-app-bg-light'
                                        }`}>
                                    <div className="flex items-center gap-2">
                                        {t !== TIER_FREE && <CrownIcon className={`w-4 h-4 ${t === TIER_PROMAX ? 'text-purple-400' : 'text-amber-400'}`} gradient={t === TIER_PRO} />}
                                        <span className={`font-medium ${isSelected ? 'text-app-text-primary' : 'text-app-text-secondary'}`}>{TIER_LABELS[t]}</span>
                                        {isCurrent && <span className="text-xs text-app-text-muted ml-1">(current)</span>}
                                    </div>
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected
                                        ? t === TIER_FREE ? 'border-gray-500' : t === TIER_PRO ? 'border-amber-500' : 'border-purple-500'
                                        : 'border-app-border'
                                        }`}>
                                        {isSelected && <div className={`w-2 h-2 rounded-full ${t === TIER_FREE ? 'bg-gray-500' : t === TIER_PRO ? 'bg-amber-500' : 'bg-purple-500'}`} />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-app-text-muted text-xs text-center mb-4">
                        {selectedTier === TIER_FREE && 'Free: 500 sites, 50 categories, 200 tags.'}
                        {selectedTier === TIER_PRO && 'Pro: 2000 sites, 200 categories, 500 tags + AI & Link Check.'}
                        {selectedTier === TIER_PROMAX && 'Pro Max: Unlimited everything + all features.'}
                    </p>
                </ConfirmModal>
            </div>
        </>
    );
}
