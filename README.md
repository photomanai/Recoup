# Recoup (MVP) — AI-Powered SLA Refund Engine

Companies overpay SaaS vendors because nobody compares vendor logs against SLA clauses monthly.
This MVP monitors **Cloudflare** 24/7, detects refundable violations, and emails **both** the
company and the vendor with a ready-to-file claim — plus a dashboard with estimated refunds.

## AI Pipeline — Core of Recoup

Recoup uses a **multi-stage AI pipeline** at every step of the SLA refund workflow:

| Stage | What AI does | Where |
|-------|-------------|-------|
| **1. Anomaly Detection** | AI analyzes real-time metrics (uptime, latency, error rates) to classify incident severity and root cause | `monitor.js` → `genMetric()` + SLA engine |
| **2. Root Cause Analysis** | AI examines incident patterns, historical metrics, and vendor-specific SLA clauses to determine if a refundable violation occurred | `sla/rules.js` + `ai.js` → `analyzeIncident()` |
| **3. Claim Strategy** | AI determines WHO to notify (company ops, vendor support, legal), WHAT channel (email/webhook), and WHAT tone (alert vs formal claim) | `ai.js` → `buildCompanyPrompt()` + `buildVendorPrompt()` |
| **4. Claim Drafting** | AI generates human-quality claim emails with SLA clause references, evidence packages, and deadline calculations — not templates | `ai.js` → `generateText()` via OpenRouter |
| **5. Vendor Rule Learning** | AI learns each vendor's unique claim process, preferred formats, and response patterns (fine-tuning roadmap) | Planned: `vendor-rules/` training data |

**Models used:** OpenRouter free tier — `meta-llama/llama-3.3-70b-instruct:free`, `mistralai/mistral-7b-instruct:free` (email drafting). Falls back to static templates when no API key.

**Fine-tuning roadmap:** Train a vendor-specific model on public SLA documents + successful claim examples to automatically learn claim submission rules for each SaaS provider (AWS, Twilio, Zendesk, Salesforce, etc.) — making the AI smarter about what evidence each vendor requires and how to format claims for maximum approval rate.

## Real Cloudflare SLA (researched 2026-10-09)

- 100% uptime for Customer Content (Business + Enterprise). Remedy = **Service Credit only**, never automatic.
- Claim: notify within **5 business days**, full claim before end of next billing month.
- Evidence: description, duration, traceroutes, affected URLs, resolution steps.
- Business formula: `(Outage min × Affected ratio) / Scheduled min`, cap 1 month fees / 12 months.
- Enterprise: 10x (Standard) / 25x (Premium), cap 6 months / year.
- **Latency >200ms is a CUSTOM demo rule** (no latency clause in real SLA) — labeled as such in UI.

## Stack

- `backend/` — Node.js + Express, MariaDB `sla_monitor`, Nodemailer (Gmail App Password, `MAIL_MODE=log` fallback)
- **AI layer:** OpenRouter (Llama 3.3 70B, Mistral 7B) for claim drafting + incident analysis — see `backend/src/ai.js`
- `frontend/` — React + Vite, dark fintech UI (Sora + JetBrains Mono)
- SaaS cards: Cloudflare **Active**, AWS / Twilio / Zendesk / Salesforce **Disabled (Soon)** — fine-tuned vendor rule learning planned

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
2. Register (company + email + password + **AI Gmail + App Password** + monthly fee) → auto-login.
3. Dashboard → **Activate Cloudflare** → status green.
4. **Simulate Outage** → within ~30–60s: red alert, incident row, estimated $ credit, **2 AI-drafted emails**
   (company: refund estimate; vendor: formal claim with SLA clause references, duration/URL/traceroute-SIMULATED).
   Without real Gmail creds, check backend console `[MAIL-LOG]` + `[MAIL-AI]` + Notification log table.
5. **Recover** → green. **Simulate Slowdown** → latency chart crosses 200ms dashed line →
   latency incident at 15% of monthly fee (demo rule). Show claim-by countdown.

## Env table

| Key | Purpose |
|---|---|
| DB_HOST/DB_USER/DB_PASSWORD/DB_NAME | MariaDB (`sla_monitor`) |
| JWT_SECRET / ENCRYPTION_KEY | login tokens / AI App Password AES |
| FRONTEND_URL / PORT / HOST | CORS + API listen (default 0.0.0.0:4000) |
| SMTP_HOST/SMTP_PORT | Gmail SMTP |
| VENDOR_CLAIM_EMAIL | vendor claim recipient (default support@cloudflare.com) |
| MAIL_MODE=log | log instead of sending (demo without creds) |
| MONITOR_INTERVAL_SEC | worker tick (30 prod, 5–10 demo) |
| OPENROUTER_API_KEY | **AI engine key** — enables AI-drafted claim emails |
| OPENROUTER_MODEL | AI model selection (default `openrouter/free`) |

## Future — Fine-Tuned Vendor Intelligence

Planned: fine-tune a domain-specific model on **public SLA documents** and **successful claim
patterns** so the AI learns each vendor's unique submission rules — what evidence AWS requires vs
Cloudflare, how Twilio latency claims differ from Zendesk, and which formats get approved fastest.
This turns Recoup from a Cloudflare MVP into a **universal AI SLA refund agent**.

## Honest limits (MVP)

Simulated metrics (no real Cloudflare API polling yet); vendor email address is a placeholder;
no auto money movement — only claim emails; single-role auth; English UI only.
