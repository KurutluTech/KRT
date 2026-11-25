import { stampCnc } from '../../../packages/domain/src/cncTelemetry.js';
import { periodFetchFrom } from '../../../packages/domain/src/liveKpi.js';
import { selReal } from './pilotMark.js';
export function createLiveApi(client, session) {
    return {
        board: async (profile) => {
            const b = await client.rpc('live_board', { p_profile: profile }, session);
            // ONE FACT -> ONE SOURCE: the CNC verdict is read once here and rides on the board, so every screen that builds a machine state sees the same CNC fact.
            if (profile === 'OFFICE') {
                const denied = (e) => /FORBIDDEN|42501|NOT_AUTHORIZED|permission denied|CNC_TELEMETRY|does not exist|PGRST202|404/i.test(String(e?.message ?? e));
                b.cncRead = 'FAILED';
                for (let attempt = 0; attempt < 2 && b.cncRead === 'FAILED'; attempt++) {
                    try {
                        const by = new Map();
                        for (const r of await client.rpc('cnc_live_states', {}, session))
                            if (r.machineCode)
                                by.set(r.machineCode, r);
                        for (const m of b.machines) {
                            const r = by.get(m.code);
                            if (r)
                                m.cnc = stampCnc(r);
                        }
                        b.cncRead = 'OK';
                    }
                    catch (e) {
                        if (denied(e))
                            b.cncRead = 'DENIED';
                        else if (attempt === 0)
                            await new Promise((r) => setTimeout(r, 900));
                    } // one quick retry for a transient failure; permission refusal is final
                }
            }
            return b;
        },
        machineInfo: async () => {
            try {
                return await selReal(client, 'machines', { columns: 'id,code,name,machine_class', order: 'code.asc', limit: 200 }, session);
            }
            catch {
                return (await selReal(client, 'machines', { columns: 'id,code,name', order: 'code.asc', limit: 200 }, session)).map((m) => ({ ...m, machineClass: null }));
            } // live DB may lack machine_class
        },
        periods: async (nowIso) => {
            const CAP = 5000;
            const rows = await selReal(client, 'production_declarations', { columns: 'qty_good,qty_scrap,declared_at', filters: { declared_at: `gte.${periodFetchFrom(nowIso)}` }, order: 'declared_at.desc', limit: CAP }, session);
            let assigned = null;
            try {
                assigned = (await selReal(client, 'work_orders', { columns: 'id', filters: { status: 'eq.MACHINE_ASSIGNED' }, limit: 1000 }, session)).length;
            }
            catch {
                assigned = null;
            }
            return { rows, truncated: rows.length >= CAP, assigned };
        },
        workDetail: async () => (await client.rpc('command_center', {}, session)).liveWorkOrders ?? [],
        cncStates: async () => (await client.rpc('cnc_live_states', {}, session)).map(stampCnc),
        listDisplays: () => client.rpc('list_live_displays', {}, session),
        createDisplay: (name) => client.rpc('create_live_display', { p_name: name }, session),
        revokeDisplay: async (id, reason) => { await client.rpc('revoke_live_display', { p_id: id, p_reason: reason }, session); },
    };
}
/** Kiosk hata sınıfları (ham SQL / PostgREST metni kiosk ekranında ASLA gösterilmez). */
export const KIOSK_TEXT_TR = {
    DISPLAY_TOKEN_INVALID: 'Ekran anahtarı geçersiz veya iptal edilmiş.',
    KIOSK_UNAVAILABLE: 'Bu ekran şu an açılamıyor (erişim kapalı). Ekran anahtarını veya erişim ayarını yöneticinizle kontrol edin.',
    KIOSK_OFFLINE: 'Bağlantı yok — sunucuya ulaşılamıyor. Otomatik olarak yeniden denenir.',
    KIOSK_ERROR: 'Pano şu an okunamadı. Otomatik olarak yeniden denenir.',
};
export function classifyKioskError(e) {
    if (typeof e?.kind === 'string' && Object.hasOwn(KIOSK_TEXT_TR, e.kind))
        return e.kind;
    const m = String(e?.message ?? e ?? '');
    if (/DISPLAY_TOKEN_INVALID/.test(m))
        return 'DISPLAY_TOKEN_INVALID';
    if (e?.status === 401 || e?.status === 403 || e?.code === '42501' || /permission denied|FORBIDDEN|42501|row-level security|JWT|not authorized|NOT_AUTHORIZED/i.test(m))
        return 'KIOSK_UNAVAILABLE';
    if (/Failed to fetch|NetworkError|Load failed|network|timeout|timed out|abort|ECONN|ENOTFOUND/i.test(m) || (e?.name === 'TypeError' && !e?.status))
        return 'KIOSK_OFFLINE';
    return 'KIOSK_ERROR';
}
/** PUBLIC (ekran) panosu: sunucu yanlışlıkla müşteri alanı (customerPo, müşteri adı…) döndürse bile siparişlerden ayıklanır (derinlemesine savunma; asıl sınır sunucu S04). */
export function publicSafeBoard(b) {
    if (!b || typeof b !== 'object')
        return b;
    const strip = (o) => { if (!o || typeof o !== 'object')
        return o; const c = { ...o }; for (const k of Object.keys(c))
        if (/^customer/i.test(k) || /^(?:po|poNo|purchaseOrder)$/i.test(k))
            delete c[k]; return c; };
    return { ...b, orders: Array.isArray(b.orders) ? b.orders.map(strip) : b.orders };
}
/** Kiosk: no session, token only. */
export function createKioskLiveApi(client, token) {
    const refuse = async () => { throw new Error('KIOSK_READ_ONLY'); };
    return {
        board: async () => {
            try {
                return publicSafeBoard(await client.rpc('live_board_display', { p_token: token }, null));
            }
            catch (e) {
                const kind = classifyKioskError(e);
                const err = new Error(kind); // yalnız sınıf kodu taşınır; ham mesaj/SQLSTATE atılır
                err.kind = kind;
                throw err;
            }
        },
        listDisplays: refuse, createDisplay: refuse, revokeDisplay: refuse,
    };
}
