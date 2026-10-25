export const PLAN_CSS = `
.kd.plan .tb{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.kd.plan .seg button{background:#0f172a;border:1px solid #334155;color:#cbd5e1}.kd.plan .seg button.on{background:#1d4ed8;border-color:#3b82f6;color:#fff}
.kd.plan .cal{overflow-x:auto;border:1px solid #1e293b;border-radius:12px}
.kd.plan table.t{border-collapse:collapse;width:100%;font-size:13px}.kd.plan table.t th,.kd.plan table.t td{border-bottom:1px solid #1e293b;padding:6px 8px;text-align:left;vertical-align:top}
.kd.plan table.t th{color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.06em;background:#0b1220;position:sticky;top:0}
.kd.plan .cal td.cell{min-width:132px;cursor:pointer}.kd.plan .cal td.today{background:rgba(29,78,216,.12)}.kd.plan .cal td.sel{outline:2px solid #67e8f9;outline-offset:-2px}
.kd.plan .mname{font-weight:800;color:#fff;white-space:nowrap}.kd.plan .mname small{display:block;color:#94a3b8;font-weight:400}
.kd.plan .chip{display:block;margin:2px 0;padding:3px 6px;border-radius:8px;background:#1e293b;border:1px solid #334155;font-size:12px;color:#e2e8f0;cursor:pointer;text-align:left;width:100%;min-height:0;font-weight:600}
.kd.plan .chip.STARTED{border-color:#22d3ee;background:#083344}.kd.plan .chip.warn{border-color:#f59e0b}.kd.plan .chip.sel{outline:2px solid #67e8f9}
.kd.plan .load{font-size:11px;color:#94a3b8}.kd.plan .load.over{color:#fca5a5;font-weight:800}
.kd.plan .grid2{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
.kd.plan td.num,.kd.plan th.num{text-align:right;font-variant-numeric:tabular-nums}
.kd.plan .actions{display:flex;gap:4px;flex-wrap:wrap}.kd.plan .actions button{min-height:30px;padding:3px 9px;font-size:12px;background:#1e293b;color:#e2e8f0;border:1px solid #334155}
.kd.plan .actions button.danger{background:#7f1d1d;border-color:#b91c1c}
.kd.plan .reason{font-size:12px;color:#fcd34d}.kd.plan .okr{font-size:12px;color:#86efac}
.kd.plan .overlay{position:fixed;inset:0;background:rgba(2,6,23,.72);display:flex;align-items:flex-start;justify-content:center;z-index:100;overflow:auto;padding:16px}
.kd.plan .dlg{background:#0f172a;border:1px solid #334155;border-radius:14px;padding:16px;width:min(620px,100%);display:flex;flex-direction:column;gap:10px;color:#e2e8f0}
.kd.plan .dlg label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:#94a3b8}.kd.plan .dlg .row{display:flex;gap:8px;flex-wrap:wrap}.kd.plan .dlg .row>*{flex:1;min-width:120px}
.kd.plan .prev{border:1px solid #1e293b;border-radius:10px;padding:10px;background:#0b1220;font-size:13px;display:flex;flex-direction:column;gap:4px}
.kd.plan .prev .bad{color:#fca5a5;font-weight:700}.kd.plan .prev .good{color:#86efac}.kd.plan .prev .unk{color:#fcd34d}
.kd.plan .toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:120;max-width:92vw}
.kd.plan .qgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.kd.plan .srcbox{border:1px dashed #475569;border-radius:12px;padding:10px}
@media (max-width:1100px){.kd.plan .actions button{min-height:44px}}
.kd.plan .qsec h3{font-size:14px;color:#fff;margin:14px 0 6px}.kd.plan .dgrp h4{font-size:12px;color:#94a3b8;margin:10px 0 4px;letter-spacing:.05em}
.kd.plan .qcard{border:1px solid #1e293b;border-radius:12px;padding:10px 12px;margin:6px 0;background:#0b1220;display:flex;flex-direction:column;gap:6px}
.kd.plan .qcard.STARTED{border-color:#22d3ee;background:#06222e}.kd.plan .qcard.sel{outline:2px solid #67e8f9}
.kd.plan .qtop{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.kd.plan .qtitle{flex:1;min-width:140px;font-size:15px}.kd.plan .qqty{font-size:20px;font-weight:800;color:#fff}
.kd.plan .qmid{display:flex;gap:12px;flex-wrap:wrap;font-size:14px}.kd.plan .qactual{font-size:13px;color:#a5f3fc}
.kd.plan .qdet summary{cursor:pointer;color:#94a3b8;font-size:12px}.kd.plan .qdet{font-size:12px;color:#cbd5e1}
.kd.plan .mrow{display:grid;grid-template-columns:84px minmax(0,1fr) minmax(0,1fr) 44px;gap:8px;align-items:center;margin:4px 0}.kd.plan .mrow.mh span{font-size:11px;color:#94a3b8;text-transform:uppercase}
.kd.plan .chk{flex-direction:row!important;align-items:flex-start;gap:8px;color:#e2e8f0!important;font-size:13px!important}
.kd.plan .msum{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}
.kd.plan .mcard{border:1px solid #1e293b;border-radius:12px;padding:10px 12px;background:#0b1220;display:flex;flex-direction:column;gap:4px;cursor:pointer;font-size:13px}
.kd.plan .mcard.sel{outline:2px solid #67e8f9}.kd.plan .mcard b{font-size:15px;color:#fff}
.kd.plan .panel{overflow-x:auto;max-width:100%}
.kd.plan .mdtop{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));align-items:start}
.kd.plan .panel.big{font-size:16px}.kd.plan .panel.big h2{font-size:13px;letter-spacing:.08em;color:#67e8f9;margin:0 0 8px}
.kd.plan .nrow{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid #1e293b;align-items:center}.kd.plan .nrow .nk{color:#94a3b8;font-size:13px}.kd.plan .nrow .nv{text-align:right;font-weight:600}
.kd.plan .bigline{font-size:20px;font-weight:700;color:#fff;margin:2px 0}
.kd.plan .banner.warn{border:1px solid #f59e0b}
@media (max-width:760px){.kd.plan .nrow{flex-direction:column;align-items:flex-start}.kd.plan .nrow .nv{text-align:left}}
@media (max-width:760px){
 .kd.plan table.q thead{display:none}.kd.plan table.q,.kd.plan table.q tbody,.kd.plan table.q tr,.kd.plan table.q td{display:block;width:100%;box-sizing:border-box}
 .kd.plan table.q tr{border:1px solid #1e293b;border-radius:12px;margin:8px 0;padding:6px;background:#0b1220}.kd.plan table.q td{border:0;padding:3px 6px}
 .kd.plan table.q td[data-l]::before{content:attr(data-l) ': ';color:#94a3b8;font-size:11px}
 .kd.plan .cal td.cell{min-width:104px}.kd.plan .actions button{min-height:44px}
}`;
