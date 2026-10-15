const MACHINE_TR = { DOWN: 'arızalı', MAINTENANCE: 'bakımda', HOLD: 'bekletmede' };
export function operatorNextStep(j) {
    const ms = j.machineStatus && MACHINE_TR[j.machineStatus];
    if (ms)
        return { kind: 'BLOCKED', text: `Makine ${ms}: amirinize veya bakıma haber verin.`, blocker: `Makine ${ms}` };
    if (j.openQualityHold)
        return { kind: 'BLOCKED', text: 'Kalite bekletmesi açık: kalite kararını bekleyin.', blocker: 'Kalite bekletmesi açık' };
    if (j.firstPiece === 'PENDING')
        return { kind: 'WAIT', text: 'İlk parça kalite onayı bekleniyor: onay gelene kadar bekleyin.', blocker: 'İlk parça onayı bekleniyor' };
    if (j.qtyPlanned > 0 && j.qtyProduced >= j.qtyPlanned)
        return { kind: 'DONE', text: 'Plan adedi tamamlandı: son üretim bildirimini yapın.', blocker: null };
    const left = j.qtyPlanned > 0 ? Math.max(0, j.qtyPlanned - j.qtyProduced) : null;
    return { kind: 'DO', text: left !== null ? `Üretime devam edin ve adedi bildirin (${left} adet kaldı).` : 'Üretime devam edin ve adedi bildirin.', blocker: null };
}
