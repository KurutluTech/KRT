// Shared readiness gate + exemption form (migration 0021). Same canonical label on every screen.
import { h } from '../../../../packages/ui/src/h.js';
import { readinessLabel } from '../../../../packages/domain/src/readiness.js';
export function readinessPanel(kind, result, onGrant) {
    const r = result ?? { kind, state: 'UNKNOWN', reason: `${kind}_REQUIREMENT_UNKNOWN:NOT_EVALUATED` };
    const reasonInput = h('input', {
        type: 'text',
        'data-testid': 'exempt-reason-input',
        placeholder: 'Muafiyet gerekçesi (en az 10 karakter, yetkili onay)',
    });
    return h('div', { 'data-testid': 'readiness-panel', 'data-kind': kind, 'data-state': r.state }, h('div', { 'data-testid': 'readiness-state' }, readinessLabel(r)), r.state === 'UNKNOWN'
        ? h('div', { 'data-testid': 'exempt-form' }, h('p', {}, kind === 'MATERIAL'
            ? 'BOM / ürün revizyonu tanımlı değil. Önce veri girin; malzeme gerçekten gerekmiyorsa yetkili muafiyet verin.'
            : 'CAM takım listesi tanımlı değil. Önce veri girin; takım gerçekten gerekmiyorsa yetkili muafiyet verin.'), reasonInput, h('button', { type: 'button', 'data-testid': 'exempt-btn', onClick: () => onGrant(reasonInput.value.trim()) }, kind === 'MATERIAL' ? 'Malzeme Gerekmiyor (Yetkili Muafiyet)' : 'Takım Gerekmiyor (Yetkili Muafiyet)'))
        : null);
}
