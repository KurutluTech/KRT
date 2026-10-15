const DAY = 864e5;
export function buildDemand(orders, items, wos, productCode, todayIso) {
    const ord = new Map(orders.map((o) => [o.id, o]));
    const covered = new Map();
    for (const w of wos)
        if (w.status !== 'CANCELLED')
            covered.set(w.orderItemId, (covered.get(w.orderItemId) ?? 0) + w.qtyPlanned);
    const today = Date.parse(todayIso.slice(0, 10));
    const rows = [];
    for (const it of items) {
        const o = ord.get(it.orderId);
        if (!o || o.status === 'DRAFT' || o.status === 'CANCELLED' || o.status === 'CLOSED' || o.status === 'SHIPPED')
            continue;
        const cov = covered.get(it.id) ?? 0, remaining = Math.max(0, it.qty - cov);
        if (remaining <= 0)
            continue;
        const due = Date.parse(it.dueDate);
        const days = Number.isFinite(due) ? Math.round((due - today) / DAY) : null;
        rows.push({ itemId: it.id, orderId: o.id, customerPo: o.customerPo, orderStatus: o.status, product: productCode(it.productId), qty: it.qty, covered: cov, remaining, dueDate: it.dueDate, daysToDue: days, late: days !== null && days < 0, canCreate: o.status === 'CONFIRMED' || o.status === 'IN_PRODUCTION' || o.status === 'PARTIALLY_SHIPPED', why: o.status === 'CONFIRMED' || o.status === 'IN_PRODUCTION' || o.status === 'PARTIALLY_SHIPPED' ? null : 'Sipariş onaylanmadan iş emri açılmaz' });
    }
    return rows.sort((a, b) => (a.daysToDue ?? 9e9) - (b.daysToDue ?? 9e9));
}
