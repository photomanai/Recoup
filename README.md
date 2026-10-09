# Recoup (MVP)

Companies overpay SaaS vendors because nobody compares vendor logs against SLA clauses monthly.
This MVP monitors **Cloudflare** 24/7, detects refundable violations, and emails **both** the
company and the vendor with a ready-to-file claim — plus a dashboard with estimated refunds.

## Real Cloudflare SLA (researched 2026-10-09)

- 100% uptime for Customer Content (Business + Enterprise). Remedy = **Service Credit only**, never automatic.
- Claim: notify within **5 business days**, full claim before end of next billing month.
- Evidence: description, duration, traceroutes, affected URLs, resolution steps.
- Business formula: `(Outage min × Affected ratio) / Scheduled min`, cap 1 month fees / 12 months.
- Enterprise: 10x (Standard) / 25x (Premium), cap 6 months / year.
- **Latency >200ms is a CUSTOM demo rule** (no latency clause in real SLA) — labeled as such in UI.

## Stack

- `backend/` — Node.js + Express, MariaDB `sla_monitor`, Nodemailer (Gmail App Password, `MAIL_MODE=log` fallback)
- `frontend/` — React + Vite, dark fintech UI (Sora + JetBrains Mono)
- SaaS cards: Cloudflare **Active**, AWS / Twilio / Zendesk / Salesforce **Disabled (Soon)**

## Run

```bash
mariadb -uroot -p'Test1234!' < db/schema.sql
cp backend/.env.example backend/.env   # set JWT_SECRET + ENCRYPTION_KEY + AI Gmail creds per company via UI
npm --prefix backend install
node backend/src/index.js              # API http://localhost:4000 (MONITOR_INTERVAL_SEC=30, demo: 10)

npm --prefix frontend install
npm --prefix frontend run dev          # UI http://localhost:5173
```

Backend tests (server must run for health test):

```bash
node backend/src/index.js & sleep 2; node --test backend/tests/*.test.js; kill %1
```

## 5-step judge demo (3 min)

1. Open `/` — Cloudflare Active, 4 others Disabled.
2. Register (company + email + password + AI Gmail + App Password + monthly fee) → auto-login.
3. Dashboard → **Activate Cloudflare** → status green.
4. **Simulate Outage** → within ~30–60s: red alert, incident row, estimated $ credit, 2 emails
   (company: refund estimate; vendor: formal claim with duration/URL/traceroute-SIMULATED).
   Without real Gmail creds, check backend console `[MAIL-LOG]` + Notification log table.
5. **Recover** → green. **Simulate Slowdown** → latency chart crosses 200ms dashed line →
   latency incident at 15% of monthly fee (demo rule). Show claim-by countdown.

## Env table

| Key | Purpose |
|---|---|
| DB_HOST/DB_USER/DB_PASSWORD/DB_NAME | MariaDB (`sla_monitor`) |
| JWT_SECRET / ENCRYPTION_KEY | login tokens / AI App Password AES |
| FRONTEND_URL / PORT | CORS + API port |
| SMTP_HOST/SMTP_PORT | Gmail SMTP |
| VENDOR_CLAIM_EMAIL | vendor claim recipient (default support@cloudflare.com) |
| MAIL_MODE=log | log instead of sending (demo without creds) |
| MONITOR_INTERVAL_SEC | worker tick (30 prod, 5–10 demo) |

## Honest limits (MVP)

Simulated metrics (no real Cloudflare API polling yet); vendor email address is a placeholder;
no auto money movement — only claim emails; single-role auth; English UI only.
