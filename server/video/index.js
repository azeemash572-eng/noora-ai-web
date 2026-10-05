const express = require('express');
const router = express.Router();
router.all('*', (req, res) => {
  res.status(501).json({ error: 'no provider configured', message: 'Video Studio has no server provider yet. Configure one when available.' });
});
module.exports = router;
