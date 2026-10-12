# KMI NEXT — Release 004 (aday) · MANUEL YÜKLEME PAKETİ
Commit: `390a1eb7eb892e71217ba5a6ad303346a09acb16` (dal `recovery-004`, çalışma ağacı temiz). **Production'a hiçbir şey yüklenmedi, hiçbir migration uygulanmadı, hiçbir Edge Function/secret değişmedi.**
Canlı (son doğrulanan): `f42c9f0f292b`. Release 003 (`cecd7de`) yüklendiyse bu paket onun üstüne de güvenle yüklenir (tam paket, 187 dosya).

## Üç ayrı paket (birbirine bağlı DEĞİL)
| Paket | Klasör | Zorunlu mu? | Not |
|---|---|---|---|
| 1. Frontend | `1_FRONTEND/` | — | GitHub Pages (`KurutluTech/KRT`) kök dizinine yükleme. `config.js` pakette YOK (canlıdaki dosya kalır). |
| 2. Veritabanı | `2_DB/` | Hayır | Her biri ayrı onay. Uygulanmadan frontend çalışır; ilgili ekranlar "Kurulum bekleniyor" / "VERİ GEREKLİ" der. |
| 3. Edge Function | `3_EDGE/` | — | Bu sürümde Edge değişikliği YOK. (operator-login hâlâ deploy edilmemiş durumda; eski bekleyen iş.) |

## Sıra (öneri)
1. Frontend (`DEPLOY_INSTRUCTIONS.md`) → canlı `RELEASE.json` doğrulaması (ben okurum).
2. DB paketleri yalnız sahip kararıyla, sırayla: 0071–0073 (bekleyen eski) → 0074 → 0075 → 0076 → 0077 → 0078. Her birinin önkoşulu ve geri alma dosyası `MIGRATION_MANIFEST.md` içinde.

## Durum özeti
`ONAYLI_KAPSAM_MATRISI.md` (tam liste) · `REGRESYON_RAPORU.md` · `BILINEN_SINIRLAR.md` · `SHA256_MANIFEST.txt`.

## Not: dal ucu
Test edilen ve paketlenen commit `390a1eb`. Dal ucundaki `f5a5a78` yalnız belge değişikliğidir (derlenen 187 dosyanın hiçbirinin içeriği değişmez; `RELEASE.json` içindeki commit alanı hariç) — paket 390a1eb'den üretilmiştir.
