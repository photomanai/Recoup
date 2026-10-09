# Recoup — Öz serverində quraşdırma və yoxlama (addım-addım)

Bu fayl layihəni sıfırdan öz serverində işə salmaq üçündür.
Buradakı bütün şifrələr **test** şifrələridir — real şifrə heç yerə commit olunmur.

## 1. Tələblər

- Node.js 20+ (`node --version`)
- MariaDB 10+ işlək olmalıdır (`systemctl status mariadb`)
- `npm`, `git`

## 2. Verilənlər bazası

```bash
# MariaDB root test şifrəsi ilə daxil ol (öz şifrəni yaz):
mariadb -uroot -p'Test1234!' < db/schema.sql

# Yoxla — 5 cədvəl görünməlidir:
mariadb -uroot -p'Test1234!' -e "SHOW TABLES FROM sla_monitor;"
# companies, incidents, metrics, notifications, saas_integrations
```

`db/schema.sql` bazanı (`sla_monitor`) və bütün cədvəlləri özü yaradır.

## 3. Backend `.env`

```bash
cp backend/.env.example backend/.env
```

Sonra `backend/.env` faylında bunları dəyiş:

| Açar | Nə yazmalı |
|---|---|
| `DB_PASSWORD` | MariaDB root şifrən (məs: `Test1234!`) |
| `JWT_SECRET` | Uzun təsadüfi mətn (login tokenləri üçün) |
| `ENCRYPTION_KEY` | 64 simvolluq hex (aşağıdakı komanda ilə yarat) |

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Qalanları olduğu kimi saxla. `MAIL_MODE=log` — maillər real göndərilmir,
konsola + bazaya yazılır (təhlükəsiz test rejimi).

## 4. Backend-i işə sal

```bash
npm --prefix backend install
node backend/src/index.js
# API on 4000
```

Yoxla (başqa terminalda):

```bash
curl http://127.0.0.1:4000/api/health
# {"ok":true,"db":true}   <- db:true olmalıdır
```

Testlər (server işlək olarkən):

```bash
node --test backend/tests/*.test.js
# pass 7, fail 0 olmalıdır
```

## 5. Frontend-i işə sal

```bash
npm --prefix frontend install
npm --prefix frontend run dev
# ➜ Local: http://localhost:5173/
```

Brauzerdə aç: **http://localhost:5173**

## 6. Sistemi yoxla (2 dəqiqəlik ssenari)

1. Saytda **Register** → şirkət adı, mail, şifrə, AI Gmail + App Password (testdə ixtiyari mətn olar), aylıq ödəniş → qeydiyyat avtomatik login edir.
2. **Dashboard** → **Activate Cloudflare** → status yaşıl olur.
3. **Simulate Outage** bas → 10-30 saniyəyə qırmızı alert, incident sətri, kredit məbləği çıxır.
4. Backend konsolunda `[MAIL-LOG]` sətirlərini gör → 2 mail (şirkətə + Cloudflare-ə) yarandı.
   Dashboard-dakı **Notification log** cədvəlində də görünür.
5. **Recover** → yaşıl. **Simulate Slowdown** → latency qrafiki 200ms xəttini keçir → latency incidenti (aylıq ödənişin 15%-i).

## 7. Real mail göndərmək üçün (istəyə bağlı)

1. Gmail-də 2-step verification aç → **App Password** yarat.
2. Register-də AI Gmail + həmin App Password yaz.
3. `backend/.env`-də `MAIL_MODE=log` sətirini sil və backend-i yenidən başlat.
4. Outage simulyasiya et → hər iki ünvana real mail gedir.

## 8. Dayandırmaq

```bash
# backend və frontend işləyən terminallarda:
Ctrl+C
```
