const express = require('express');
const router = express.Router();

router.post('/tts', async (req, res) => {
  const text = String((req.body && req.body.text) || '').trim();
  if (!text) return res.status(400).json({ error: 'text required' });
  const provider = (req.body && req.body.provider) || 'elevenlabs';
  if (provider === 'elevenlabs') {
    const key = process.env.ELEVENLABS_API_KEY;
    const voiceId = (req.body && req.body.voiceId) || '';
    if (!key) return res.status(401).json({ error: 'key missing', hint: 'Set ELEVENLABS_API_KEY' });
    if (!voiceId) return res.status(400).json({ error: 'voiceId required' });
    try {
      const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voiceId), {
        method: 'POST',
        headers: { Accept: 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': key },
        body: JSON.stringify({
          text: text.slice(0, 2500),
          model_id: (req.body && req.body.model) || 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      });
      if (!r.ok) return res.status(r.status).json({ error: 'elevenlabs ' + r.status });
      res.setHeader('Content-Type', 'audio/mpeg');
      res.send(Buffer.from(await r.arrayBuffer()));
    } catch (e) {
      res.status(502).json({ error: String(e.message || e) });
    }
    return;
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(401).json({ error: 'key missing', hint: 'Set OPENAI_API_KEY for openai TTS' });
  return res.status(501).json({ error: 'openai tts proxy not fully wired in phase 1 — use ElevenLabs or browser TTS' });
});

module.exports = router;
