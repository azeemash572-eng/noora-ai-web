const express = require('express');
const router = express.Router();

router.get('/txt2img', async (req, res) => {
  const prompt = String(req.query.prompt || '').trim();
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  const seed = req.query.seed || Date.now();
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}&referrer=noora-ai-server`;
  try {
    const r = await fetch(url);
    if (!r.ok) return res.status(r.status).json({ error: 'image upstream ' + r.status });
    const ct = r.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', ct);
    const buf = Buffer.from(await r.arrayBuffer());
    res.send(buf);
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

module.exports = router;
