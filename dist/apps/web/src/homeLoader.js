const TIMEOUT = Symbol('timeout');
export function createHomeLoader(d) {
    const now = d.now ?? (() => Date.now());
    const timeoutMs = d.timeoutMs ?? 8000;
    let gen = 0, disposed = false, timer = null;
    const data = { snapshot: null, board: null, info: [], tasks: null, approvalsPending: null, loadedAt: null,
        sources: { snapshot: { state: 'LOADING', at: null }, board: { state: d.board ? 'LOADING' : 'NOT_APPLICABLE', at: null }, tasks: { state: d.tasks ? 'LOADING' : 'NOT_APPLICABLE', at: null }, approvals: { state: d.approvals ? 'LOADING' : 'NOT_APPLICABLE', at: null } } };
    const emit = () => { if (disposed || !d.isMounted())
        return; d.onUpdate({ ...data, sources: { ...data.sources } }); };
    // a failed/timed-out refresh drops the previous value: nothing that could not be re-verified stays on screen looking current
    const clear = (id) => { if (id === 'snapshot')
        data.snapshot = null;
    else if (id === 'board')
        data.board = null;
    else if (id === 'tasks')
        data.tasks = null;
    else
        data.approvalsPending = null; };
    const run = (g, id, fn, apply) => {
        if (!fn)
            return Promise.resolve();
        let to;
        const guard = new Promise((r) => { to = setTimeout(() => r(TIMEOUT), timeoutMs); });
        return Promise.race([fn(), guard]).then((v) => {
            if (g !== gen || disposed)
                return;
            if (v === TIMEOUT) {
                clear(id);
                data.sources[id] = { state: 'TIMEOUT', at: null };
            }
            else {
                apply(v);
                data.sources[id] = { state: 'OK', at: now() };
            }
        }, () => { if (g === gen && !disposed) {
            clear(id);
            data.sources[id] = { state: 'FAILED', at: null };
        } }).finally(() => { clearTimeout(to); if (g === gen) {
            data.loadedAt = now();
            emit();
        } });
    };
    const load = () => {
        const g = ++gen;
        for (const id of ['snapshot', 'board', 'tasks', 'approvals'])
            if (data.sources[id].state !== 'NOT_APPLICABLE' && data.sources[id].state !== 'OK')
                data.sources[id] = { state: 'LOADING', at: null };
        // a refresh keeps the last good value on screen while the new one is on its way
        void run(g, 'snapshot', d.snapshot, (v) => { data.snapshot = v; });
        void run(g, 'board', d.board, (v) => { data.board = v; });
        if (d.info)
            void d.info().then((v) => { if (g === gen && !disposed) {
                data.info = v;
                emit();
            } }, () => { });
        void run(g, 'tasks', d.tasks, (v) => { data.tasks = v; });
        void run(g, 'approvals', d.approvals, (v) => { data.approvalsPending = v; });
        emit();
    };
    return {
        start() {
            load();
            timer = setInterval(() => {
                if (disposed || !d.isMounted()) {
                    dispose();
                    return;
                }
                if (typeof document !== 'undefined' && document.visibilityState === 'hidden')
                    return;
                load();
            }, d.tickMs ?? 60_000);
        },
        refresh() { if (!disposed)
            load(); },
        dispose,
    };
    function dispose() { disposed = true; gen += 1; if (timer) {
        clearInterval(timer);
        timer = null;
    } }
}
