// Seven strictly separate quantity concepts for one work order (model + rules; DRAFT, mirrors the SQL design).
//  1 entering   : qty arriving at the operation (previous op's released output)
//  2 good       : good output of the operation
//  3 scrap      : scrapped
//  4 tashih     : tahsis/rework (not good, not scrap until resolved)
//  5 transferred: quality-released quantity passed to the NEXT operation
//  6 productionRemaining : target − good − scrap − tashih  (still to be produced/resolved)
//  7 orderRemaining      : customer order qty − shipped/delivered (NEVER derived from production quantities)
export function ledger({ target, entering, good, scrap, tashih, transferred, orderQty, delivered }) {
  const n = (v) => Number(v ?? 0);
  const L = { target: n(target), entering: n(entering), good: n(good), scrap: n(scrap), tashih: n(tashih), transferred: n(transferred), orderQty: n(orderQty), delivered: n(delivered) };
  for (const [k, v] of Object.entries(L)) if (!Number.isFinite(v) || v < 0) throw new Error('BAD_QTY:' + k);
  if (L.good + L.scrap + L.tashih > L.entering) throw new Error('DECLARED_EXCEEDS_ENTERING');
  if (L.transferred > L.good) throw new Error('TRANSFERRED_EXCEEDS_GOOD');
  return { ...L, productionRemaining: Math.max(0, L.target - L.good - L.scrap - L.tashih), orderRemaining: Math.max(0, L.orderQty - L.delivered) };
}
// Short close: management-only, reasoned, audited. Changes NO quality/stock fact, never counts missing qty as good, never completes the customer order.
export function shortClose(l, { actor, reason, at }) {
  if (!actor?.canShortClose) throw new Error('NOT_AUTHORIZED');
  if (!reason || String(reason).trim().length < 10) throw new Error('REASON_REQUIRED');
  if (l.tashih > 0) throw new Error('TASHIH_OPEN');            // unresolved rework must be decided first
  const missing = l.productionRemaining;
  if (missing === 0) throw new Error('NOTHING_TO_CLOSE');
  return {
    ledger: { ...l },                                           // good/scrap/tashih/transferred/orderRemaining are untouched
    operationState: 'SHORT_CLOSED',
    shortfall: missing,                                         // recorded as shortfall, not as good
    orderCompleted: false,                                      // customer order is never auto-completed
    audit: { kind: 'SHORT_CLOSE', by: actor.id, at, reason: String(reason).trim(), shortfall: missing, good: l.good, scrap: l.scrap },
  };
}
