export function createAcademyApi(client, session) {
    return {
        matrix: () => client.rpc('competency_matrix', {}, session),
        skills: () => client.select('skill_catalog', { columns: 'code,name,category,active', order: 'name.asc' }, session),
        people: () => client.select('personnel', { columns: 'id,name,active', order: 'name.asc' }, session),
        machines: () => client.select('machines', { columns: 'id,code,name', order: 'code.asc' }, session),
        requirements: () => client.select('machine_skill_requirements', { columns: 'machine_id,skill_code,min_level,reason' }, session),
        modules: () => client.select('academy_modules', { columns: 'id,code,title,skill_code,target_level,validity_months,pass_mark,content,active', order: 'code.asc' }, session),
        enrollments: () => client.select('academy_enrollments', { columns: 'id,module_id,personnel_id,trainer_personnel_id,status,enrolled_at,updated_at', order: 'enrolled_at.desc' }, session),
        async setLevel(personnelId, skillCode, level, validUntil, reason) {
            await client.rpc('set_personnel_skill_level', { p_personnel_id: personnelId, p_skill_code: skillCode, p_level: level, p_valid_until: validUntil, p_reason: reason }, session);
        },
        async setRequirement(machineId, skillCode, minLevel, reason) {
            await client.rpc('set_machine_skill_requirement', { p_machine_id: machineId, p_skill_code: skillCode, p_min_level: minLevel, p_reason: reason }, session);
        },
        async createModule(m) {
            await client.rpc('create_academy_module', {
                p_code: m.code, p_title: m.title, p_skill_code: m.skillCode, p_target_level: m.targetLevel,
                p_validity_months: m.validityMonths, p_pass_mark: m.passMark, p_content: m.content,
            }, session);
        },
        async enroll(moduleId, personnelId, trainerId) {
            await client.rpc('enroll_in_module', { p_module_id: moduleId, p_personnel_id: personnelId, p_trainer_personnel_id: trainerId }, session);
        },
        async advance(enrollmentId, to, reason) {
            await client.rpc('advance_enrollment', { p_enrollment_id: enrollmentId, p_to_status: to, p_reason: reason }, session);
        },
        async assess(enrollmentId, result, score, evidence) {
            await client.rpc('record_academy_assessment', { p_enrollment_id: enrollmentId, p_result: result, p_score: score, p_evidence: evidence }, session);
        },
    };
}
