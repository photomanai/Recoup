# SLA Refund Monitor — Design Spec (MVP)

Date: 2026-10-09
Status: approved approach A (Monorepo MVP)
Language: English UI
Mode: Full simulation + Real Gmail SMTP (Nodemailer), fallback to log mode

## 1. Problem
Companies pay for SaaS (AWS, Twilio, Zendesk, Salesforce, Cloudflare) with SLA clauses
(e.g. "99.9% uptime or 15% discount", "latency >200ms = penalty") but nobody compares
vendor logs vs contract clauses monthly. Money is overpaid.

## 2. Goal (MVP for judges)
- Company registers with full packet.
- Landing shows SaaS cards: Cloudflare = Active, others = Disabled/Soon.
- After "Activate Cloudflare", system monitors uptime/latency 24/7 (simulated engine).
- On refundable violation: 2 emails sent (to company + to Cloudflare as formal claim)
  + dashboard alert with estimated refund.
- Modern, working demo with one-click simulate buttons.

## 3. Real Cloudflare SLA findings (basis)
Source: cloudflare.com/enterprise-support-sla, /business-sla, plans/faq (checked 2026-10-09).
- Business + Enterprise: 100% uptime for Customer Content. Remedy = Service Credit only, NOT automatic.
- Claim must be notified within 5 business days, full claim before end of next billing month.
- Evidence required: description, duration, traceroutes, affected URLs, resolution steps.
- Business formula: Service Credit = (Outage minutes × Affected ratio) / Scheduled minutes.
  Cap: max 1 month fees per 12 months. Calculated only against monthly recurring fees.
- Enterprise: Standard 10x / Premium 25x multiplier. Cap: max 6 months fees per year.
  Calculated only against fixed Monthly Fees. Claim by Authorized User.
- Exclusions: customer planned downtime, force majeure, beta/trial.
- NO latency clause in real SLA. MVP latency rule (>200ms) is a CUSTOM demo rule,
  explicitly labeled "Demo rule" in UI to stay honest with judges.

## 4. Architecture (Approach A)
Monorepo `AiSummitLSO/`:
- `backend/` — Node.js + Express REST API. Modules: auth, companies, saas,
  monitor-worker, sla-engine, mailer.
- `frontend/` — React + Vite, modern dark UI, 4 pages: Landing, Register, Login, Dashboard.
- `db/schema.sql` — MariaDB (host localhost, user root, password MyMan??024 per owner env).
- Shared SLA rule config in `backend/src/sla/rules.js`.

No Redis/queue in MVP (YAGNI). Worker = setInterval in backend process.

## 5. Components + Data model
Tables (MariaDB):
- `companies(id PK, name, email UNIQUE, password_hash, ai_email, ai_app_password_enc, monthly_fee DECIMAL, created_at)`
- `saas_integrations(id, company_id FK, provider ENUM(cloudflare,aws,twilio,zendesk,salesforce), status ENUM(active,disabled), zone_info JSON, created_at)`
- `metrics(id, company_id FK, ts DATETIME, uptime TINYINT(1), latency_ms INT, status ENUM(ok,outage,degraded))`
- `incidents(id, company_id FK, type ENUM(outage,latency), started_at, duration_min INT, affected_ratio FLOAT, credit_usd DECIMAL(10,2), claim_deadline DATE, status ENUM(open,claimed,recovered))`
- `notifications(id, incident_id FK, to_email, kind ENUM(company,vendor), subject, body TEXT, status ENUM(sent,failed), sent_at)`

Frontend components:
- `SaaSCard` (provider, Active/Disabled + Soon badge)
- `StatusHero` (current uptime, avg latency, month credit total)
- `LatencyChart` (last N metrics), `IncidentList`, `SimulatePanel`
  (buttons: Simulate Outage / Simulate Slowdown / Recover).

## 6. Data flow
1. Register POST /api/auth/register {companyName, email, password, aiEmail, aiAppPassword, monthlyFee}
   → bcrypt password, AES-encrypt aiAppPassword with ENCRYPTION_KEY, create company + disabled integrations.
2. Login POST /api/auth/login → JWT.
3. Activate POST /api/saas/cloudflare/activate {zoneInfo} → saas_integrations cloudflare=active.
4. Worker (every 30s, per active company): generate metric.
   Normal: uptime=1, latency 40–120ms. Simulated modes set by SimulatePanel override generator.
5. SLA engine on each metric:
   - Outage: uptime=0 → open incident type=outage. credit = (duration_min × 1.0 / 43200) × monthly_fee × 10.
     Duration accumulates while outage continues; affected_ratio=1.0 for MVP.
   - Latency: if last 5 metrics avg >200ms → incident type=latency. credit = monthly_fee × 0.15.
   - claim_deadline = started_at + 5 business days (simplified +7 calendar days, labeled as such).
6. On new incident: INSERT incident + 2× INSERT notifications via mailer:
   - To company: "SLA violation detected — estimated $X refund".
   - To vendor (Cloudflare abuse/claim address configurable, default support@cloudflare.com placeholder + logged):
     formal claim with description, duration, affected URLs (simulated zone domain), traceroute placeholder, steps.
   - SMTP: Nodemailer + Gmail (aiEmail + aiAppPassword). If SMTP fails → notifications.status=failed, dashboard shows Retry.
7. Dashboard GET /api/dashboard/:companyId → status, chart data, incidents, credits sum, notifications.

## 7. API sketch
- POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
- POST /api/saas/cloudflare/activate, GET /api/saas
- GET /api/metrics?companyId=&limit=100
- GET /api/incidents?companyId=, POST /api/simulate/{outage|slowdown|recover}
- GET /api/dashboard/:companyId, POST /api/notifications/:id/retry
- GET /api/health

## 8. Error handling
- SMTP fail → failed status + log, no crash, retry endpoint.
- Worker exception → caught, logged, next tick continues.
- DB down → API returns 500 JSON, frontend shows banner.
- Missing .env → backend exits with clear message listing required keys.
- JWT invalid → 401.

## 9. Security
- Passwords bcrypt (10 rounds). JWT 24h. aiAppPassword AES-256-GCM with ENCRYPTION_KEY from .env, never returned by API.
- .env keys: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, ENCRYPTION_KEY, SMTP_HOST, SMTP_PORT, FRONTEND_URL, VENDOR_CLAIM_EMAIL.
- CORS restricted to FRONTEND_URL.

## 10b. Local defaults (to remove ambiguity)
- DB_NAME=sla_monitor, DB_HOST=127.0.0.1, backend PORT=4000, frontend Vite PORT=5173.
- MONITOR_INTERVAL_SEC=30 (demo may set 10 for faster judging). Traceroute/URL evidence
  in vendor email is clearly labeled SIMULATED in MVP.

## 10. Testing / Judge demo script
1. Open landing → see Cloudflare Active, 4 others Disabled.
2. Register company (full packet) → login → Activate Cloudflare.
3. Dashboard green. Click "Simulate Outage" → wait ~40s → red alert + credit $ + 2 emails attempted (check backend log + inbox).
4. Click "Recover" → green. Click "Simulate Slowdown" → latency chart >200ms → latency incident + 15% credit.
5. Show claim deadline countdown + incident list + notification log.

## 11. Non-goals (MVP)
No real Cloudflare API polling, no AWS/Twilio/Zendesk/Salesforce logic, no automatic money transfer (only claim email), no multi-user roles, no i18n (English only).
