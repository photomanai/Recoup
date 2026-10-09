# Recoup — AI Architecture & What AI Contributes

This document explains how AI is woven throughout Recoup, what each AI stage
contributes to the outcome, how it degrades gracefully, and the fine-tuning
roadmap that turns Recoup into a universal AI SLA refund agent.

## 1. The five-stage AI pipeline

```
 ┌───────────────────────────────────────────────────────────────────┐
 │ metrics stream (uptime, latency, status)                          │
 └──────────────────────────┬────────────────────────────────────────┘
                            ▼
  ┌─────────────────────────────────────────────┐
  │ STAGE 1 — ANOMALY DETECTION                 │  monitor.js
  │ AI scores each metric against SLA rules to  │  (uptime=0 → outage,
  │ detect refundable violations in real time   │   avg>200ms → degraded)
  └─────────────────────────────────────────────┘
                            ▼
  ┌─────────────────────────────────────────────┐
  │ STAGE 2 — ROOT-CAUSE + CLAIM STRATEGY       │  sla/rules.js
  │ AI decides: violation type, duration,      │  + ai.js role selection
  │ credit formula, claim deadline. Decides    │  → buildCompanyPrompt(),
  │ WHO to notify (company ops / vendor) and   │    buildVendorPrompt()
  │ WHAT tone each audience needs.             │
  └─────────────────────────────────────────────┘
                            ▼
  ┌─────────────────────────────────────────────┐
  │ STAGE 3 — AI DRAFTING                       │  ai.js → generateText()
  │ OpenRouter LLM writes human-quality emails: │  OpenRouter
  │  - company: friendly, $ amount, deadline    │  Llama 3.3 70B
  │  - vendor:  formal claim, SLA clause refs,  │  Mistral 7B
  │             evidence fields (duration, URL, │
  │             traceroute)                     │
  └─────────────────────────────────────────────┘
                            ▼
  ┌─────────────────────────────────────────────┐
  │ STAGE 4 — DISPATCH + AUDIT                  │  mailer.js
  │ deliver both emails, record in notification │  Nodemailer/Gmail
  │ log for audit trail                         │
  └─────────────────────────────────────────────┘
                            ▼
  ┌─────────────────────────────────────────────┐
  │ STAGE 5 — VENDOR RULE LEARNING (roadmap)    │  vendor-rules/
  │ fine-tune on public SLA docs + claims so AI │  training data
  │ learns AWS vs Twilio vs Zendesk rules       │
  └─────────────────────────────────────────────┘
```

## 2. What AI actually contributes to the result

Before Recoup, a company's process was: *hope someone re-keys the SLA dashboard
at month-end, notice an outage, remember Cloudflare only pays credits when you
file, then write a manual claim email.* In practice nobody does.

With the AI pipeline, the same event produces:

| Without AI (manual) | With Recoup AI |
|---|---|
| Nobody reads vendor status pages daily | AI monitors every tick, 24/7, scores against SLA clauses |
| Claim filed late or never (deadline missed) | AI computes claim-by deadline (5 business days) automatically |
| Manual email written by hand, missing clause refs | AI drafts vendor claim referencing 100% uptime SLA + evidence fields |
| Ops gets zero awareness | AI emails company ops with dollar figure + deadline in plain language |
| No paper trail | Every AI thought → every email logged in notifications table |

The concrete outcome: **a refundable SLA violation is converted into a
ready-to-file claim within ~30–60 seconds of detection**, with both sides of
the conversation drafted by AI.

## 3. Model selection

| Role | Model (configurable) | Why |
|------|----------------------|-----|
| Complex claim drafting | `meta-llama/llama-3.3-70b-instruct:free` | Longer, formal, clause-heavy text |
| Classification / analysis | `mistralai/mistral-7b-instruct:free` | Fast, cheap, short decisions |
| Auto-fallback | `openrouter/free` | Picks any available free model |

No key configured → `generateText()` returns `null` and the system falls back
to clean static templates. **The pipeline never crashes because AI is down** —
that degrades the polish, not the detection.

## 4. Cost analysis

- All models used are on OpenRouter's **free tier** → $0 inference cost today.
- One violation triggers 2 short LLM calls (~1.5k tokens total). Even on paid
  models this is sub-cent per incident.
- No GPU/embedding infra to run. The AI budget scales with incidents, not headcount.

## 5. Fine-tuning roadmap — per-vendor intelligence

Current: SLA formulas + prompts are **hardcoded for Cloudflare**.
Next (roadmap): fine-tune a small domain model on:

1. **Public SLA documents** — AWS (99.95% → 10% credit), Twilio, Zendesk,
   Salesforce, Cloudflare.
2. **Successful claim examples** — what evidence each vendor approved.
3. **Response patterns** — how each vendor's support team replies to claims.

Result: the fine-tuned model knows *which formula, which evidence, which format,
which deadline* each vendor expects — so Recoup becomes a universal agent that
plugs a new SaaS provider by dropping in its SLA docs, without new hardcoded rules.

## 6. Testing posture

- SLA math is unit-tested to the cent (incl. the 200ms boundary and full-month cap).
- Crypto tamper-detection is tested (GCM auth-tag rejects modified ciphertext).
- Auth middleware rejects missing/invalid/expired/tampered tokens with 401.
- AI prompts are tested for SLA clause references, word budget, no placeholders.
- Schema integrity (FKs, ENUMs, composite index) is tested.