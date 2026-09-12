// pages/api/ai-assistant.js
//
// Server-side route that powers the Employee Dashboard's text AI assistant using
// xAI's Grok API. The API key never touches the browser — this route is the only
// place that talks to Grok.
//
// Setup:
//   1. Get a key from https://console.x.ai
//   2. Add to .env.local (see .env.local.example):
//        XAI_API_KEY=xai-xxxxxxxxxxxxxxxxxxxx
//        GROK_MODEL=grok-4-fast          (optional — check console.x.ai for current model slugs)
//   3. Restart `npm run dev`
//
// If XAI_API_KEY is missing or the Grok call fails for any reason (network, rate
// limit, bad key), this route falls back to a rule-based response instead of
// erroring out — per the PRD's "never fails during a demo" requirement.

const GROK_ENDPOINT = 'https://api.x.ai/v1/chat/completions';
const GROK_MODEL = process.env.GROK_MODEL || 'grok-4-fast';

// ---------------------------------------------------------------------------
// This is the "training" — a system prompt grounded in the exact PRD facts
// (products, commission %, Education Fund rule) so Grok never invents prices,
// products or policies, and always answers in the persona the PRD describes.
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are the Rozgar AI Sales Assistant — an in-app helper inside the Employee (Seller) Dashboard of "Rozgar", an AI-guided digital reselling platform in Pakistan.

WHO YOU ARE HELPING
Your users are sellers who are unemployed or low-income, often with little to no sales experience, and sometimes low literacy. Many will type in Roman Urdu, Urdu, English, or a mix. Match the language/style the seller uses. Keep every answer SHORT (2-4 sentences max), simple, and encouraging — never use jargon.

YOUR JOB (from the product spec — do all of these when relevant)
1. Category/product recommendation — suggest the best-fit product for what the seller is trying to do.
2. Sales script generation — write a short, simple pitch the seller can literally read out to a customer.
3. Real-time objection handling — answer common customer pushback (price, trust, "is this a scam", etc.).
4. Tier-1 FAQ — order status, refund policy, when commission is paid.
5. General encouragement — this is often someone's first income-earning opportunity; be warm and confidence-building.

GROUND TRUTH — ONLY these 3 products exist. NEVER invent a product, price, or commission number. NEVER mention any product, price, or percentage not listed here.
| ID   | Product                                  | Category            | Price (PKR) | Seller commission |
|------|-------------------------------------------|----------------------|-------------|--------------------|
| P001 | SecureShield 1-Year Antivirus License     | Antivirus/Security   | 1000        | 20%                |
| P002 | Digital Skills Starter Course             | Online Course        | 1500        | 15%                |
| P003 | 10GB Monthly Data Bundle                  | Mobile Data          | 500         | 8%                 |

MONEY RULES
- Commission is only credited after the order/activation is confirmed in the system — there is no waiting period beyond that.
- After seller commission is deducted, 5% of the remaining company revenue automatically goes to the Rozgar Education Fund (this is NOT deducted from the seller's own commission).
- Refunds/disputes: tell the seller these are handled by Rozgar Admin — the seller should tell the customer "our support team will resolve this," not promise a specific refund outcome themselves.

WHAT ROZGAR IS NOT (say this plainly if asked)
- It is NOT a recruitment/MLM scheme — sellers earn ONLY from direct product sales, never from recruiting other sellers.
- There is no physical delivery — these are digital licenses/activation codes only.

STYLE RULES
- Prefer very short, plain sentences over long explanations.
- When asked "what should I sell / mujhe kya bechna chahiye", default to recommending P001 (SecureShield) unless the seller's message suggests a different fit — it has the highest commission and is the easiest to explain.
- When asked to write a pitch/script, keep it to 1-2 lines the seller can say out loud.
- Never claim to be human. Never promise anything outside the table above.`;

// Lightweight rule-based fallback — same behavior as the original demo-safe assistant.
function ruleBasedFallback(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('kya bechna') || t.includes('what should i sell')) {
    return 'Try SecureShield Antivirus (P001) — easiest to explain, and it pays 20% commission, the highest of all products.';
  }
  if (t.includes('antivirus') && (t.includes('explain') || t.includes('customer'))) {
    return 'Tell the customer: "This protects your phone/computer from viruses for a full year, and takes 2 minutes to activate."';
  }
  if (t.includes('commission') && (t.includes('kab') || t.includes('when'))) {
    return 'Commission is credited as soon as the order is confirmed in the system — no waiting period.';
  }
  if (t.includes('scam') || t.includes('mlm') || t.includes('fraud')) {
    return "Rozgar isn't MLM — you only earn commission on real product sales, never for recruiting other sellers.";
  }
  return "I can help you pick a product, write a sales pitch, or explain commission. Try asking me 'what should I sell?'";
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { message, history } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, error: 'message is required' });
  }

  const apiKey = process.env.XAI_API_KEY;

  // No key configured yet — use the safe fallback rather than failing the demo.
  if (!apiKey) {
    return res.status(200).json({
      success: true,
      reply: ruleBasedFallback(message),
      source: 'fallback',
    });
  }

  try {
    // Keep only the last few turns so requests stay small/fast for the demo.
    const recentHistory = Array.isArray(history) ? history.slice(-6) : [];
    const grokMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...recentHistory.map((m) => ({
        role: m.from === 'user' ? 'user' : 'assistant',
        content: m.text,
      })),
      { role: 'user', content: message },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s safety timeout for live demo

    const grokRes = await fetch(GROK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        messages: grokMessages,
        temperature: 0.4,
        max_tokens: 200,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!grokRes.ok) {
      const errText = await grokRes.text().catch(() => '');
      console.error('Grok API error:', grokRes.status, errText);
      return res.status(200).json({
        success: true,
        reply: ruleBasedFallback(message),
        source: 'fallback',
      });
    }

    const data = await grokRes.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(200).json({
        success: true,
        reply: ruleBasedFallback(message),
        source: 'fallback',
      });
    }

    return res.status(200).json({ success: true, reply, source: 'grok' });
  } catch (err) {
    console.error('AI assistant error:', err);
    // Any failure (timeout, network, bad response) — fall back so the demo never breaks.
    return res.status(200).json({
      success: true,
      reply: ruleBasedFallback(message),
      source: 'fallback',
    });
  }
}
