export const NEXT_MISSING = {
    drawing: 'Teknik resim ve CAD/STEP dosyalarını yükleyin.',
    bom: 'Hammaddeyi tanımlayın.',
    routing: 'İlk operasyonu ekleyin (süreler, makine).',
    cam: 'NC programını yükleyin ve operasyona bağlayın.',
    tools: 'Takım listesini yükleyin; eksik çap/tutucu/offset bilgisini tamamlayın.',
    quality: 'Kalite kontrol noktalarını tanımlayın.',
};
export const NEXT_PENDING = {
    drawing: 'Teknik resim / CAD onayını tamamlayın.',
    bom: 'BOM onayını tamamlayın.',
    routing: 'Rota onayını tamamlayın.',
    cam: 'NC programının onayını tamamlayın.',
    tools: 'Takım listesi eksiklerini tamamlayıp yürürlüğe alın.',
    quality: 'Kontrol planı onayını tamamlayın.',
};
/** Satır / kayıt yoksa "tanımlayın", kayıt var ama onay bekliyorsa "onayı tamamlayın". */
export const nextText = (target, st) => (st === 'MISSING' || st === 'INVALID' ? NEXT_MISSING[target] : NEXT_PENDING[target]) ?? '';
