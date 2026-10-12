export const MACHINE_CLASS_TR = { MACHINING: 'CNC / talaşlı imalat', MEASUREMENT: 'Ölçüm / metroloji', MATERIAL_HANDLING: 'Malzeme taşıma', AUXILIARY: 'Yardımcı ekipman' };
export const MACHINE_CLASS_UNKNOWN_TR = 'Sınıf belirtilmemiş';
export const HEADLINE_TR = {
    DOWN: 'ARIZA', MAINTENANCE: 'BAKIMDA', HOLD: 'BEKLETMEDE', ACTIVE_WORK_ORDER: 'AKTİF İŞ EMRİ', FIRST_PIECE: 'İLK PARÇA', READY_IDLE: 'HAZIR · BOŞTA', UNKNOWN: 'BİLİNMİYOR',
};
export const AVAILABILITY_TR = { READY: 'Kullanıma hazır', DOWN: 'Arızalı', MAINTENANCE: 'Bakımda', HOLD: 'Bekletmede', UNKNOWN: 'Bilinmiyor' };
export const PHYSICAL_TR = 'Fiziksel çalışma: BİLİNMİYOR (CNC bağlantısı yok)';
export function machineState(i) {
    const availability = i.status === 'UP' ? 'READY' : i.status === 'DOWN' ? 'DOWN' : i.status === 'MAINTENANCE' ? 'MAINTENANCE' : i.status === 'HOLD' ? 'HOLD' : 'UNKNOWN';
    const workOrderActivity = i.active.some((a) => a.runStatus === 'IN_PROGRESS') ? 'ACTIVE'
        : i.active.some((a) => a.runStatus === 'FIRST_PIECE_PENDING' || a.runStatus === 'FIRST_PIECE_APPROVED') ? 'FIRST_PIECE' : 'NONE';
    const headline = availability === 'DOWN' ? 'DOWN' : availability === 'MAINTENANCE' ? 'MAINTENANCE' : availability === 'HOLD' ? 'HOLD'
        : availability === 'UNKNOWN' ? 'UNKNOWN' : workOrderActivity === 'ACTIVE' ? 'ACTIVE_WORK_ORDER' : workOrderActivity === 'FIRST_PIECE' ? 'FIRST_PIECE' : 'READY_IDLE';
    return { availability, workOrderActivity, physical: 'UNKNOWN', headline, conflict: availability !== 'READY' && availability !== 'UNKNOWN' && workOrderActivity !== 'NONE' };
}
