// KMI-001 final — each department's own identity: accent colour (by function family, not by status), one-line mission and "look here first".
// Pure data. It states what the department WATCHES FIRST; it never claims a value, count or live state (those come from the cockpit/records).
import { DEPT_ACCENTS } from './semanticColors.js';
export const DEPT_IDENTITY = {
    prod: { accent: DEPT_ACCENTS[0], mission: 'İş emirlerini makinede akıtmak', firstLook: 'Duran/arızalı makine, geciken iş emri, ilk parça bekleyen iş' },
    plan: { accent: DEPT_ACCENTS[1], mission: 'Doğru işi doğru zamanda doğru makineye atamak', firstLook: 'Teslimi yaklaşan ve kapasite çakışan işler' },
    qc: { accent: DEPT_ACCENTS[2], mission: 'Hatalı parçanın sevkiyata ulaşmasını önlemek', firstLook: 'Açık HOLD, TAHSİS/uygunsuzluk kayıtları, ilk parça onayları' },
    tool: { accent: DEPT_ACCENTS[3], mission: 'Takımı hazır, izlenebilir ve ömürlü tutmak', firstLook: 'Eksik/ömrü dolan takım, hazırlık (preset) bekleyen iş' },
    cam: { accent: DEPT_ACCENTS[4], mission: 'Program ve kurulum bilgisini sahaya hazır vermek', firstLook: 'Programı eksik veya revizyonu belirsiz iş' },
    maint: { accent: DEPT_ACCENTS[5], mission: 'Arızayı kısaltmak, duruşu azaltmak', firstLook: 'Açık arıza ve bakım kayıtları, uzayan duruşlar' },
    wh: { accent: DEPT_ACCENTS[6], mission: 'Malzeme ve mamulü doğru yerde, doğru miktarda bulmak', firstLook: 'Eksik malzeme, bekleyen giriş/çıkış, karantina' },
    buy: { accent: DEPT_ACCENTS[7], mission: 'Üretimi durduracak tedarik boşluğunu önceden kapatmak', firstLook: 'Onay bekleyen talep, geciken teslim' },
    ship: { accent: DEPT_ACCENTS[8], mission: 'Hazır işi zamanında ve doğru belgeyle yola çıkarmak', firstLook: 'Sevke hazır ve geciken siparişler' },
    fin: { accent: DEPT_ACCENTS[9], mission: 'Maliyet ve tahsilatı kayıttan görmek', firstLook: 'Onay bekleyen maliyet kararı, vadesi geçen alacak (yetki kapısına tabi)' },
    hr: { accent: DEPT_ACCENTS[10], mission: 'Doğru kişiyi doğru yetkinlikle vardiyaya koymak', firstLook: 'Eksik yetkinlik, devamsızlık/puantaj istisnaları (kişisel veri sınırlarıyla)' },
    intel: { accent: DEPT_ACCENTS[11], mission: 'Kayıtlardan karar çıkarmak, kaynağı gösterip', firstLook: 'Veri eksiği (VERİ GEREKLİ) olan göstergeler' },
};
export function identityOf(id) { return DEPT_IDENTITY[id] ?? null; }
