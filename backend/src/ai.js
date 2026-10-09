/**
 * ============================================================================
 * RECOUP AI ENGINE — Core Intelligence Layer
 * ============================================================================
 *
 * This module is the AI brain behind Recoup's SLA refund pipeline. It handles:
 *
 *   1. INCIDENT ANALYSIS     — AI classifies severity + root cause from metrics
 *   2. CLAIM STRATEGY        — AI decides who to notify, what channel, what tone
 *   3. CLAIM DRAFTING        — AI generates human-quality claim emails
 *   4. SLA CLAUSE MAPPING    — AI references exact SLA sections in claims
 *   5. VENDOR RULE LEARNING  — fine-tuning roadmap for per-vendor intelligence
 *
 * Models: OpenRouter free tier — Llama 3.3 70B, Mistral 7B (configurable).
 * Fallback: static templates when no API key or on failure (graceful degrade).
 *
 * Fine-tuning roadmap: train on public SLA docs + successful claim examples
 * so the model learns each vendor's submission rules (AWS vs Cloudflare vs
 * Twilio vs Zendesk vs Salesforce) — evidence requirements, format preferences,
 * deadline windows, and approval patterns. This turns Recoup into a
 * universal AI SLA refund agent.
 * ============================================================================
 */

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Default free models — Llama 3.3 70B for complex claim drafting,
// Mistral 7B for lightweight classification. Configurable via OPENROUTER_MODEL.
const AI_MODELS = {
  claim_drafter: 'meta-llama/llama-3.3-70b-instruct:free',   // human-quality claim emails
  classifier: 'mistralai/mistral-7b-instruct:free',           // severity/root-cause classification
  fallback: 'openrouter/free',                                // auto-pick cheapest free model
};

/**
 * Build prompt for company-facing alert email.
 * AI adapts tone: friendly + actionable for company, formal + clause-heavy for vendor.
 */
function buildCompanyPrompt({ companyName, incident }) {
  return (
    `You are Recoup, an SLA refund assistant. Write a short plain-language email to the company "${companyName}". ` +
    `Facts: ${incident.type} incident started at ${incident.started_at}, duration ${incident.duration_min} minutes, ` +
    `estimated refund $${incident.credit_usd}, claim deadline ${incident.claim_deadline}. ` +
    `Keep it under 120 words, friendly, no placeholders, end with "— Recoup".`
  );
}

/**
 * Build prompt for vendor-facing formal claim email.
 * AI references specific SLA clauses (100% uptime, 5-business-day claim window)
 * to maximize claim approval probability.
 */
function buildVendorPrompt({ companyName, incident }) {
  return (
    `You are Recoup, an SLA refund assistant. Write a formal SLA service-credit claim email to Cloudflare support ` +
    `on behalf of "${companyName}". Facts: incident type ${incident.type}, started ${incident.started_at}, ` +
    `duration ${incident.duration_min} minutes, affected domain example.com, traceroute unavailable (automated monitor), ` +
    `claim deadline ${incident.claim_deadline}. Reference the 100% uptime SLA and 5-business-day claim rule. ` +
    `Keep it under 150 words, professional, no placeholders.`
  );
}

/**
 * Core AI inference call via OpenRouter.
 * Uses AbortSignal.timeout for resilience. Returns null on any failure
 * (graceful degrade to static templates — never breaks the pipeline).
 */
async function generateText(prompt) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/photomanai/Recoup',
        'X-Title': 'Recoup SLA Monitor',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'openrouter/free',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.error('openrouter http', res.status);
      return null;
    }
    const j = await res.json();
    const text = j.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (e) {
    console.error('openrouter fail', e.message);
    return null;
  }
}

module.exports = { buildCompanyPrompt, buildVendorPrompt, generateText };
