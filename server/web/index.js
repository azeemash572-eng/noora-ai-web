const express = require('express');
const router = express.Router();
router.get('/status', (req, res) => {
  res.json({ sources: ['wikipedia', 'google-news-rss2json'], note: 'Client performs live fetches; server is optional proxy only.' });
});
module.exports = router;
