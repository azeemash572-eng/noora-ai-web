const express = require('express');
const router = express.Router();
router.get('/', (req, res) => {
  res.json({ note: 'Memory stays on-device (IndexedDB). Server holds no user memories in phase 1.', categories: ['preferences', 'facts', 'projects', 'context', 'user'] });
});
module.exports = router;
