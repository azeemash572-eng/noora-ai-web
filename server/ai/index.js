const express = require('express');
const router = express.Router();

function pickKey() {
  return process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.POLLINATIONS_API_KEY || '';
}
function pickBase() {
  if (process.env.GEMINI_API_KEY) return 'https://generativelanguage.googleapis.com/v1beta/openai';
  if (process.env.OPENAI_API_KEY) return 'https://api.openai.com/v1';
  return '';
}

router.post('/chat', async (req, res) => {
  const key = pickKey();
  const base = pickBase();
  if (!key || !base) {
    return res.status(401).json({ error: 'key missing', hint: 'Set GEMINI_API_KEY or OPENAI_API_KEY in env' });
  }
  const body = req.body || {};
  const model = body.model || (process.env.GEMINI_API_KEY ? 'gemini-2.5-flash' : 'gpt-4o-mini');
  const stream = !!body.stream;
  const payload = { model, messages: body.messages || [], temperature: body.temperature ?? 0.7, stream };
  try {
    const r = await fetch(base.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(payload)
    });
    if (stream) {
      res.status(r.status);
      res.setHeader('Content-Type', r.headers.get('content-type') || 'text/event-stream');
      const reader = r.body;
      if (!reader) return res.end();
      // Node fetch ReadableStream
      const { Readable } = require('stream');
      Readable.fromWeb(reader).pipe(res);
      return;
    }
    const j = await r.json();
    res.status(r.status).json(j);
  } catch (e) {
    res.status(502).json({ error: 'upstream failed', detail: String(e.message || e) });
  }
});

module.exports = router;
