/**
 * Centralized SVG icon components — zero dependency, same pixel-perfect output.
 * Usage: import { SearchIcon, CloseIcon } from '../ui/Icons';
 *        <SearchIcon className="w-5 h-5" />
 *
 * All icons default to 24×24 viewBox, stroke style, unless noted otherwise.
 */

import { FaCrown } from 'react-icons/fa';

// ─── Helper wrapper ────────────────────────────────────────────────────────────

/** Stroke-style icon (Heroicons Outline convention) */
const S = ({ d, className = 'w-5 h-5', strokeWidth = 2, ...props }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d={d} />
    </svg>
);

/** Fill-style icon (24×24) */
const F = ({ d, className = 'w-5 h-5', ...props }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d={d} />
    </svg>
);

/** Fill-style icon (20×20, fillRule evenodd) */
const F20 = ({ d, className = 'w-5 h-5', ...props }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path fillRule="evenodd" clipRule="evenodd" d={d} />
    </svg>
);

// ─── Navigation & Actions ──────────────────────────────────────────────────────

export const CloseIcon = (p) => <S d="M6 18L18 6M6 6l12 12" {...p} />;
export const PlusIcon = (p) => <S d="M12 4v16m8-8H4" {...p} />;
export const SearchIcon = (p) => <S d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" {...p} />;
export const MenuIcon = (p) => <S d="M4 6h16M4 12h16M4 18h16" {...p} />;
export const FilterIcon = (p) => <S d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" {...p} />;
export const RefreshIcon = (p) => <S d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" {...p} />;
export const ArrowLeftIcon = (p) => <S d="M10 19l-7-7m0 0l7-7m-7 7h18" {...p} />;
export const ArrowRightIcon = (p) => <S d="M13 7l5 5m0 0l-5 5m5-5H6" {...p} />;
export const ChevronDownIcon = (p) => <S d="M19 9l-7 7-7-7" {...p} />;
export const ChevronLeftIcon = (p) => <S d="M15 19l-7-7 7-7" {...p} />;
export const ChevronRightIcon = (p) => <S d="M9 5l7 7-7 7" {...p} />;
export const LogoutIcon = (p) => <S d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" {...p} />;
export const ExternalLinkIcon = (p) => <S d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" {...p} />;
export const SortIcon = (p) => <S d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" {...p} />;

// ─── Content & Organization ────────────────────────────────────────────────────

export const GlobeIcon = (p) => <S d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" {...p} />;
export const FolderIcon = (p) => <S d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" {...p} />;
export const TagIcon = (p) => <S d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" {...p} />;
export const BookmarkIcon = (p) => <S d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" {...p} />;
export const LinkIcon = (p) => <S d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" {...p} />;
export const DocumentIcon = (p) => <S d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" {...p} />;
export const CollectionIcon = (p) => <S d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" {...p} />;

// ─── Editing ───────────────────────────────────────────────────────────────────

export const EditIcon = (p) => <S d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" {...p} />;
export const TrashIcon = (p) => <S d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" {...p} />;
export const ClipboardCheckIcon = (p) => <S d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" {...p} />;
export const DotsVerticalIcon = (p) => <S d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" {...p} />;

// ─── Status & Feedback ─────────────────────────────────────────────────────────

export const CheckmarkIcon = (p) => <S d="M5 13l4 4L19 7" {...p} />;
export const CheckCircleIcon = (p) => <S d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" {...p} />;
export const WarningIcon = (p) => <S d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" {...p} />;
export const InfoCircleIcon = (p) => <S d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" {...p} />;
export const ExclamationCircleIcon = (p) => <S d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" {...p} />;
export const BanIcon = (p) => <S d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" {...p} />;
export const ShieldCheckIcon = (p) => <S d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" {...p} />;

// ─── File & IO ─────────────────────────────────────────────────────────────────

export const UploadIcon = (p) => <S d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" {...p} />;
export const DownloadIcon = (p) => <S d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" {...p} />;
export const LightningIcon = (p) => <S d="M13 10V3L4 14h7v7l9-11h-7z" {...p} />;

