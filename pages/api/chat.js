// Server-side route: the browser calls THIS endpoint, never Grok directly.
// This keeps XAI_API_KEY secret (it never reaches the user's browser).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Server is missing OPENROUTER_API_KEY. Add it to .env.local (and to your hosting provider\'s environment variables) and restart the server.',
    });
  }

  const { message, products = [], sellerName = '' } = req.body || {};
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const productContext = products.length
    ? products.map((p) => `- ${p.name} (${p.id}): Rs. ${p.price}, category: ${p.category}`).join('\n')
    : 'No products loaded.';

  const systemPrompt = `You are a friendly, practical sales assistant inside the "Rozgar" app, helping a seller${
    sellerName ? ` named ${sellerName}` : ''
  } sell digital products door-to-door in Pakistan. Many sellers have low literacy, so:
- Keep replies SHORT: 2-4 simple sentences, no jargon.
- Be encouraging and specific, not generic.
- If asked what to sell, recommend based on the highest commission or easiest pitch.
- If asked how to explain a product, give a simple one-line pitch in plain language.
- You can reply in Roman Urdu/Hindi or English, matching whichever the seller used.

Available products:
${productContext}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://rozgar.app', // optional, for OpenRouter leaderboards
        'X-Title': 'Rozgar Seller Assistant',
      },
      body: JSON.stringify({
        model: 'x-ai/grok-4.3',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        max_tokens: 250,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenRouter API error:', response.status, errText);
      return res.status(response.status).json({ error: 'OpenRouter API error', detail: errText });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(502).json({ error: 'Grok returned an empty response' });
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Chat API route failed:', err);
    return res.status(500).json({ error: err.message });
  }
}
