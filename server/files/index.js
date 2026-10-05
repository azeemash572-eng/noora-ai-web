const express = require('express');
const router = express.Router();
const MAX = parseInt(process.env.MAX_UPLOAD_BYTES || '15728640', 10);
const ALLOW = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.csv', '.xlsx', '.xls', '.txt', '.md', '.docx', '.mp3', '.wav', '.mp4', '.webm'];

router.post('/validate', express.json(), (req, res) => {
  const name = String((req.body && req.body.name) || '');
  const size = Number((req.body && req.body.size) || 0);
  const mime = String((req.body && req.body.mime) || '');
  const ext = name.includes('.') ? ('.' + name.split('.').pop()).toLowerCase() : '';
  if (size > MAX) return res.status(400).json({ ok: false, error: 'file too large', max: MAX });
  if (ext && !ALLOW.includes(ext)) return res.status(400).json({ ok: false, error: 'unsupported type', ext });
  res.json({ ok: true, name, size, mime });
});

module.exports = router;