// ─── Security & User ───────────────────────────────────────────────────────────

export const LockIcon = (p) => <S d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" {...p} />;
export const CurrencyDollarIcon = (p) => <S d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" {...p} />;
export const DeviceMobileIcon = (p) => <S d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" {...p} />;
export const DesktopIcon = (p) => <S d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" {...p} />;
export const CameraIcon = ({ className = 'w-5 h-5', ...props }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

// ─── Eye / Visibility ──────────────────────────────────────────────────────────

export const EyeIcon = ({ className = 'w-5 h-5', ...props }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
);

export const EyeOffIcon = (p) => <S d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" {...p} />;

// ─── Settings ──────────────────────────────────────────────────────────────────

export const SettingsIcon = ({ className = 'w-5 h-5', ...props }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

// ─── Specialized (AI, Lightbulb, etc.) ─────────────────────────────────────────

export const LightbulbIcon = (p) => <S d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" {...p} />;
export const SparklesIcon = (p) => <S d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" {...p} />;
export const ClockIcon = (p) => <S d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" {...p} />;
export const BarChartIcon = (p) => <S d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" {...p} />;

// ─── List/Grid style ───────────────────────────────────────────────────────────

export const ListBulletIcon = (p) => <S d="M4 6h16M4 10h16M4 14h16M4 18h16" {...p} />;
export const TextLinesIcon = (p) => <F d="M4 4h16v2H4zm0 4h16v2H4zm0 4h16v2H4zm0 4h10v2H4z" {...p} />;

// ─── Star (path version — Sidebar, FavoritesList, SiteModal) ───────────────────

export const StarIcon = (p) => <S d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" {...p} />;

// ─── Pin (Material Design — viewBox 0 -960 960 960) ───────────────────────────

export const PinIcon = ({ className = 'w-5 h-5', ...props }) => (
    <svg className={className} fill="currentColor" viewBox="0 -960 960 960" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="m640-480 80 80v80H520v240l-40 40-40-40v-240H240v-80l80-80v-280h-40v-80h400v80h-40v280Zm-286 80h252l-46-46v-314H400v314l-46 46Zm126 0Z" />
    </svg>
);

/** Simplified pin (Sidebar) */
export const PinSimpleIcon = (p) => <F d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2z" {...p} />;

// ─── Fill-style (Toast, Badge) ─────────────────────────────────────────────────

export const WarningFilledIcon = (p) => <F d="M13 13h-2v-4h2v4zm0 8h-2v-2h2v2zm-1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" {...p} />;
export const InfoFilledIcon = (p) => <F d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" {...p} />;

// ─── Fill-style (20×20 viewBox — Badge, Landing) ──────────────────────────────

export const FolderFilledIcon = (p) => <F20 d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" {...p} />;
export const TagFilledIcon = (p) => <F20 d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" {...p} />;
export const CheckCircleFilledIcon = (p) => <F20 d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" {...p} />;
export const LockFilledIcon = (p) => <F20 d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" {...p} />;
export const CpuIcon = ({ className = 'w-5 h-5', ...props }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path fillRule="evenodd" clipRule="evenodd" d="M13 7H7v6h6V7z" />
        <path fillRule="evenodd" clipRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2z" />
    </svg>
);

// ─── Spinners ──────────────────────────────────────────────────────────────────

/** Standard spinner — used in buttons, inline loading */
export const SpinnerIcon = ({ className = 'w-5 h-5 animate-spin', ...props }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
);

/** Full spinner — the Button.js variant with extra arc segment */
export const SpinnerFullIcon = ({ className = 'w-5 h-5 animate-spin', ...props }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
);

// ─── Crown / Pro ───────────────────────────────────────────────────────────────

export const CrownIcon = ({ className = 'w-5 h-5', gradient, ...props }) => (
    <FaCrown className={className} style={gradient ? { color: '#F59E0B' } : undefined} {...props} />
);
