# Tam regresyon — son aday HEAD `390a1eb7eb89`
Komut: `node scripts/run-tests.mjs` (repo kökünde, temiz ağaç). Ortam: Linux 6.18 (bulut sandbox VM), Node v22.22.2, PostgreSQL 16.13 yerel replica (`kmi_verify`, 0001–0073 uygulanmış; her e2e testi kendi atılabilir `kmi_e2e_<pid>` kopyasında), Playwright + Chromium 1194 (headless). Süre ≈ 23 dk 55 sn.
**Sonuç: çıkış kodu 0 — "ALL TEST FILES PASSED".** 142 test dosyası; 1268 PASS satırı; 0 FAIL satırı; özet satırı veren dosyalarda toplam 1210 geçti / 0 başarısız (kalan 5 dosya özet satırı basmaz, PASS satırları sayıldı); **ATLANAN (SKIPPED) test: 0** ("SKIPPED" geçen tek satır bir durum adıdır: `SKIPPED_DISABLED`).
Replica hazır olmasaydı DB e2e testleri "SKIPPED (NOT a pass)" yazıp sayılmazdı; bu koşuda replica hazırdı (`ensure-replica.sh`).
## 1. koşu (61936b7) — dürüstlük kaydı
135 dosyadan 1 başarısız: `leakScan.test.ts` — TAHSİS sütunu `oversize_amount` para-sızıntı koruması adına takıldı. Sütun `oversize_excess` olarak yeniden adlandırıldı (390a1eb), TAHSİS e2e 6/6 ve replica kanıtı tekrarlandı, regresyon baştan koşuldu. Log: `4_EVIDENCE/full_regression_run1_61936b7_1_FAIL_leakScan.log`.
## Ek kanıtlar
- JWT: app-shell dosyası 16 ardışık koşuda 22/22 (önceden ~%20–25 aralıklı hata); `client.test` 14/14.
- Tohumlu TAHSİS e2e (gerçek şema + 0076, atılabilir DB): 6/6.
- Replica kanıtları (rollback-only): `4_EVIDENCE/replica_proofs/`.
- Yerel doğrulama ≠ canlı doğrulama.
