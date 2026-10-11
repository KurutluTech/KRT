const n = (v) => (v === null || v === undefined ? null : Number(v));
export function createOeeApi(client, session) {
    return {
        async lossReasons(from, to) {
            const rows = await client.rpc('oee_loss_reasons', { p_from: from, p_to: to }, session);
            const sum = (k) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
            return { lossOther: sum('lossOther'), qualityWait: sum('qualityWait'), operatorCaused: sum('operatorCaused'), plannedStop: sum('plannedStop'), otherLabeled: sum('otherLabeled'), unknownMinutes: sum('unknownMinutes') };
        },
        async rollup(from, to, group) {
            const rows = await client.rpc('oee_rollup', { p_from: from, p_to: to, p_group: group }, session);
            return rows.map((r) => ({
                ...r,
                plannedMinutes: Number(r.plannedMinutes),
                runMinutes: Number(r.runMinutes),
                idealMinutes: n(r.idealMinutes),
                totalCount: Number(r.totalCount),
                goodCount: Number(r.goodCount),
                lossSetup: Number(r.lossSetup),
                lossTool: Number(r.lossTool),
                lossFault: Number(r.lossFault),
                lossMaterialWait: Number(r.lossMaterialWait),
                lossMaintenance: Number(r.lossMaintenance),
                lossOther: Number(r.lossOther),
                availability: n(r.availability),
                performance: n(r.performance),
                quality: n(r.quality),
                oee: n(r.oee),
            }));
        },
    };
}
