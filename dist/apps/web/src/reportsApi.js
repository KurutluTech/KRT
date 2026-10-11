export function createReportsApi(client, session) {
    return {
        definitions: async () => {
            const [defs, versions] = await Promise.all([
                client.select('report_definitions', { columns: 'code,title_tr,domain,kind,default_params,required_action,available,unavailable_reason,formula_version,formula_tr,economic,family', order: 'domain.asc,code.asc' }, session),
                client.select('report_formula_versions', { columns: 'report_code,version,formula_tr,set_at', order: 'set_at.asc' }, session),
            ]);
            // append-only formula history: the latest version wins (same rule as kmi_next.report_formula_version)
            for (const v of versions) {
                const d = defs.find((x) => x.code === v.reportCode);
                if (d) {
                    d.formulaVersion = v.version;
                    d.formulaTr = v.formulaTr;
                }
            }
            return defs;
        },
        runs: () => client.select('report_runs', { columns: 'id,report_code,params,status,missing,row_count,fingerprint,trigger,generated_at,formula_version', order: 'generated_at.desc', limit: 80 }, session),
        generate: (code, params) => client.rpc('generate_report', { p_code: code, p_params: params }, session),
        run: (id) => client.rpc('report_run', { p_id: id }, session),
        scheduleStatus: () => client.rpc('report_schedule_status', {}, session),
        setSchedule: (code, enabled, reason) => client.rpc('set_report_schedule', { p_code: code, p_enabled: enabled, p_reason: reason }, session),
        accessMatrix: () => client.rpc('report_access_matrix', {}, session),
    };
}
