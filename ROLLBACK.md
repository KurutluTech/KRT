# Geri alma
## Frontend
`1_FRONTEND/ROLLBACK_to_live_f42c9f0f292b/KMI_ROLLBACK_FULL_f42c9f0f292b.zip` = canlı sürümün (`f42c9f0f292b`, 157 dosya) tam, yeniden üretilebilir derlemesi (SHA yan dosyada; 157/157 dosya Release 003 kaydındaki canlı özetlerle aynı derleme). Açıp aynı yollara yükleyin. `FILES_TO_DELETE_AFTER_ROLLBACK.txt` Release 004'te eklenen 30 dosyayı listeler (silinmesi önerilir, silinmese de eski kod onları çağırmaz). `config.js` yine dokunulmaz.
## Veritabanı (yalnız ilgili paket uygulandıysa)
Ters sırayla: `0078_rollback.sql` → `0077` → `0076` → `0075` → `0074` → (gerekirse) `rollback_0071_0073.sql`. Her dosya tek işlemde çalışır. Önemli: 0076/0078 geri alınırken o tablolara yazılmış veri silinir — önce Supabase yedeği (sahip adımı). 0074 geri alma, audit_log'u eski geniş-okuma haline döndürür.
## Edge
Değişiklik yok → geri alınacak bir şey yok.
