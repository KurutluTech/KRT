// Static (non-animated) equipment pictograms. They say WHAT the equipment is — never that it is running.
const SVG = {
    MACHINING: '<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M2.5 17h19"/><rect x="5" y="6.5" width="9" height="8" rx="1"/><path d="M9.5 9v2.2M8.2 11.2h2.6M9.5 11.2v2.6"/><path d="M17 7.5h2M17 10h2"/><circle cx="18" cy="14" r="0.6"/>',
    MEASUREMENT: '<path d="M3 20h18M5 20V8M19 20V8M5 8h14"/><path d="M12 8v6"/><circle cx="12" cy="16" r="1.6"/><path d="M8 20v-3h8v3"/>',
    MATERIAL_HANDLING: '<path d="M4 20V6h3l2 6v8"/><path d="M9 12h6v8H9"/><path d="M15 4v14M15 4h3"/><circle cx="7" cy="20" r="1.4"/><circle cx="13" cy="20" r="1.4"/><path d="M18 18h3"/>',
    AUXILIARY: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    NONE: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M8 10h8M8 14h5"/>',
};
export function machineIcon(cls, size = 34) {
    const el = document.createElement('span');
    el.style.display = 'inline-flex';
    el.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${SVG[cls ?? 'NONE'] ?? SVG.NONE}</svg>`;
    return el;
}
