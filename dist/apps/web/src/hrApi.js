// KMI NEXT — İK entegre departmanı (m0232–m0237) RPC sarmalayıcısı. Yalnız bu dosyadaki RPC'ler çağrılır; tablolara doğrudan erişim YOKTUR.
export function createHrApi(client, session) {
    const r = (name, args = {}) => client.rpc(name, args, session);
    return {
        myPersonnelId: () => r('actor_personnel_id'),
        payAccess: () => r('cost_pay_access', {}),
        payPassport: (id, period) => r('hr_passport_pay', { p_personnel: id, p_period: period ?? null }),
        passport: (id) => r('hr_personnel_passport', { p_personnel: id }),
        linkStatus: (id) => r('hr_identity_link_status', { p_personnel: id }),
        employmentChange: (a) => r('hr_employment_change', { p_personnel: a.personnel, p_effective: a.effective, p_title: a.title || null, p_dept: a.dept || null, p_duty: a.duty || null, p_shift: a.shift || null, p_reason: a.reason }),
        attendance: (id, month) => r('hr_attendance_get', { p_personnel: id, p_month: month }),
        attendanceCompute: (from, to, reason) => r('hr_attendance_compute', { p_from: from, p_to: to, p_reason: reason }),
        absenceCandidates: (month) => r('hr_absence_candidates', { p_month: month }),
        leaveRequest: (id, from, to, type, note) => r('hr_leave_request', { p_personnel: id, p_from: from, p_to: to, p_type: type, p_note: note || null }),
        examStart: (examId) => r('hr_exam_start', { p_exam: examId }),
        examSubmit: (attemptId, answers) => r('hr_exam_submit', { p_attempt: attemptId, p_answers: answers }),
        lessonProgress: (lessonId, seconds) => r('hr_lesson_progress', { p_lesson: lessonId, p_seconds: seconds }),
        perfOwn: (month) => r('hr_perf_get_own', { p_month: month }),
        primMyLine: (month) => r('hr_prim_my_line', { p_month: month }),
        primSimulate: (a) => r('hr_prim_simulate', { p_month: a.month, p_perf: a.perf, p_prim: a.prim, p_pool: a.pool, p_mode: a.mode || 'OFFICIAL' }),
        zirveBoard: (month, league) => r('hr_zirve_board', { p_month: month, p_league: league || 'ALL' }),
        zirveLast3: (month) => r('hr_zirve_last3', { p_upto_month: month }),
        zirveImproved: (month) => r('hr_zirve_most_improved', { p_month: month, p_limit: 5 }),
        zirveCard: (id) => r('hr_zirve_player_card', { p_personnel: id }),
        call: (name, args = {}) => { if (!/^(hr_|gecko_identifiers$|set_gecko_identifier_link$)/.test(name)) throw new Error('İzinsiz RPC: ' + name); return r(name, args); },
        adminList: (kind, arg) => kind === 'question_bank' ? r('hr_question_bank', { p_course: arg ?? null }) : kind === 'question_coverage' ? r('hr_question_coverage', {}) : kind === 'qcourses' ? r('hr_question_courses', {}) : kind === 'question_expert' ? r('hr_question_expert_list', {}) : kind === 'stations' ? r('hr_stations_list', {}) : r('hr_admin_list', { p_kind: kind, p_arg: arg ?? null }),
        myAcademy: () => r('hr_my_academy'),
        mySkillmap: () => r('hr_my_skillmap'),
        myBadges: () => r('hr_my_badges'),
        // Mevcut rozet motoru (badge_*): HR pasaportu aynı kaynağı salt-okunur kullanır; ikinci rozet sistemi YOK.
        badges: { myPersonnelId: () => r('actor_personnel_id'), profile: (id) => r('hr_passport_badges', { p_personnel: id }), evaluate: (id) => r('evaluate_badges', { p_personnel_id: id }), markSeen: (id) => r('badge_mark_seen', { p_personnel_id: id }) },
        stationResolve: (payload) => r('hr_station_resolve', { p_payload: payload }),
        geckoSuggestions: () => r('hr_gecko_suggestions'),
        geckoLink: (identifier, personnel, status, reason) => r('set_gecko_identifier_link', { p_identifier: identifier, p_personnel_id: personnel || null, p_status: status, p_reason: reason }),
        goalSet: (month, target, note) => r('hr_personal_goal_set', { p_month: month, p_target: target, p_note: note || null }),
    };
}
