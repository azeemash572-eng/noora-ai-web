const express = require('express');
const router = express.Router();
router.get('/', (req, res) => {
  res.json({
    tools: ['web', 'files', 'image', 'video', 'device', 'memory', 'calculator', 'datetime'],
    note: 'Device actions remain client/whitelisted; server does not execute OS commands.'
  });
});
module.exports = router;
