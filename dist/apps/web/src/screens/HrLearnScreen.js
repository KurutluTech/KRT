// KMI NEXT — Çalışan Academy görünümü: planlarım, dersler (PDF/video/metin), çoktan seçmeli sınav, beceri haritası, sertifikalar, rozetler.
// Doğru cevap hiçbir zaman istemciye gelmez (sunucu hr_exam_attempt_view yalnız soru+seçenek etiketi döndürür). Sınav sayacı/süre sunucudadır.
import { h } from '../../../../packages/ui/src/h.js';
import { renderBadgesScreen } from './BadgesScreen.js';
const errText = (e) => (e && (e.message || e.error || String(e))) || 'Hata';
const KIND_TR = { PDF: 'PDF', VIDEO: 'Video', TEXT: 'Metin' };
export async function learnBody(api, tab, state, go) {
    if (tab === 'akademi') {
        if (state.attempt) return examView(api, state, go);
        const a = await api.myAcademy();
        return h('div', { 'data-testid': 'hr-academy' }, ...(a.plans.length ? a.plans.map((p) => h('div', { class: 'card', 'data-testid': 'hr-plan' }, h('b', {}, `${p.title}`), h('div', { class: 'mut' }, `${p.code} · son tarih ${p.due || '—'} · ${p.status}`),
            ...p.lessons.map((l) => h('div', { 'data-testid': 'hr-lesson' }, `${l.seq}. ${l.title} (${KIND_TR[l.kind] || l.kind}) `, l.ref ? h('a', { href: l.ref, target: '_blank', rel: 'noopener' }, 'Aç') : h('span', { class: 'mut' }, 'içerik yüklenmedi'), ` ${l.done ? '✔' : `${l.seconds_viewed}/${l.min_seconds} sn`} `,
                l.done ? null : h('button', { onClick: async () => { try { await api.lessonProgress(l.id, Math.max(l.min_seconds, 30)); go({}); } catch (e) { go({ message: errText(e) }); } } }, 'İzledim/okudum'))),
            p.exam ? h('div', {}, h('div', { class: 'mut' }, `Sınav: ${p.exam.questions} soru · geçme %${p.exam.pass_pct} · ${p.exam.limit_minutes} dk · hak ${p.exam.attempts_used}/${p.exam.max_attempts}`),
                h('button', { 'data-testid': 'hr-exam-start', onClick: async () => { try { go({ attempt: await api.examStart(p.exam.id) }); } catch (e) { go({ message: errText(e) }); } } }, 'Sınava başla')) : h('div', { class: 'mut' }, 'Bu kurs için sınav tanımlı değil.'))) : [h('div', { class: 'card mut' }, 'Size atanmış eğitim yok. Yöneticiniz Academy ekranından eğitim atayabilir.')]));
    }
    if (tab === 'beceri') {
        const [m, a, b] = await Promise.all([api.mySkillmap(), api.myAcademy(), api.myBadges()]);
        const bySkill = {}; m.standards.forEach((s) => { (bySkill[s.skill] = bySkill[s.skill] || []).push(s); });
        return h('div', { 'data-testid': 'hr-skillmap' },
            h('div', { class: 'card' }, h('b', {}, 'Beceri haritam'), ...(m.current.length ? m.current.map((c) => h('div', {}, `${c.skill}: seviye ${c.level}/10`, h('div', { style: 'height:8px;background:#334155;border-radius:4px' }, h('div', { style: `height:8px;border-radius:4px;background:#22c55e;width:${Math.min(100, c.level * 10)}%` })), (bySkill[c.skill] || []).filter((s) => s.level === c.level + 1).map((s) => h('div', { class: 'mut' }, `Sonraki seviye ${s.level}: ${s.descriptor} · en az ${s.min_months} ay deneyim${s.exam ? ' · sınav' : ''}${s.practical ? ' · uygulamalı' : ''}`)))) : [h('div', { class: 'mut' }, 'Doğrulanmış beceri kaydı yok.')])),
            h('div', { class: 'card' }, h('b', {}, 'Başvurularım'), ...(m.claims.length ? m.claims.map((c) => h('div', {}, `${c.skill} → ${c.target_level}: ${c.status}`)) : [h('div', { class: 'mut' }, 'Henüz yok. Sınav ve uygulamalı değerlendirme geçildiğinde kendiliğinden açılır; yetkiyi yönetim ayrıca doğrular.')])),
            h('div', { class: 'card', 'data-testid': 'hr-certs' }, h('b', {}, 'Sertifikalarım'), ...(a.certificates.length ? a.certificates.map((c) => h('div', {}, `${c.no} — ${c.course} (${String(c.issued).slice(0, 10)})`)) : [h('div', { class: 'mut' }, 'Sertifika yok.')])),
            h('div', { class: 'card', 'data-testid': 'hr-badges' }, h('b', {}, 'Rozetlerim'), ...(b.length ? b.map((x) => h('div', {}, `🏅 ${x.family} — kademe ${x.tier}`)) : [h('div', { class: 'mut' }, 'Rozet yok.')])));
    }
    if (tab === 'rozet') {
        // Mevcut Rozetlerim ekranı (kademeler, kanıt, tek seferlik kutlama) İK pasaportunda aynen kullanılır; yetki sunucuda (badge_profile kapısı).
        const box = h('div', { 'data-testid': 'hr-rozet' });
        await renderBadgesScreen(box, { ...api.badges, profile: (id) => api.badges.profile(id) }, { personnelId: state.personnelId ?? null });
        return box;
    }
    if (tab === 'istasyon') return stationView(api, state, go);
    return null;
}
const QR_RE = /KMI-ST:[A-Z0-9_-]{2,40}:[0-9a-f]{64}/;
// QR eğitim istasyonu: yalnız ilgili kursa YÖNLENDİRİR. Okutmak/eğitimi bitirmek makine yetkisi veya beceri vermez (sunucu da hiçbir yetki yazmaz).
async function stationView(api, state, go) {
    const payload = state.qr || null;
    if (payload && state.qrRes === undefined && state.qrErr === undefined) {
        try { state.qrRes = await api.stationResolve(payload); } catch (e) { state.qrErr = /QR_INVALID/.test(errText(e)) ? 'QR_INVALID' : errText(e); }
    }
    const inp = h('input', { placeholder: 'QR bağlantısını veya KMI-ST kodunu yapıştırın', 'data-testid': 'hr-qr-input', 'aria-label': 'QR kodu' });
    const open = h('button', { 'data-testid': 'hr-qr-open', onClick: () => { const m = QR_RE.exec(decodeURIComponent(inp.value || '')); if (!m) return go({ qr: null, qrRes: undefined, qrErr: 'QR_INVALID' }); go({ qr: m[0], qrRes: undefined, qrErr: undefined }); } }, 'Aç');
    const parts = [h('div', { class: 'card' }, h('b', {}, 'QR eğitim istasyonu'), h('div', { class: 'mut' }, 'Tezgâhtaki QR kodu telefonunuzun kamerasıyla okutun; ilgili eğitime yönlendirilirsiniz. Eğitimi bitirmek veya sınavı geçmek makine yetkisi vermez.'), inp, open)];
    if (state.qrErr) parts.push(h('div', { class: 'err', role: 'alert', 'data-testid': 'hr-qr-invalid' }, state.qrErr === 'QR_INVALID' ? 'Bu QR geçersiz veya eskimiş. Tezgâhtaki güncel QR’ı okutun ya da yöneticinize bildirin.' : state.qrErr));
    const r = state.qrRes;
    if (r && r.available === false) parts.push(h('div', { class: 'card', 'data-testid': 'hr-qr-unavailable' }, h('b', {}, r.station.title), h('div', { class: 'mut' }, 'Bu istasyonun eğitimi henüz yayında değil. Yöneticinizle konuşun.')));
    if (r && r.available) parts.push(h('div', { class: 'card', 'data-testid': 'hr-qr-result' }, h('b', {}, r.station.title), h('div', { class: 'mut' }, [r.station.machine_ref && `Makine: ${r.station.machine_ref}`, r.station.operation_ref && `Operasyon: ${r.station.operation_ref}`].filter(Boolean).join(' · ') || ' '),
        h('div', {}, `Eğitim: ${r.course.title}`), h('div', { class: 'mut' }, r.my_plan_status ? `Planınızdaki durum: ${r.my_plan_status}` : 'Bu kurs size atanmamış; yöneticiniz plana ekleyebilir.'),
        h('button', { 'data-testid': 'hr-qr-go', onClick: () => go({ tab: 'akademi', qr: null, qrRes: undefined, qrErr: undefined }) }, 'Academy’ye git'), h('div', { class: 'mut', 'data-testid': 'hr-qr-note' }, r.note)));
    return h('div', { 'data-testid': 'hr-istasyon' }, ...parts);
}
function examView(api, state, go) {
    const at = state.attempt, picked = {};
    return h('div', { 'data-testid': 'hr-exam' }, h('div', { class: 'card' }, h('b', {}, 'Sınav'), h('div', { class: 'mut' }, `Bitiş: ${String(at.due_at).replace('T', ' ').slice(0, 16)} — süre sunucuda tutulur, geç teslim 0 sayılır.`)),
        ...at.questions.map((q, i) => h('div', { class: 'card', 'data-testid': 'hr-q' }, h('div', {}, `${i + 1}. ${q.body}`), ...q.options.map((o) => h('label', { style: 'display:block;min-height:44px;padding:6px 0' }, h('input', { type: 'radio', name: q.question_id, onChange: () => { picked[q.question_id] = o.option_id; } }), ' ' + o.label)))),
        h('button', { 'data-testid': 'hr-exam-submit', onClick: async () => { try { const r = await api.examSubmit(at.attempt_id, picked); go({ attempt: null, message: `Sonuç: %${r.score_pct} — ${r.passed ? 'GEÇTİNİZ' : 'GEÇEMEDİNİZ'}${r.late ? ' (süre aşıldı)' : ''}${r.certificate_no ? ' · Sertifika ' + r.certificate_no : ''}` }); } catch (e) { go({ message: errText(e) }); } } }, 'Teslim et'));
}
