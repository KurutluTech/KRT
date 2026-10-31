// Rota değişiklik geçmişi — okunur gösterim (saf fonksiyonlar; ağ/DOM yok). Nesne asla doğrudan metne çevrilmez ("[object Object]" yok).
export const KEY_TR = {
    name: 'Ad', op_code: 'Operasyon kodu', op_no: 'Sıra no', active: 'Etkin', allowed_machine_ids: 'Makineler', primary_machine_id: 'Öncelikli makine',
    cam_program_id: 'CAM programı', cycle_seconds_target: 'Çevrim (sn)', setup_minutes_target: 'Hazırlık (dk)', first_piece_required: 'İlk parça kontrolü',
    qc_required: 'Kalite kontrolü', instructions: 'Operatör talimatı', required_skill_code: 'Yeterlilik', required_skill_level: 'Yeterlilik seviyesi',
    depends_on: 'Önceki operasyonlar', qc_points: 'Kalite noktaları', resources: 'Kaynaklar', params: 'Süre standartları',
};
export const PARAM_TR = { OP_SETUP_MIN: 'Hazırlık', OP_CYCLE_SEC: 'Çevrim', OP_INSPECTION_SEC: 'Muayene' };
export const KIND_TR = { FIRST_PIECE: 'ilk parça', IN_PROCESS: 'proses içi', FINAL: 'son kontrol', PERIODIC: 'periyodik' };
export const NOISE = new Set(['id', 'set_at', 'set_by', 'product_revision_id', 'deactivated_at', 'deactivated_by', 'deactivate_reason']);
export const camel = (k) => k.replace(/_([a-z0-9])/g, (_m, c) => c.toUpperCase());
const pick = (o, k) => (o == null ? undefined : (k in o ? o[k] : o[camel(k)]));
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const short = (id) => String(id).slice(0, 8);
const num = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace('.', ','));
/** ctx: { machines: Map(id -> {code,name}), cams: Map(id -> {programNo,revision}), ops: Map(id -> opCode) } */
export function machineText(id, ctx) {
    const m = ctx?.machines?.get(id);
    return m ? (m.name && m.name !== m.code ? `${m.code} · ${m.name}` : m.code) : `bilinmeyen makine (${short(id)})`;
}
export function camText(id, ctx) {
    const c = ctx?.cams?.get(id);
    if (!c) return `CAM kaydı okunamadı (${short(id)})`;
    const no = pick(c, 'program_no') ?? 'CAM', rev = pick(c, 'revision');
    return rev == null ? String(no) : `${no} · sürüm ${rev}`;
}
const paramLine = (k, p) => {
    const v = isObj(p) ? pick(p, 'value') : p, u = isObj(p) ? pick(p, 'unit') : null;
    return `${PARAM_TR[k] ?? k}: ${v == null ? '—' : num(Number(v))}${u ? ` ${u}` : ''}`;
};
export function paramsText(p) {
    if (!isObj(p) || !Object.keys(p).length) return 'tanımlı değil';
    return Object.keys(p).sort().map((k) => paramLine(k, p[k])).join(' · ');
}
const qcLine = (q) => `${pick(q, 'label') ?? 'Kalite noktası'}${pick(q, 'kind') ? ` (${KIND_TR[pick(q, 'kind')] ?? String(pick(q, 'kind')).toLowerCase()}${pick(q, 'frequency') ? `, ${pick(q, 'frequency')}` : ''})` : ''}`;
const resLine = (r) => (isObj(r) ? `${pick(r, 'label') ?? pick(r, 'code') ?? 'Kaynak'}${pick(r, 'qty') != null ? ` × ${pick(r, 'qty')}` : ''}` : String(r));
/** Tek alanın okunur değeri. Her tür için metin üretir; nesne/dizi ham dökülmez. */
export function valueText(key, v, ctx) {
    if (v === null || v === undefined) return '—';
    switch (key) {
        case 'allowed_machine_ids': return Array.isArray(v) ? (v.length ? v.map((x) => machineText(x, ctx)).join(', ') : 'yok') : machineText(v, ctx);
        case 'primary_machine_id': return machineText(v, ctx);
        case 'cam_program_id': return camText(v, ctx);
        case 'params': return paramsText(v);
        case 'depends_on': return Array.isArray(v) ? (v.length ? v.map((x) => ctx?.ops?.get(x) ?? (typeof x === 'number' ? `OP${x}` : `operasyon (${short(x)})`)).join(', ') : 'yok') : String(v);
        case 'qc_points': return Array.isArray(v) ? (v.length ? v.map(qcLine).join('; ') : 'yok') : '—';
        case 'resources': return Array.isArray(v) ? (v.length ? v.map(resLine).join('; ') : 'yok') : '—';
        case 'cycle_seconds_target': return `${num(Number(v))} sn`;
        case 'setup_minutes_target': return `${num(Number(v))} dk`;
        default: break;
    }
    if (typeof v === 'boolean') return v ? 'evet' : 'hayır';
    if (typeof v === 'number') return num(v);
    if (Array.isArray(v)) return v.length ? v.map((x) => (isObj(x) ? Object.values(x).filter((y) => typeof y !== 'object').join(' ') : String(x))).join(', ') : 'yok';
    if (isObj(v)) return Object.entries(v).filter(([, y]) => y !== null && typeof y !== 'object').map(([k, y]) => `${k}: ${y}`).join(' · ') || '—';
    return String(v).length > 120 ? `${String(v).slice(0, 117)}…` : String(v);
}
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const empty = (v) => v === null || v === undefined || (Array.isArray(v) && !v.length) || (isObj(v) && !Object.keys(v).length) || v === '';
/** Bir sürüm kaydı için satırlar: [{label, from, to}] — yalnız gerçekten değişenler; parametreler tek tek. */
export function diffRows(row, ctx) {
    const keys = (row.changedKeys ?? []).filter((k) => !NOISE.has(k));
    const out = [];
    for (const k of keys) {
        const b = pick(row.beforeState, k), a = pick(row.afterState, k);
        if (k === 'params') {
            const bp = isObj(b) ? b : {}, ap = isObj(a) ? a : {};
            for (const pk of [...new Set([...Object.keys(bp), ...Object.keys(ap)])].sort()) {
                const pb = isObj(bp[pk]) ? pick(bp[pk], 'value') : bp[pk], pa = isObj(ap[pk]) ? pick(ap[pk], 'value') : ap[pk];
                if (same(pb, pa) && same(isObj(bp[pk]) ? pick(bp[pk], 'unit') : null, isObj(ap[pk]) ? pick(ap[pk], 'unit') : null)) continue;
                out.push({ label: PARAM_TR[pk] ?? pk, from: bp[pk] === undefined ? 'tanımlı değil' : paramLine(pk, bp[pk]).split(': ')[1], to: ap[pk] === undefined ? 'kaldırıldı' : paramLine(pk, ap[pk]).split(': ')[1] });
            }
            continue;
        }
        if (same(b, a) || (empty(b) && empty(a))) continue;
        out.push({ label: KEY_TR[k] ?? k, from: valueText(k, b, ctx), to: valueText(k, a, ctx) });
    }
    return out;
}
/** Bilinen kimlikler, ayrıntı bölümü için (ham kayıt). */
export function rawIds(row) {
    const ids = [];
    for (const k of (row.changedKeys ?? [])) {
        for (const st of [row.beforeState, row.afterState]) {
            const v = pick(st, k);
            if (['allowed_machine_ids', 'primary_machine_id', 'cam_program_id'].includes(k)) for (const x of [].concat(v ?? [])) if (typeof x === 'string') ids.push(`${KEY_TR[k]}: ${x}`);
        }
    }
    return [...new Set(ids)];
}
export const changedLabels = (keys) => (keys ?? []).filter((k) => !NOISE.has(k)).map((k) => KEY_TR[k] ?? k);
