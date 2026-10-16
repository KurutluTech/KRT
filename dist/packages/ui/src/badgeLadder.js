// KMI NEXT — Badge Ladder medallion (matrix item 33). Original design: a faceted hexagonal medallion with
// a metallic gradient per tier (BRONZ, GÜMÜŞ, ALTIN, PLATİN, USTA = dark obsidian with a prismatic rim),
// a track glyph (quality check, setup crosshair, measurement caliper, tooling end-mill, maintenance
// wrench, improvement arrow), tier pips, and honest states: LOCKED = greyscale with a lock, WITHDRAWN =
// greyscale with a strike. Pure SVG string (unit-testable, printable), unique ids per instance.
const METAL = {
    1: ['#f3c29b', '#b8743f', '#6e3d1c'],
    2: ['#ffffff', '#c3cad3', '#6b7684'],
    3: ['#fff3b0', '#f2b705', '#8a5a00'],
    4: ['#f2fbff', '#9fe3ff', '#3a6f8f'],
    5: ['#4b4b66', '#1d1b2e', '#07060d'],
};
const TIER_NAME = { 1: 'BRONZ', 2: 'GÜMÜŞ', 3: 'ALTIN', 4: 'PLATİN', 5: 'USTA' };
const GLYPH = {
    MACHINE: '', DISCIPLINE: '', MULTI: '', TRAINING: '', SAFETY: '',
    QUALITY: '<circle cx="50" cy="50" r="15" fill="none" stroke="currentColor" stroke-width="4"/><path d="M42 50 l6 6 l11-13" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>',
    SETUP: '<circle cx="50" cy="50" r="13" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M50 31v10M50 59v10M31 50h10M59 50h10" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><circle cx="50" cy="50" r="3" fill="currentColor"/>',
    MEASUREMENT: '<path d="M36 34h28v8H46v24h-6V42h-4z" fill="currentColor"/><path d="M52 42v10h6V42" fill="none" stroke="currentColor" stroke-width="3"/><path d="M40 47h3M40 53h3M40 59h3" stroke="#00000055" stroke-width="1.5"/>',
    TOOLING: '<path d="M46 30h8v10h-8z" fill="currentColor"/><path d="M45 41h10l-1 22l-4 6l-4-6z" fill="currentColor"/><path d="M46 46l8 4M46 53l8 4" stroke="#00000055" stroke-width="2"/>',
    MAINTENANCE: '<path d="M58 33a9 9 0 0 0-11 11L34 57a4 4 0 0 0 6 6l13-13a9 9 0 0 0 11-11l-6 6-5-1-1-5z" fill="currentColor"/>',
    IMPROVEMENT: '<path d="M50 32l13 14h-8v18h-10V46h-8z" fill="currentColor"/><path d="M36 68h28" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>',
};
GLYPH.MACHINE = '<rect x="34" y="38" width="32" height="22" rx="3" fill="currentColor"/><path d="M42 38v-6h16v6M50 60v8M40 68h20" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" fill="none"/><circle cx="50" cy="49" r="4" fill="#00000055"/>';
GLYPH.DISCIPLINE = '<path d="M50 30l16 7v12c0 10-7 17-16 21c-9-4-16-11-16-21V37z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M43 50l5 5l9-10" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>';
GLYPH.MULTI = '<rect x="30" y="40" width="18" height="16" rx="2" fill="currentColor"/><rect x="52" y="40" width="18" height="16" rx="2" fill="currentColor" opacity=".7"/><path d="M36 62h28" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>';
GLYPH.TRAINING = '<path d="M50 32l22 10l-22 10l-22-10z" fill="currentColor"/><path d="M38 50v10c0 4 24 4 24 0V50" fill="none" stroke="currentColor" stroke-width="3.5"/>';
GLYPH.SAFETY = '<path d="M50 30l20 34H30z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M50 43v10" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="59" r="2.5" fill="currentColor"/>';
let seq = 0;
function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export function ladderBadgeSvg(track, tier, state = 'EARNED', size = 64, label) {
    if (!(tier >= 1 && tier <= 5 && Number.isInteger(tier)))
        throw new RangeError('tier must be 1..5');
    if (!GLYPH[track])
        throw new RangeError('unknown track');
    const id = `lb${(seq += 1)}`;
    const grey = state !== 'EARNED';
    const [hi, mid, lo] = grey ? ['#e5e7eb', '#9ca3af', '#4b5563'] : METAL[tier];
    const ink = grey ? '#6b7280' : tier === 5 ? '#e9d5ff' : tier === 3 ? '#5c3b00' : tier === 1 ? '#4a240c' : '#1f2937';
    const title = `${label ? `${label} — ` : ''}${TIER_NAME[tier]}${state === 'LOCKED' ? ' (KİLİTLİ)' : state === 'WITHDRAWN' ? ' (GERİ ALINDI)' : ''}`;
    const hex = 'M50 4 L90 27 L90 73 L50 96 L10 73 L10 27 Z';
    const inner = 'M50 14 L81 32 L81 68 L50 86 L19 68 L19 32 Z';
    const rim = tier === 5 && !grey
        ? `<linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset=".35" stop-color="#a78bfa"/><stop offset=".7" stop-color="#f472b6"/><stop offset="1" stop-color="#facc15"/></linearGradient>`
        : '';
    const pips = Array.from({ length: tier }, (_, i) => `<circle cx="${50 - (tier - 1) * 4.5 + i * 9}" cy="79" r="2.6" fill="${ink}"/>`).join('');
    const lock = state === 'LOCKED' ? `<g opacity=".9"><rect x="41" y="47" width="18" height="14" rx="3" fill="#374151"/><path d="M44 47v-4a6 6 0 0 1 12 0v4" fill="none" stroke="#374151" stroke-width="3"/></g>` : '';
    const strike = state === 'WITHDRAWN' ? '<path d="M18 82 L82 18" stroke="#b91c1c" stroke-width="5" stroke-linecap="round"/>' : '';
    return (`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${esc(title)}" ` +
        `data-track="${track}" data-tier="${tier}" data-state="${state}"><title>${esc(title)}</title><defs>` +
        `<linearGradient id="${id}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient>` +
        `<linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset=".5" stop-color="#ffffff" stop-opacity="0"/></linearGradient>${rim}</defs>` +
        `<path d="${hex}" fill="url(#${id}m)" stroke="${tier === 5 && !grey ? `url(#${id}r)` : lo}" stroke-width="${tier === 5 && !grey ? 5 : 3}"/>` +
        `<path d="${inner}" fill="none" stroke="${grey ? '#d1d5db' : hi}" stroke-opacity=".7" stroke-width="2"/>` +
        `<path d="M50 4 L90 27 L50 50 Z" fill="url(#${id}f)"/>` +
        `<g color="${ink}"${state === 'LOCKED' ? ' opacity=".3"' : ''}>${GLYPH[track]}</g>${pips}${lock}${strike}</svg>`);
}
export const LADDER_TIER_NAME = TIER_NAME;
