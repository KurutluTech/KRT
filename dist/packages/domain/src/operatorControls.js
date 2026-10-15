export const OPERATOR_ACTIONS = {
    START: { key: 'START', label: 'START', tone: 'green', size: 'xl', icon: 'play', confirm: 'none', reasonRequired: false, audit: 'İş emri üretime başlar; kim/ne zaman kaydedilir.' },
    STOP: { key: 'STOP', label: 'DURUŞ', tone: 'red', size: 'xl', icon: 'stop', confirm: 'none', reasonRequired: true, audit: 'Üretim duruş olayı kaydedilir (kategori + sebep). Fiziksel acil stop DEĞİLDİR.' },
    RESUME: { key: 'RESUME', label: 'RESUME', tone: 'green', size: 'lg', icon: 'play', confirm: 'none', reasonRequired: true, audit: 'Duruş kapatılır; makine üretime döner.' },
    FINISH: { key: 'FINISH', label: 'FINISH', tone: 'blue', size: 'lg', icon: 'check', confirm: 'twice', reasonRequired: false, audit: 'Operasyon tamamlanır; geri alınamaz, kayıt altına alınır.' },
    GOOD_PLUS: { key: 'GOOD_PLUS', label: 'SAĞLAM +', tone: 'green', size: 'lg', icon: 'plus', confirm: 'none', rapid: true, reasonRequired: false, audit: 'Sağlam adet sayacı artar; ÜRETİM KAYDET ile işlenir.' },
    TAHSIS_PLUS: { key: 'TAHSIS_PLUS', label: 'TASHİH +', tone: 'amber', size: 'lg', icon: 'plus', confirm: 'none', reasonRequired: true, audit: 'Mastarla ölçü dışı çıkan düzeltilebilir parça: beyan formu açılır; parçalar ayrılıp kaliteye teslim edilir. Kalite serbest bırakması değildir.' },
    SCRAP_PLUS: { key: 'SCRAP_PLUS', label: 'HURDA +', tone: 'rose', size: 'lg', icon: 'plus', confirm: 'none', rapid: true, reasonRequired: false, audit: 'Hurda adet sayacı artar; ÜRETİM KAYDET ile işlenir.' },
    TOOL_CHANGE: { key: 'TOOL_CHANGE', label: 'TAKIM DEĞİŞİMİ', tone: 'amber', size: 'md', icon: 'wrench', confirm: 'none', reasonRequired: false, audit: 'Takım olayı makineye ve iş emrine bağlı kaydedilir.' },
    CALL_QUALITY: { key: 'CALL_QUALITY', label: 'KALİTE ÇAĞIR', tone: 'blue', size: 'md', icon: 'shield', confirm: 'none', reasonRequired: false, audit: 'Kalite onayı/ölçümü istenir; Kalite masasında görünür.' },
    REPORT_FAULT: { key: 'REPORT_FAULT', label: 'ARIZA BİLDİR', tone: 'red', size: 'md', icon: 'bolt', confirm: 'none', reasonRequired: true, audit: 'Bakım bileti açılır; makine yetkili testle açılana dek üretime kapanır.' },
};
export const OPERATOR_ACTION_ORDER = ['START', 'STOP', 'RESUME', 'FINISH', 'GOOD_PLUS', 'TAHSIS_PLUS', 'SCRAP_PLUS', 'TOOL_CHANGE', 'CALL_QUALITY', 'REPORT_FAULT'];
export const ARM_MS = 4000;
export const DOUBLE_TAP_LOCK_MS = 700;
export function createPressGuard(confirm, lockMs = DOUBLE_TAP_LOCK_MS, armMs = ARM_MS, rapid = false) {
    let inflight = false, lastRun = -Infinity, armedAt = -Infinity;
    return {
        press(now) {
            if (rapid)
                return 'RUN';
            if (inflight || now - lastRun < lockMs)
                return 'IGNORE';
            if (confirm === 'twice') {
                if (now - armedAt > armMs) {
                    armedAt = now;
                    return 'ARM';
                }
                armedAt = -Infinity;
            }
            inflight = true;
            lastRun = now;
            return 'RUN';
        },
        settle() { inflight = false; },
        armed(now) { return now - armedAt <= armMs; },
    };
}
