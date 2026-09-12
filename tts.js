// pages/api/tts.js
//
// Server-side proxy to ElevenLabs Text-to-Speech. Keeps the ElevenLabs API key
// off the client. Returns raw MP3 bytes that the browser plays directly.
//
// Setup:
//   1. Get a key from https://elevenlabs.io (Profile > API Keys)
//   2. Pick a voice ID (default below is ElevenLabs' built-in "Rachel" voice —
//      swap ELEVENLABS_VOICE_ID for any voice from your ElevenLabs Voice Library)
//   3. Add to .env.local:
//        ELEVENLABS_API_KEY=xxxxxxxxxxxxxxxxxxxx
//        ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
//   4. Restart `npm run dev`
//
// If the key is missing or the ElevenLabs call fails, this route returns a
// 204 (no audio) so the client can silently fall back to the browser's
// built-in SpeechSynthesis voice instead of breaking the chat.

const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // "Rachel"

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  const { text } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ success: false, error: 'text is required' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    // No key configured — let the client fall back to browser TTS.
    return res.status(204).end();
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: text.slice(0, 2000), // ElevenLabs caps input length; keep chat replies well under it
          model_id: 'eleven_multilingual_v2', // supports Urdu + English in one model
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!elevenRes.ok) {
      const errText = await elevenRes.text().catch(() => '');
      console.error('ElevenLabs TTS error:', elevenRes.status, errText);
      return res.status(204).end(); // fall back to browser voice
    }

    const audioBuffer = Buffer.from(await elevenRes.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    return res.status(200).send(audioBuffer);
  } catch (err) {
    console.error('TTS route error:', err);
    return res.status(204).end(); // fall back to browser voice
  }
}
