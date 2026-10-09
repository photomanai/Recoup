// OpenRouter AI layer — generates human-quality claim email bodies.
// No key or any failure -> returns null, caller falls back to static templates.

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

function buildCompanyPrompt({ companyName, incident }) {
  return (
    `You are Recoup, an SLA refund assistant. Write a short plain-language email to the company "${companyName}". ` +
    `Facts: ${incident.type} incident started at ${incident.started_at}, duration ${incident.duration_min} minutes, ` +
    `estimated refund $${incident.credit_usd}, claim deadline ${incident.claim_deadline}. ` +
    `Keep it under 120 words, friendly, no placeholders, end with "— Recoup".`
  );
}

function buildVendorPrompt({ companyName, incident }) {
  return (
    `You are Recoup, an SLA refund assistant. Write a formal SLA service-credit claim email to Cloudflare support ` +
    `on behalf of "${companyName}". Facts: incident type ${incident.type}, started ${incident.started_at}, ` +
    `duration ${incident.duration_min} minutes, affected domain example.com, traceroute unavailable (automated monitor), ` +
    `claim deadline ${incident.claim_deadline}. Reference the 100% uptime SLA and 5-business-day claim rule. ` +
    `Keep it under 150 words, professional, no placeholders.`
  );
}

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
