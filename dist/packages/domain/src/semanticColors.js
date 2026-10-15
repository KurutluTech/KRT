export const SEMANTIC = {
    ok: { fg: '#4ade80', soft: 'rgba(74,222,128,.14)', border: '#22c55e', label: 'UYGUN', icon: '✓', says: 'Başarılı / doğrulanmış' },
    bad: { fg: '#ff8a8a', soft: 'rgba(248,113,113,.16)', border: '#ef4444', label: 'KRİTİK', icon: '✕', says: 'Kritik arıza / engel / ihlal' },
    warn: { fg: '#fcd34d', soft: 'rgba(252,211,77,.14)', border: '#f59e0b', label: 'DİKKAT', icon: '!', says: 'Uyarı / yaklaşan risk' },
    info: { fg: '#7cb7ff', soft: 'rgba(96,165,250,.14)', border: '#3b82f6', label: 'BİLGİ', icon: 'i', says: 'Bilgilendirme / nötr aktivite' },
    hold: { fg: '#cdbdff', soft: 'rgba(167,139,250,.16)', border: '#8b5cf6', label: 'KALİTE HOLD', icon: '⏸', says: 'Kalite engeli — serbest bırakılana kadar kullanılamaz' },
    unknown: { fg: '#aab6c8', soft: 'rgba(148,163,184,.12)', border: '#64748b', label: 'BİLİNMİYOR', icon: '?', says: 'Veri yok / okunamadı' },
    stale: { fg: '#ffb27a', soft: 'rgba(251,146,60,.14)', border: '#fb923c', label: 'BAYAT VERİ', icon: '⏱', says: 'Veri güncel değil (ayrı veri tazeliği uyarısı)' },
};
/** A. brand / navigation / interaction (not operational) */
export const BRAND = { accent: '#5eead4', accentSoft: 'rgba(94,234,212,.14)', focus: '#a9ccff', link: '#a9ccff' };
/** raised surfaces, lightest last: layers must be distinguishable (≥ ~1.15:1 step) instead of navy-on-navy */
export const SURFACES = { bg: '#131b2b', bg2: '#182236', panel: '#1e2b43', panel2: '#26365a', line: '#33456a', line2: '#4b5f89' };
export const TEXT = { primary: '#f4f7fb', secondary: '#cbd5e4', muted: '#b3bfd2' };
/** decorative department accents live OUTSIDE the operational colours (no pure green / red / amber) so they cannot be mistaken for a verdict */
export const DEPT_ACCENTS = ['#7aa2ff', '#b794f6', '#5eead4', '#f0abfc', '#93c5fd', '#e0aaff', '#c4b5fd', '#99f6e4', '#f5d0fe', '#bae6fd', '#d8b4fe', '#a5b4fc'];
/** the meaning of a canonical tone from intelligenceContract */
export const meaningOfTone = (t) => (t === 'GREEN' ? 'ok' : t === 'RED' ? 'bad' : t === 'AMBER' ? 'warn' : t === 'BLUE' ? 'info' : 'unknown');
/** LIGHT theme (KMI-001 closeout): the same seven meanings, surfaces, text tiers and brand roles, re-derived for a light page. OPT-IN only — nothing applies it by
 *  default (`html[data-kmi-theme="light"]`); screens whose CSS still hard-codes dark colours are NOT claimed ready (see docs/KMI-001/STATUS.md). */
export const SEMANTIC_LIGHT = {
    ok: { fg: '#166534', soft: 'rgba(22,101,52,.10)', border: '#16a34a' },
    bad: { fg: '#b91c1c', soft: 'rgba(185,28,28,.10)', border: '#dc2626' },
    warn: { fg: '#92400e', soft: 'rgba(146,64,14,.10)', border: '#d97706' },
    info: { fg: '#1d4ed8', soft: 'rgba(29,78,216,.10)', border: '#2563eb' },
    hold: { fg: '#6d28d9', soft: 'rgba(109,40,217,.10)', border: '#7c3aed' },
    unknown: { fg: '#475569', soft: 'rgba(71,85,105,.10)', border: '#64748b' },
    stale: { fg: '#9a3412', soft: 'rgba(154,52,18,.10)', border: '#ea580c' },
};
export const BRAND_LIGHT = { accent: '#0f766e', accentSoft: 'rgba(15,118,110,.12)', focus: '#1d4ed8', link: '#1d4ed8' };
export const SURFACES_LIGHT = { bg: '#f1f4f9', bg2: '#e8edf5', panel: '#ffffff', panel2: '#f6f8fc', line: '#cfd8e6', line2: '#9aa9c2' };
export const TEXT_LIGHT = { primary: '#0f1a2e', secondary: '#2b3a55', muted: '#4a5b78' };
