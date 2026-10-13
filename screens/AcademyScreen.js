// KMI NEXT — Akademi & Yetkinlik (matrix items 32/33). Migration 0031.
// Rozet merdiveni: her kişinin yetkinlikleri seviye rozetiyle (ÖĞRENCİ → USTA), süresi dolan
// yetkinlik gri/çarpılı. Seviyeyi yalnız yetkili onaylayıcı değiştirir (gerekçeli, kayıtlı);
// Akademi yolu: modül → kayıt → eğitim → değerlendirme → BAŞARILI ise seviye yükselir.
// "Onaylı yetkinlik" sayısı bilgi amaçlıdır; puantaj formülüne bağlı DEĞİLDİR (D-001).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { masteryBadgeSvg } from '../../../../packages/ui/src/badge.js';
import { ENROLLMENT_TR, MASTERY_TR, approvedSkillCount, canAdvanceEnrollment, canChangeSkillLevel, canRecordAssessment, } from '../../../../packages/domain/src/competency.js';
import { errorText as sharedErrorText } from '../errorText.js';
function istanbulToday() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
const STATE_TR = { VALID: '', EXPIRING_SOON: 'süresi doluyor', EXPIRED: 'SÜRESİ DOLDU' };
const errText = (e) => sharedErrorText(e);
export async function renderAcademyScreen(container, api, state = {}) {
    const today = state.today ?? istanbulToday();
    let matrix = [];
    let skills = [];
    let people = [];
    let machines = [];
    let reqs = [];
    let modules = [];
    let enrollments = [];
    let loadError = null;
    try {
        [matrix, skills, people, machines, reqs, modules, enrollments] = await Promise.all([
            api.matrix(), api.skills(), api.people(), api.machines(), api.requirements(), api.modules(), api.enrollments(),
        ]);
    }
    catch (err) {
        loadError = errText(err);
    }
    const rerender = (banner) => void renderAcademyScreen(container, api, { ...state, banner });
    const run = async (fn, okText) => {
        try {
            await fn();
            rerender({ kind: 'ok', text: okText });
        }
        catch (err) {
            rerender({ kind: 'error', text: errText(err) });
        }
    };
    const refuse = (reason) => rerender({ kind: 'error', text: reason ?? 'REFUSED' });
    const personName = (id) => people.find((p) => p.id === id)?.name ?? '—';
    const skillName = (code) => skills.find((s) => s.code === code)?.name ?? code;
    const activePeople = people.filter((p) => p.active);
    const sel = (testid, opts, first) => h('select', { 'data-testid': testid }, ...(first !== undefined ? [h('option', { value: '' }, first)] : []), ...opts.map(([v, t]) => h('option', { value: v }, t)));
    const input = (testid, attrs = {}) => h('input', { 'data-testid': testid, ...attrs });
    const badge = (r) => {
        const span = h('span', { 'data-testid': 'ac-badge', 'data-skill': r.skillCode, 'data-level': String(r.level), 'data-state': r.state,
            style: 'display:inline-flex;align-items:center;gap:4px;margin:2px 8px 2px 0;font-size:13px' });
        const icon = h('span', {});
        icon.innerHTML = masteryBadgeSvg(r.level, r.state, 28, r.skillName); // label is escaped inside
        span.appendChild(icon);
        span.appendChild(document.createTextNode(`${r.skillName} · ${MASTERY_TR[r.level]}${STATE_TR[r.state] ? ` (${STATE_TR[r.state]})` : ''}`));
        return span;
    };
    // ---- level form ----
    const lvPerson = sel('ac-level-person', activePeople.map((p) => [p.id, p.name]), '— personel —');
    const lvSkill = sel('ac-level-skill', skills.filter((s) => s.active).map((s) => [s.code, s.name]), '— yetkinlik —');
    const lvLevel = sel('ac-level-level', [['1', MASTERY_TR[1]], ['2', MASTERY_TR[2]], ['3', MASTERY_TR[3]], ['4', MASTERY_TR[4]], ['REVOKE', 'Kaldır']]);
    const lvUntil = input('ac-level-until', { type: 'date' });
    const lvReason = input('ac-level-reason', { placeholder: 'Gerekçe (en az 10 karakter)' });
    const saveLevel = () => {
        const pid = lvPerson.value;
        const cur = matrix.find((r) => r.personnelId === pid && r.skillCode === lvSkill.value);
        const level = lvLevel.value === 'REVOKE' ? null : Number(lvLevel.value);
        const until = lvUntil.value || null;
        const pre = canChangeSkillLevel({
            actorIsApprover: true, actorPersonnelId: null,
            person: pid ? { id: pid, active: people.find((p) => p.id === pid)?.active ?? false } : null,
            skill: lvSkill.value ? { code: lvSkill.value, active: true } : null,
            currentLevel: cur?.level ?? null, currentValidUntil: cur?.validUntil ?? null, newLevel: level, validUntil: until, reason: lvReason.value, today,
        });
        if (!pre.ok)
            return refuse(pre.reason);
        void run(() => api.setLevel(pid, lvSkill.value, level, until, lvReason.value.trim()), `${personName(pid)}: ${skillName(lvSkill.value)} → ${level === null ? 'kaldırıldı' : MASTERY_TR[level]}`);
    };
    // ---- requirement form ----
    const rqMachine = sel('ac-req-machine', machines.map((m) => [m.id, `${m.code} ${m.name}`]), '— makine —');
    const rqSkill = sel('ac-req-skill', skills.filter((s) => s.active).map((s) => [s.code, s.name]), '— yetkinlik —');
    const rqLevel = sel('ac-req-level', [['3', `en az ${MASTERY_TR[3]}`], ['4', `en az ${MASTERY_TR[4]}`], ['2', `en az ${MASTERY_TR[2]}`], ['REMOVE', 'Şartı kaldır']]);
    const rqReason = input('ac-req-reason', { placeholder: 'Gerekçe' });
    const saveReq = () => {
        if (!rqMachine.value || !rqSkill.value)
            return refuse('MACHINE_AND_SKILL_REQUIRED');
        if (rqReason.value.trim().length < 5)
            return refuse('REASON_REQUIRED');
        const lvl = rqLevel.value === 'REMOVE' ? null : Number(rqLevel.value);
        void run(() => api.setRequirement(rqMachine.value, rqSkill.value, lvl, rqReason.value.trim()), 'Makine yetkinlik şartı kaydedildi.');
    };
    // ---- module form ----
    const mdCode = input('ac-mod-code', { placeholder: 'Kod (ör. AX5-L3)' });
    const mdTitle = input('ac-mod-title', { placeholder: 'Başlık' });
    const mdSkill = sel('ac-mod-skill', skills.filter((s) => s.active).map((s) => [s.code, s.name]), '— yetkinlik —');
    const mdTarget = sel('ac-mod-target', [['3', MASTERY_TR[3]], ['2', MASTERY_TR[2]], ['4', MASTERY_TR[4]]]);
    const mdValidity = input('ac-mod-validity', { type: 'number', min: '1', placeholder: 'Geçerlilik (ay, boş = süresiz)' });
    const mdPass = input('ac-mod-pass', { type: 'number', min: '0', max: '100', placeholder: 'Geçme notu (boş = yok)' });
    const mdContent = h('textarea', { 'data-testid': 'ac-mod-content', placeholder: 'Eğitim içeriği (en az 20 karakter)', rows: '3' });
    const saveModule = () => {
        void run(() => api.createModule({
            code: mdCode.value.trim(), title: mdTitle.value.trim(), skillCode: mdSkill.value, targetLevel: Number(mdTarget.value),
            validityMonths: mdValidity.value ? Number(mdValidity.value) : null, passMark: mdPass.value ? Number(mdPass.value) : null, content: mdContent.value,
        }), 'Modül oluşturuldu.');
    };
    // ---- enroll form ----
    const enModule = sel('ac-enroll-module', modules.filter((m) => m.active).map((m) => [m.id, `${m.code} — ${m.title}`]), '— modül —');
    const enPerson = sel('ac-enroll-person', activePeople.map((p) => [p.id, p.name]), '— kursiyer —');
    const enTrainer = sel('ac-enroll-trainer', activePeople.map((p) => [p.id, p.name]), '— eğitmen (isteğe bağlı) —');
    const saveEnroll = () => {
        if (!enModule.value || !enPerson.value)
            return refuse('MODULE_AND_PERSON_REQUIRED');
        void run(() => api.enroll(enModule.value, enPerson.value, enTrainer.value || null), `${personName(enPerson.value)} modüle kaydedildi.`);
    };
    const enrollmentRow = (e) => {
        const mod = modules.find((m) => m.id === e.moduleId);
        const reason = input('ac-en-reason', { placeholder: 'İptal gerekçesi' });
        const step = (to, text) => {
            const pre = canAdvanceEnrollment(e.status, to, to === 'CANCELLED' ? reason.value : null);
            if (!pre.ok)
                return refuse(pre.reason);
            void run(() => api.advance(e.id, to, to === 'CANCELLED' ? reason.value.trim() : null), text);
        };
        const result = sel('ac-as-result', [['PASS', 'BAŞARILI'], ['FAIL', 'BAŞARISIZ']]);
        const score = input('ac-as-score', { type: 'number', min: '0', max: '100', placeholder: 'Puan' });
        const evidence = input('ac-as-evidence', { placeholder: 'Kanıt / gözlem (en az 10 karakter)' });
        const assess = () => {
            const sc = score.value === '' ? null : Number(score.value);
            const pre = canRecordAssessment({ actorIsApprover: true, actorPersonnelId: null, traineeId: e.personnelId, status: e.status,
                result: result.value, score: sc, passMark: mod?.passMark ?? null, evidence: evidence.value });
            if (!pre.ok)
                return refuse(pre.reason);
            void run(() => api.assess(e.id, result.value, sc, evidence.value.trim()), `Değerlendirme kaydedildi: ${result.value === 'PASS' ? 'BAŞARILI' : 'BAŞARISIZ'}`);
        };
        const open = ['ENROLLED', 'IN_TRAINING', 'ASSESSMENT_PENDING', 'FAILED'].includes(e.status);
        return h('div', { 'data-testid': 'ac-enrollment', 'data-id': e.id, 'data-status': e.status, style: 'border:1px solid #e2e8f0;border-radius:10px;padding:8px;margin:6px 0' }, h('div', {}, h('b', {}, personName(e.personnelId)), ` — ${mod ? `${mod.code} ${mod.title}` : '?'} · `, h('span', { 'data-testid': 'ac-en-status' }, ENROLLMENT_TR[e.status]), e.trainerPersonnelId ? ` · eğitmen: ${personName(e.trainerPersonnelId)}` : '', mod ? ` · hedef: ${MASTERY_TR[mod.targetLevel]}${mod.passMark !== null ? ` · geçme notu ${mod.passMark}` : ''}` : ''), open ? h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin-top:6px' }, e.status === 'ENROLLED' || e.status === 'FAILED' ? h('button', { type: 'button', 'data-testid': 'ac-en-start', onClick: () => step('IN_TRAINING', 'Eğitim başladı.') }, e.status === 'FAILED' ? 'Tekrar eğitime al' : 'Eğitime başla') : null, e.status === 'IN_TRAINING' ? h('button', { type: 'button', 'data-testid': 'ac-en-ready', onClick: () => step('ASSESSMENT_PENDING', 'Değerlendirmeye alındı.') }, 'Değerlendirmeye al') : null, e.status === 'ASSESSMENT_PENDING' ? h('span', { style: 'display:flex;flex-wrap:wrap;gap:6px' }, result, score, evidence, h('button', { type: 'button', 'data-testid': 'ac-as-save', onClick: assess }, 'Değerlendir')) : null, reason, h('button', { type: 'button', 'data-testid': 'ac-en-cancel', onClick: () => step('CANCELLED', 'Kayıt iptal edildi.') }, 'İptal')) : null);
    };
    const box = (title, ...children) => h('section', { style: 'border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin:12px 0' }, h('h2', { style: 'margin-top:0;font-size:18px' }, title), ...children);
    const formRow = (...children) => h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:center' }, ...children);
    const screen = h('div', { class: 'academy-screen', style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, h('h1', { 'data-testid': 'ac-heading' }, 'Akademi & Yetkinlik'), state.banner ? h('div', { 'data-testid': 'ac-banner', 'data-kind': state.banner.kind, style: `padding:10px;border-radius:8px;background:${state.banner.kind === 'ok' ? '#dcfce7' : '#fee2e2'}` }, state.banner.text) : null, loadError ? h('div', { 'data-testid': 'ac-load-error' }, `Yüklenemedi: ${loadError}`) : null, loadError ? null : box('Rozet merdiveni', h('p', { style: 'font-size:12px;color:#555' }, 'ÖĞRENCİ → GÖZETİMLİ → BAĞIMSIZ → USTA. Süresi dolan yetkinlik çalışmaya izin vermez. "Onaylı" sayısı bilgi amaçlıdır, puantaja bağlı değildir.'), activePeople.length === 0 ? h('div', { 'data-testid': 'ac-no-people' }, 'KMI personel listesi boş — önce personel kaydı gerekir.') : null, ...activePeople.map((p) => {
        const rows = matrix.filter((r) => r.personnelId === p.id);
        return h('div', { 'data-testid': 'ac-person', 'data-person': p.id, style: 'border-top:1px solid #f1f5f9;padding:8px 0' }, h('div', {}, h('b', {}, p.name), ' · ', h('span', { 'data-testid': 'ac-approved', 'data-count': String(approvedSkillCount(rows.map((r) => ({ skillCode: r.skillCode, level: r.level, validUntil: r.validUntil })), today)) }, `Onaylı yetkinlik: ${approvedSkillCount(rows.map((r) => ({ skillCode: r.skillCode, level: r.level, validUntil: r.validUntil })), today)}`)), rows.length ? h('div', { style: 'display:flex;flex-wrap:wrap' }, ...rows.map(badge)) : h('div', { style: 'color:#64748b' }, 'Yetkinlik kaydı yok.'));
    }), h('h3', {}, 'Seviye değiştir (yetkili onay)'), formRow(lvPerson, lvSkill, lvLevel, h('label', {}, 'Geçerlilik sonu: ', lvUntil), lvReason, h('button', { type: 'button', 'data-testid': 'ac-level-save', onClick: saveLevel }, 'Kaydet'))), loadError ? null : box('Akademi', h('div', {}, ...modules.map((m) => h('div', { 'data-testid': 'ac-module', 'data-code': m.code }, `${m.code} — ${m.title} · ${skillName(m.skillCode)} → ${MASTERY_TR[m.targetLevel]}${m.validityMonths ? ` · ${m.validityMonths} ay geçerli` : ' · süresiz'}${m.passMark !== null ? ` · geçme notu ${m.passMark}` : ''}`))), modules.length === 0 ? h('div', { 'data-testid': 'ac-no-modules', style: 'color:#64748b' }, 'Henüz modül yok.') : null, h('h3', {}, 'Yeni modül'), formRow(mdCode, mdTitle, mdSkill, mdTarget, mdValidity, mdPass), mdContent, h('button', { type: 'button', 'data-testid': 'ac-mod-save', onClick: saveModule }, 'Modül oluştur'), h('h3', {}, 'Kayıt'), formRow(enModule, enPerson, enTrainer, h('button', { type: 'button', 'data-testid': 'ac-enroll-save', onClick: saveEnroll }, 'Kaydet')), ...enrollments.map(enrollmentRow)), loadError ? null : box('Makine yetkinlik şartları', h('p', { style: 'font-size:12px;color:#555' }, 'Şartı tanımlı makinede, şartı karşılamayan operatöre iş atanamaz ve iş başlatılamaz (Akıllı Atama ile birlikte devreye girer).'), ...reqs.map((r) => h('div', { 'data-testid': 'ac-req', 'data-machine': r.machineId, 'data-skill': r.skillCode }, `${machines.find((m) => m.id === r.machineId)?.code ?? '?'}: ${skillName(r.skillCode)} en az ${MASTERY_TR[r.minLevel]} — ${r.reason}`)), formRow(rqMachine, rqSkill, rqLevel, rqReason, h('button', { type: 'button', 'data-testid': 'ac-req-save', onClick: saveReq }, 'Kaydet'))));
    mount(container, screen);
}
