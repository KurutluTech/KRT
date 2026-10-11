export function createEngineeringApi(client, session) {
    return {
        async load() {
            const [products, revisions, bom, programs, tools] = await Promise.all([
                client.select('products', { columns: 'id,code,name', order: 'code.asc', limit: 2000 }, session),
                client.select('product_revisions', { columns: 'id,product_id,revision,status', order: 'created_at.asc', limit: 5000 }, session),
                client.select('bom_lines', { columns: 'id,product_revision_id,material_code,qty_per_unit,scrap_allowance_pct', order: 'material_code.asc', limit: 20000 }, session),
                client.select('cam_programs', { columns: 'id,product_revision_id,program_no,revision,status,ideal_cycle_seconds', order: 'created_at.asc', limit: 5000 }, session),
                client.select('cam_program_tools', { columns: 'id,cam_program_id,tool_type,qty', order: 'tool_type.asc', limit: 20000 }, session),
            ]);
            return { products, revisions, bom: bom.map((b) => ({ ...b, qtyPerUnit: Number(b.qtyPerUnit), scrapAllowancePct: Number(b.scrapAllowancePct) })), programs, tools };
        },
        async createProduct(code, name) { await client.rpc('create_product', { p_code: code, p_name: name }, session); },
        async createRevision(productId, revision) { await client.rpc('create_product_revision', { p_product_id: productId, p_revision: revision }, session); },
        async addBomLine(revisionId, materialCode, qty, scrap) { await client.rpc('add_bom_line', { p_revision_id: revisionId, p_material_code: materialCode, p_qty_per_unit: qty, p_scrap_allowance_pct: scrap }, session); },
        async releaseRevision(revisionId) { await client.rpc('release_product_revision', { p_revision_id: revisionId }, session); },
        async createProgram(revisionId, programNo, revision) { await client.rpc('create_cam_program', { p_revision_id: revisionId, p_program_no: programNo, p_revision: revision }, session); },
        async addTool(programId, toolType, qty) { await client.rpc('add_cam_program_tool', { p_program_id: programId, p_tool_type: toolType, p_qty: qty }, session); },
        async setCycleTime(programId, seconds) { await client.rpc('set_cam_program_cycle_time', { p_cam_program_id: programId, p_seconds: seconds }, session); },
        async releaseProgram(programId) { await client.rpc('release_cam_program', { p_program_id: programId }, session); },
    };
}
