// Rota hazırlık: CUT/PREP · operasyon makine/süre · uç payı · rotayı iş emrine uygula. Yetki/audit/revizyon kuralları sunucuda.
import { auditedRpc } from './auditedRpc.js';
export function createRoutePrepApi(client, session) {
    const call = (fn, args) => auditedRpc(client, fn, args, session);
    return {
        revisions: () => client.select('product_revisions', { columns: 'id,revision,status,product_id', filters: { status: 'in.(DRAFT,RELEASED)' }, order: 'created_at.desc' }, session),
        products: () => client.select('products', { columns: 'id,code,name' }, session),
        machines: () => client.select('machines', { columns: 'id,code,name', order: 'code.asc' }, session),
        routeOps: (rev) => client.select('routing_operations', { columns: 'id,op_no,op_kind,name,allowed_machine_ids,primary_machine_id,setup_minutes_target,cycle_seconds_target,cam_program_id,first_piece_required,qc_required,active', filters: { product_revision_id: `eq.${rev}` }, order: 'op_no.asc' }, session),
        camPrograms: (rev) => client.select('cam_programs', { columns: 'id,program_no,revision,status,routing_operation_id', filters: { product_revision_id: `eq.${rev}`, status: 'eq.RELEASED' } }, session),
        bomLines: (rev) => client.select('bom_lines', { columns: 'id,material_code,qty_per_unit', filters: { product_revision_id: `eq.${rev}` } }, session),
        barSpecs: (lineIds) => lineIds.length ? client.select('bom_bar_specs', { columns: 'bom_line_id,dia_mm,bar_length_mm,cut_length_mm,kerf_mm,end_trim_mm', filters: { bom_line_id: `in.(${lineIds.join(',')})` } }, session) : Promise.resolve([]),
        workOrders: () => client.select('work_orders', { columns: 'id,status,product_revision_id,qty_planned', filters: { status: 'in.(PLANNED,MACHINE_ASSIGNED,ON_HOLD)' } }, session),
        saveCutPrep: (i) => call('routing_cut_prep_save', { p_revision: i.revisionId, p_name: i.name ?? '', p_machine: i.machineId, p_setup: i.setup, p_cycle: i.cycle, p_reason: i.reason }),
        saveOp: (i) => call('routing_op_save', { p_revision: i.revisionId, p_op_no: i.opNo, p_name: i.name, p_machine_ids: i.machineIds, p_primary: i.primary, p_skill_code: null, p_skill_level: null, p_cam: i.camId ?? null, p_setup: i.setup, p_cycle: i.cycle, p_first_piece: i.firstPiece, p_qc: i.qc, p_instructions: null, p_reason: i.reason }),
        setEndTrim: (i) => client.rpc('bom_bar_end_trim_prep_set', { p_revision: i.revisionId, p_material_code: i.material, p_end_trim: i.endTrim, p_reason: i.reason }, session),
        applyRoute: (woId) => call('apply_routing_to_work_order', { p_work_order_id: woId }),
    };
}
