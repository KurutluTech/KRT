// KMI NEXT — mastery badge (rozet) visual for the competency ladder (matrix item 33).
// Original design: a shield whose rim colour and number of pips show the level
// (1 ÖĞRENCİ … 4 USTA). An expired competency is drawn grey and dashed with a cross so it can
// never be mistaken for a valid one; "expiring soon" gets an amber ring. Pure string output
// (SVG markup), no DOM, so it is unit-testable and printable.
const RIM = { 1: '#94a3b8', 2: '#b45309', 3: '#2563eb', 4: '#7c3aed' };
const FILL = { 1: '#f1f5f9', 2: '#fef3c7', 3: '#dbeafe', 4: '#ede9fe' };
const TITLE = { 1: 'ÖĞRENCİ', 2: 'GÖZETİMLİ', 3: 'BAĞIMSIZ', 4: 'USTA' };
function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export function masteryBadgeSvg(level, state = 'VALID', size = 40, label) {
    if (![1, 2, 3, 4].includes(level))
        throw new RangeError('level must be 1..4');
    const expired = state === 'EXPIRED';
    const rim = expired ? '#9ca3af' : RIM[level];
    const fill = expired ? '#f3f4f6' : FILL[level];
    const dash = expired ? ' stroke-dasharray="4 3"' : '';
    const title = `${label ? `${label} — ` : ''}${TITLE[level]}${expired ? ' (SÜRESİ DOLDU)' : state === 'EXPIRING_SOON' ? ' (SÜRESİ DOLUYOR)' : ''}`;
    const pips = [];
    const gap = 8;
    const start = 20 - ((level - 1) * gap) / 2;
    for (let i = 0; i < level; i += 1) {
        pips.push(`<circle cx="${start + i * gap}" cy="23" r="3" fill="${rim}"/>`);
    }
    const ring = state === 'EXPIRING_SOON' ? '<circle cx="20" cy="20" r="19" fill="none" stroke="#f59e0b" stroke-width="2"/>' : '';
    const cross = expired ? '<path d="M10 10 L30 32 M30 10 L10 32" stroke="#6b7280" stroke-width="2"/>' : '';
    return (`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="${size}" height="${size}" role="img" ` +
        `aria-label="${esc(title)}" data-level="${level}" data-state="${state}">` +
        `<title>${esc(title)}</title>${ring}` +
        `<path d="M20 3 L34 8 L34 20 C34 29 27 35 20 37 C13 35 6 29 6 20 L6 8 Z" fill="${fill}" stroke="${rim}" stroke-width="2.5"${dash}/>` +
        `${pips.join('')}${cross}</svg>`);
}
