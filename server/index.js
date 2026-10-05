#!/usr/bin/env node
/**
 * NOORA AI optional proxy server — Phase 1 scaffold.
 * Keys from process.env only. Never logs secret values.
 */
try { require('dotenv').config(); } catch (e) {}
const express = require('express');
const cors = require('cors');

const PORT = parseInt(process.env.PORT || '8787', 10);
const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true, version: '2.1.0', hasGemini: !!process.env.GEMINI_API_KEY, hasOpenAI: !!process.env.OPENAI_API_KEY, hasEleven: !!process.env.ELEVENLABS_API_KEY });
});

app.use('/ai', require('./ai'));
app.use('/voice', require('./voice'));
app.use('/image', require('./image'));
app.use('/video', require('./video'));
app.use('/tools', require('./tools'));
app.use('/files', require('./files'));
app.use('/memory', require('./memory'));
app.use('/web', require('./web'));
app.use('/device', require('./device'));

app.use((req, res) => res.status(404).json({ error: 'not found', path: req.path }));

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('NOORA server 2.1.0 listening on http://127.0.0.1:' + PORT);
  });
}
module.exports = app;
