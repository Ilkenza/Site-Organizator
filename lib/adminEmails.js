/** Shared admin email check — single source of truth */
let _parsed = null;

function getAdminEmails() {
    if (!_parsed) {
        _parsed = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
            .split(',')
            .map(e => e.trim().toLowerCase())
            .filter(Boolean);
    }
    return _parsed;
}

export function isAdminEmail(email) {
    if (!email) return false;
    return getAdminEmails().includes(email.toLowerCase());
}
