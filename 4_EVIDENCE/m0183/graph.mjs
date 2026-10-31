// Statik regresyon: her .js sözdizimi + her göreli import'un dosyası ve adlandırılmış dışa aktarımı var mı
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
const root = process.argv[2]; const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : p.endsWith('.js') && files.push(p); } };
walk(root);
const exp = new Map(); const fail = [];
const exportsOf = (f) => { if (exp.has(f)) return exp.get(f); const s = fs.readFileSync(f, 'utf8'); const n = new Set();
  for (const m of s.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) n.add(m[1]);
  for (const m of s.matchAll(/export\s*\{([^}]*)\}/g)) for (const x of m[1].split(',')) { const t = x.trim().split(/\s+as\s+/).pop(); if (t) n.add(t); }
  if (/export\s*\*\s*from/.test(s)) n.add('*'); exp.set(f, n); return n; };
let syn = 0;
for (const f of files) {
  try { execFileSync('node', ['--check', f], { stdio: 'pipe' }); } catch (e) { fail.push(`SÖZDİZİMİ ${f}: ${String(e.stderr).split('\n').slice(0,4).join(' ')}`); syn++; }
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/import\s*(\{[^}]*\}|[\w$]+|\*\s*as\s+[\w$]+)?\s*(?:from\s*)?['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const t = path.resolve(path.dirname(f), m[2]);
    if (!fs.existsSync(t)) { fail.push(`EKSİK DOSYA ${f} -> ${m[2]}`); continue; }
    if (m[1]?.startsWith('{')) { const ex = exportsOf(t); for (const x of m[1].slice(1, -1).split(',')) { const nm = x.trim().split(/\s+as\s+/)[0]; if (nm && !ex.has(nm) && !ex.has('*')) fail.push(`EKSİK DIŞA AKTARIM ${f}: ${nm} <- ${m[2]}`); } }
  }
}
console.log(`dosya ${files.length}, hata ${fail.length}`); for (const x of fail) console.log(x); process.exit(fail.length ? 1 : 0);
