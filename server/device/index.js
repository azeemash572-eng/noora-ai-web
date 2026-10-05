const express = require('express');
const router = express.Router();
router.all('*', (req, res) => {
  res.status(403).json({
    error: 'device actions are client-only',
    message: 'OS / phone actions run via whitelisted client registry + Android bridge / deep links — never from AI text on the server.'
  });
});
module.exports = router;
